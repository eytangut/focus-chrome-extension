// Background service worker for Focus extension
class FocusExtension {
  constructor() {
    this.initializeStorage();
    this.setupEventListeners();
  }

  async initializeStorage() {
    const defaultSettings = {
      whitelist: [
        'chrome://*',
        'chrome-extension://*',
        'moz-extension://*',
        'edge://*',
        'about:*'
      ],
      temporaryAllowed: {}, // {domain: {expiry: timestamp, type: 'once'|'timed'}}
      deniedCooldowns: {}, // {domain: timestamp}
      geminiApiKey: '',
      userTasks: '', // User's current tasks for AI context
      settings: {
        blockingEnabled: true
      }
    };

    const stored = await chrome.storage.local.get(['whitelist', 'temporaryAllowed', 'deniedCooldowns', 'geminiApiKey', 'userTasks', 'settings']);
    
    // Initialize missing keys with defaults
    for (const [key, value] of Object.entries(defaultSettings)) {
      if (!(key in stored)) {
        await chrome.storage.local.set({ [key]: value });
      }
    }
  }

  setupEventListeners() {
    // Listen for tab updates to handle navigation
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'loading' && tab.url) {
        this.handleNavigation(tabId, tab.url);
      }
    });

    // Clean up temporary permissions when tabs are closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.cleanupTabPermissions(tabId);
    });

    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });
  }

  async handleNavigation(tabId, url) {
    try {
      const isBlocked = await this.shouldBlockUrl(url);
      if (isBlocked) {
        // Inject content script to show blocked page
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['blocked.js']
        });
      }
    } catch (error) {
      console.error('Error handling navigation:', error);
    }
  }

  async shouldBlockUrl(url) {
    try {
      const { whitelist, temporaryAllowed, deniedCooldowns, settings, userTasks } = 
        await chrome.storage.local.get(['whitelist', 'temporaryAllowed', 'deniedCooldowns', 'settings', 'userTasks']);

      if (!settings.blockingEnabled) return false;

      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const fullPath = `${domain}${urlObj.pathname}`;

      // Check whitelist (exact match and parent domains)
      for (const whitelistEntry of whitelist) {
        if (this.matchesPattern(url, whitelistEntry)) {
          return false;
        }
      }

      // Check if in blacklist mode (no tasks defined)
      if (!userTasks || userTasks.trim() === '') {
        // In blacklist mode - only block if explicitly in a blacklist
        // Since we don't have a blacklist yet, allow all non-whitelisted sites
        // This effectively disables AI blocking when no tasks are defined
        return false;
      }

      // AI mode is active (tasks are defined)
      // Check temporary permissions
      if (temporaryAllowed[domain] || temporaryAllowed[fullPath]) {
        const permission = temporaryAllowed[domain] || temporaryAllowed[fullPath];
        
        if (permission.type === 'once') {
          // Already allowed for this session
          return false;
        } else if (permission.type === 'timed' && Date.now() < permission.expiry) {
          // Temporary time-based permission still valid
          return false;
        }
      }

      // Check if in cooldown period (denied recently)
      if (deniedCooldowns[domain] && Date.now() - deniedCooldowns[domain] < 45 * 60 * 1000) {
        return true; // Block without AI chat
      }

      return true; // Should be blocked (AI mode)
    } catch (error) {
      console.error('Error checking if URL should be blocked:', error);
      return false; // Default to not blocking on error
    }
  }

  matchesPattern(url, pattern) {
    // Handle wildcard patterns
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      return new RegExp(`^${regexPattern}`).test(url);
    }
    
    try {
      const urlObj = new URL(url);
      
      // Handle domain-only patterns (no protocol)
      let patternObj;
      if (!pattern.includes('://')) {
        // Add https:// prefix for domain-only patterns
        patternObj = new URL('https://' + pattern);
      } else {
        patternObj = new URL(pattern);
      }
      
      // Check if domain matches (exact match or proper subdomain)
      if (urlObj.hostname === patternObj.hostname) {
        // Exact domain match
        if (!patternObj.pathname || patternObj.pathname === '/') {
          return true;
        }
        return urlObj.pathname.startsWith(patternObj.pathname);
      } else if (urlObj.hostname.endsWith('.' + patternObj.hostname)) {
        // Subdomain match - ensure it's a proper subdomain
        const prefix = urlObj.hostname.substring(0, urlObj.hostname.length - patternObj.hostname.length - 1);
        if (prefix && !prefix.includes('.')) {
          // It's a direct subdomain (like sub.example.com, not sub.other.example.com)
          if (!patternObj.pathname || patternObj.pathname === '/') {
            return true;
          }
          return urlObj.pathname.startsWith(patternObj.pathname);
        }
      }
    } catch (error) {
      // Fallback: only match if the pattern is exactly contained at the start or as a full component
      // This is for cases where URL parsing fails
      if (pattern.startsWith('http') || pattern.startsWith('chrome')) {
        return url === pattern;
      }
      return false;
    }
    
    return false;
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'CHECK_BLOCKED':
          const isBlocked = await this.shouldBlockUrl(message.url);
          sendResponse({ blocked: isBlocked });
          break;

        case 'GET_COOLDOWN_STATUS':
          const { deniedCooldowns } = await chrome.storage.local.get(['deniedCooldowns']);
          const domain = new URL(message.url).hostname;
          const inCooldown = deniedCooldowns[domain] && 
            Date.now() - deniedCooldowns[domain] < 45 * 60 * 1000;
          sendResponse({ inCooldown });
          break;

        case 'AI_DECISION':
          await this.handleAIDecision(message.decision, message.url);
          sendResponse({ success: true });
          break;

        case 'GET_WHITELIST':
          const { whitelist } = await chrome.storage.local.get(['whitelist']);
          sendResponse({ whitelist });
          break;

        case 'TASKS_UPDATED':
          // Tasks were updated, no specific action needed as storage is already updated
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleAIDecision(decision, url) {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const fullPath = `${domain}${urlObj.pathname}`;

    switch (decision.type) {
      case 'permanent_whitelist':
        await this.addToWhitelist(decision.scope === 'domain' ? domain : fullPath);
        break;

      case 'allow_once':
        await this.addTemporaryPermission(
          decision.scope === 'domain' ? domain : fullPath, 
          'once'
        );
        break;

      case 'allow_temporary':
        await this.addTemporaryPermission(
          decision.scope === 'domain' ? domain : fullPath, 
          'timed', 
          decision.duration
        );
        break;

      case 'deny':
        await this.addToCooldown(domain);
        break;
    }
  }

  async addToWhitelist(entry) {
    const { whitelist } = await chrome.storage.local.get(['whitelist']);
    if (!whitelist.includes(entry)) {
      whitelist.push(entry);
      await chrome.storage.local.set({ whitelist });
    }
  }

  async addTemporaryPermission(entry, type, duration = null) {
    const { temporaryAllowed } = await chrome.storage.local.get(['temporaryAllowed']);
    
    temporaryAllowed[entry] = {
      type,
      expiry: type === 'timed' ? Date.now() + duration : null
    };
    
    await chrome.storage.local.set({ temporaryAllowed });
  }

  async addToCooldown(domain) {
    const { deniedCooldowns } = await chrome.storage.local.get(['deniedCooldowns']);
    deniedCooldowns[domain] = Date.now();
    await chrome.storage.local.set({ deniedCooldowns });
  }

  async cleanupTabPermissions(tabId) {
    // Clean up any "once" permissions when tab is closed
    const { temporaryAllowed } = await chrome.storage.local.get(['temporaryAllowed']);
    
    for (const [key, value] of Object.entries(temporaryAllowed)) {
      if (value.type === 'once') {
        delete temporaryAllowed[key];
      }
    }
    
    await chrome.storage.local.set({ temporaryAllowed });
  }
}

// Initialize the extension
new FocusExtension();