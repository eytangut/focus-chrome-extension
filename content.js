// Content script to check and handle blocked pages
(function() {
  // Avoid running multiple times
  if (window.focusExtensionLoaded) return;
  window.focusExtensionLoaded = true;

  async function checkIfBlocked() {
    try {
      // First check if blocking is enabled - exit early if disabled
      const settingsResult = await chrome.storage.local.get(['settings']);
      const blockingEnabled = settingsResult.settings?.blockingEnabled !== false;
      
      if (!blockingEnabled) {
        // Extension is disabled, don't interfere with the page at all
        return;
      }
      
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_BLOCKED',
        url: window.location.href
      });
      
      if (response && response.blocked) {
        showBlockedPage();
      }
    } catch (error) {
      console.error('Focus Extension: Error checking if blocked:', error);
    }
  }

  function showBlockedPage() {
    // Stop the page from loading further
    if (document.readyState === 'loading') {
      window.stop();
    }
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'focus-extension-overlay';
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: white !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    `;
    
    overlay.innerHTML = `
      <div style="
        background: rgba(255, 255, 255, 0.1) !important;
        backdrop-filter: blur(10px) !important;
        border-radius: 20px !important;
        padding: 40px !important;
        text-align: center !important;
        max-width: 500px !important;
        width: 90% !important;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
      ">
        <div style="font-size: 60px !important; margin-bottom: 20px !important; opacity: 0.8 !important;">🛡️</div>
        <h1 style="font-size: 28px !important; font-weight: 700 !important; margin-bottom: 10px !important; color: white !important;">Site Blocked</h1>
        <p style="font-size: 16px !important; margin-bottom: 30px !important; opacity: 0.9 !important; line-height: 1.5 !important; color: white !important;">
          This website is currently blocked by Focus Extension. You can request access through AI assistance.
        </p>
        <div style="
          background: rgba(255, 255, 255, 0.2) !important;
          padding: 10px 15px !important;
          border-radius: 8px !important;
          font-family: monospace !important;
          font-size: 14px !important;
          margin-bottom: 30px !important;
          word-break: break-all !important;
          color: white !important;
        ">${window.location.href}</div>
        
        <div id="cooldownMessage" style="
          background: rgba(255, 193, 7, 0.2) !important;
          border: 1px solid rgba(255, 193, 7, 0.5) !important;
          padding: 15px !important;
          border-radius: 8px !important;
          margin-bottom: 20px !important;
          font-size: 14px !important;
          color: white !important;
          display: none !important;
        ">
          This site was recently denied access. AI chat is temporarily unavailable for this site (45-minute cooldown per site).
        </div>
        
        <div id="actionButtons">
          <button id="aiChatButton" style="
            background: #4CAF50 !important;
            color: white !important;
            border: none !important;
            padding: 15px 30px !important;
            border-radius: 10px !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
            margin: 10px !important;
          ">🤖 Request Access with AI</button>
          <br>
          <button id="backButton" style="
            background: rgba(255, 255, 255, 0.2) !important;
            color: white !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            padding: 12px 25px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
            margin: 10px !important;
          ">← Go Back</button>
        </div>
      </div>
      
      <div id="chatOverlay" style="
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.5) !important;
        backdrop-filter: blur(5px) !important;
        z-index: 2147483647 !important;
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
      ">
        <div style="
          background: white !important;
          border-radius: 15px !important;
          width: 90% !important;
          max-width: 600px !important;
          max-height: 80vh !important;
          display: flex !important;
          flex-direction: column !important;
          color: #333 !important;
          overflow: hidden !important;
        ">
          <div style="
            background: #667eea !important;
            color: white !important;
            padding: 20px !important;
            text-align: center !important;
            font-weight: 600 !important;
            position: relative !important;
          ">
            AI Access Assistant
            <button id="closeChat" style="
              position: absolute !important;
              top: 15px !important;
              right: 20px !important;
              background: none !important;
              border: none !important;
              color: white !important;
              font-size: 20px !important;
              cursor: pointer !important;
            ">×</button>
          </div>
          <div id="chatMessages" style="
            flex: 1 !important;
            padding: 20px !important;
            overflow-y: auto !important;
            max-height: 400px !important;
          "></div>
          <div style="
            padding: 20px !important;
            border-top: 1px solid #eee !important;
            display: flex !important;
            gap: 10px !important;
          ">
            <input type="text" id="chatInput" placeholder="Explain why you need access to this site..." style="
              flex: 1 !important;
              padding: 12px !important;
              border: 1px solid #ddd !important;
              border-radius: 8px !important;
              font-size: 14px !important;
            ">
            <button id="sendMessage" style="
              background: #667eea !important;
              color: white !important;
              border: none !important;
              padding: 12px 20px !important;
              border-radius: 8px !important;
              cursor: pointer !important;
              font-weight: 600 !important;
            ">Send</button>
          </div>
        </div>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(overlay);
    
    // Initialize event handlers
    initializeBlockedPage();
  }

  function initializeBlockedPage() {
    // Check if in cooldown
    checkCooldownStatus();
    
    // Event listeners
    document.getElementById('aiChatButton').addEventListener('click', openAIChat);
    document.getElementById('backButton').addEventListener('click', () => window.history.back());
    document.getElementById('closeChat').addEventListener('click', closeAIChat);
    document.getElementById('sendMessage').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') sendMessage();
    });
    
    async function checkCooldownStatus() {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_COOLDOWN_STATUS',
          url: window.location.href
        });
        
        if (response && response.inCooldown) {
          document.getElementById('cooldownMessage').style.display = 'block';
          const aiButton = document.getElementById('aiChatButton');
          aiButton.disabled = true;
          aiButton.textContent = '🚫 AI Chat Unavailable (Cooldown)';
          aiButton.style.background = '#666 !important';
          aiButton.style.cursor = 'not-allowed !important';
        }
      } catch (error) {
        console.error('Error checking cooldown status:', error);
      }
    }
    
    function openAIChat() {
      document.getElementById('chatOverlay').style.display = 'flex';
      initializeAIChat();
    }
    
    function closeAIChat() {
      document.getElementById('chatOverlay').style.display = 'none';
    }
    
    async function initializeAIChat() {
      const messagesContainer = document.getElementById('chatMessages');
      messagesContainer.innerHTML = '';
      
      // Add initial AI message
      addMessage('ai', 'Hello! I see you want to access ' + window.location.hostname + '. Can you tell me why you need to visit this site?');
    }
    
    function addMessage(sender, content) {
      const messagesContainer = document.getElementById('chatMessages');
      const messageDiv = document.createElement('div');
      messageDiv.style.cssText = `
        margin-bottom: 15px !important;
        padding: 10px 15px !important;
        border-radius: 10px !important;
        max-width: 80% !important;
      `;
      
      if (sender === 'user') {
        messageDiv.style.cssText += `
          background: #e3f2fd !important;
          margin-left: auto !important;
        `;
      } else if (sender === 'ai') {
        messageDiv.style.cssText += `
          background: #f5f5f5 !important;
        `;
      } else {
        messageDiv.style.cssText += `
          background: #fff3e0 !important;
          text-align: center !important;
          font-style: italic !important;
          max-width: 100% !important;
        `;
      }
      
      messageDiv.textContent = content;
      messagesContainer.appendChild(messageDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    async function sendMessage() {
      const input = document.getElementById('chatInput');
      const sendButton = document.getElementById('sendMessage');
      const message = input.value.trim();
      if (!message) return;
      
      input.value = '';
      addMessage('user', message);
      
      // Disable input while processing
      sendButton.disabled = true;
      input.disabled = true;
      
      try {
        const aiResponse = await getAIResponse(message);
        addMessage('ai', aiResponse.message);
        
        if (aiResponse.decision) {
          await handleAIDecision(aiResponse.decision);
        }
      } catch (error) {
        addMessage('system', 'Error communicating with AI: ' + error.message);
      } finally {
        // Re-enable input
        sendButton.disabled = false;
        input.disabled = false;
        input.focus();
      }
    }
    
    async function getAIResponse(userMessage) {
      // Get Gemini API key and user tasks from storage
      const result = await chrome.storage.local.get(['geminiApiKey', 'userTasks', 'aiMemory']);
      if (!result.geminiApiKey) {
        throw new Error('Gemini API key not configured. Please set it in extension settings.');
      }
      
      // Get current whitelist for context
      const whitelistResponse = await chrome.runtime.sendMessage({ type: 'GET_WHITELIST' });
      
      // Get AI's previous notes about this domain
      const domain = window.location.hostname;
      const aiMemory = result.aiMemory || {};
      const domainMemory = aiMemory[domain] || { notes: '', lastUpdated: 0 };
      
      // Enhanced prompt that asks AI to update its memory
      const systemPrompt = `You are helping manage website access. User wants to access: ${window.location.href}

Current context:
- Site: ${domain}
- Page title: ${document.title || 'Unknown'}
- User tasks: ${result.userTasks || 'No specific tasks defined'}
- Current whitelist includes: ${(whitelistResponse.whitelist || []).length} sites

Your previous notes about this domain: ${domainMemory.notes || 'No previous notes'}

User message: ${userMessage}

Please respond with a JSON object containing:
{
  "message": "your conversational response to the user",
  "memory_notes": "brief notes about this interaction that you want to remember for future visits to this domain (or null if no notes needed)",
  "decision": null OR {
    "type": "permanent_whitelist|allow_once|allow_temporary|deny",
    "scope": "domain|page", 
    "duration": 3600000,
    "reasoning": "your reason"
  }
}

If you need more information, respond with decision: null
Types: permanent_whitelist (add to permanent whitelist), allow_once (allow until tab closed), allow_temporary (allow for specific time), deny (block access)
Scope: domain (entire ${domain}), page (just this specific page)

Keep memory_notes brief and focused on the user's legitimate use cases for this domain. This helps you make consistent decisions in future visits.`;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': result.geminiApiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: systemPrompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024
            }
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
          throw new Error('Invalid API response format');
        }
        
        const aiMessage = data.candidates[0].content.parts[0].text;
        
        // Try to parse as JSON, fallback to plain text
        try {
          const parsed = JSON.parse(aiMessage);
          
          // Update AI memory if provided
          if (parsed.memory_notes) {
            await chrome.runtime.sendMessage({
              type: 'UPDATE_AI_MEMORY',
              domain: domain,
              notes: parsed.memory_notes
            });
          }
          
          return parsed;
        } catch (parseError) {
          // If JSON parsing fails, return as plain message
          return { 
            message: aiMessage, 
            decision: null 
          };
        }
      } catch (error) {
        console.error('AI API Error:', error);
        throw error;
      }
    }
    
    async function handleAIDecision(decision) {
      try {
        await chrome.runtime.sendMessage({
          type: 'AI_DECISION',
          decision: decision,
          url: window.location.href
        });
        
        // Show decision message
        addMessage('system', `Decision: ${decision.type} - ${decision.reasoning}`);
        
        // Redirect or refresh based on decision
        if (decision.type !== 'deny') {
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          setTimeout(() => {
            closeAIChat();
            checkCooldownStatus();
          }, 2000);
        }
      } catch (error) {
        addMessage('system', 'Error applying decision: ' + error.message);
      }
    }
  }

  // Check if page should be blocked when content loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkIfBlocked);
  } else {
    checkIfBlocked();
  }
})();