// Settings page functionality
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    setupEventListeners();
    updateStatistics();
});

function setupEventListeners() {
    // API Key management
    document.getElementById('saveApiKey').addEventListener('click', saveApiKey);
    document.getElementById('testApiKey').addEventListener('click', testApiKey);
    
    // Extension settings
    document.getElementById('blockingEnabled').addEventListener('change', saveExtensionSettings);
    
    // Task management
    document.getElementById('saveTasks').addEventListener('click', saveTasks);
    
    // Whitelist management
    document.getElementById('addToWhitelist').addEventListener('click', addToWhitelist);
    
    // Blacklist management  
    document.getElementById('addToBlacklist').addEventListener('click', addToBlacklist);
    
    // Data management
    document.getElementById('exportData').addEventListener('click', exportData);
    document.getElementById('importData').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('clearTemporary').addEventListener('click', clearTemporaryPermissions);
    document.getElementById('resetExtension').addEventListener('click', resetExtension);
}

async function loadSettings() {
    try {
        const result = await chrome.storage.local.get([
            'geminiApiKey', 
            'settings', 
            'whitelist',
            'blacklist',
            'temporaryAllowed',
            'deniedCooldowns',
            'userTasks'
        ]);
        
        // Load API key (mask it for security)
        if (result.geminiApiKey) {
            const maskedKey = result.geminiApiKey.substring(0, 8) + '...';
            document.getElementById('geminiApiKey').placeholder = `Current: ${maskedKey}`;
        }
        
        // Load extension settings
        if (result.settings) {
            document.getElementById('blockingEnabled').checked = result.settings.blockingEnabled !== false;
        }
        
        // Load user tasks
        if (result.userTasks) {
            document.getElementById('userTasks').value = result.userTasks;
        }
        
        // Update mode indicator
        updateModeIndicator(result.userTasks);
        
        // Load whitelist
        if (result.whitelist) {
            displayWhitelist(result.whitelist);
        }
        
        // Load blacklist
        if (result.blacklist) {
            displayBlacklist(result.blacklist);
        }
        
    } catch (error) {
        showStatus('Error loading settings: ' + error.message, 'error');
    }
}

function displayWhitelist(whitelist) {
    const container = document.getElementById('whitelistContainer');
    container.innerHTML = '';
    
    whitelist.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'whitelist-item';
        item.innerHTML = `
            <span class="whitelist-url">${entry}</span>
            <button class="remove-btn" onclick="removeFromWhitelist(${index})">Remove</button>
        `;
        container.appendChild(item);
    });
}

function displayBlacklist(blacklist) {
    const container = document.getElementById('blacklistContainer');
    container.innerHTML = '';
    
    if (blacklist.length === 0) {
        container.innerHTML = '<p style="color: #666; font-style: italic; text-align: center; padding: 20px;">No sites in blacklist. Add sites above to block them in blacklist mode.</p>';
        return;
    }
    
    blacklist.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'whitelist-item'; // Reuse the same styling
        item.innerHTML = `
            <span class="whitelist-url">${entry}</span>
            <button class="remove-btn" onclick="removeFromBlacklist(${index})">Remove</button>
        `;
        container.appendChild(item);
    });
}

async function saveApiKey() {
    const apiKey = document.getElementById('geminiApiKey').value.trim();
    
    if (!apiKey) {
        showStatus('Please enter an API key', 'error');
        return;
    }
    
    try {
        await chrome.storage.local.set({ geminiApiKey: apiKey });
        showStatus('API key saved successfully', 'success');
        
        // Update placeholder
        const maskedKey = apiKey.substring(0, 8) + '...';
        document.getElementById('geminiApiKey').value = '';
        document.getElementById('geminiApiKey').placeholder = `Current: ${maskedKey}`;
        
    } catch (error) {
        showStatus('Error saving API key: ' + error.message, 'error');
    }
}

async function testApiKey() {
    const apiKey = document.getElementById('geminiApiKey').value.trim();
    
    if (!apiKey) {
        // Try to get existing key
        const result = await chrome.storage.local.get(['geminiApiKey']);
        if (!result.geminiApiKey) {
            showStatus('Please enter an API key to test', 'error');
            return;
        }
        var keyToTest = result.geminiApiKey;
    } else {
        var keyToTest = apiKey;
    }
    
    // Show testing status
    showStatus('Testing API key...', 'info');
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${keyToTest}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: 'Hello, this is a test message. Please respond with "API key is working correctly."'
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 50
                }
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                showStatus('API key is working correctly!', 'success');
            } else {
                showStatus('API key test failed: Invalid response format', 'error');
            }
        } else {
            const errorText = await response.text();
            let errorMessage = 'API key test failed: ';
            
            // Provide more specific error messages
            if (response.status === 400) {
                errorMessage += 'Invalid API key format or request';
            } else if (response.status === 403) {
                errorMessage += 'API key access denied - check permissions';
            } else if (response.status === 404) {
                errorMessage += 'API endpoint not found - check key validity';
            } else {
                errorMessage += `${response.status} - ${response.statusText}`;
            }
            
            showStatus(errorMessage, 'error');
            console.error('API Test Error:', errorText);
        }
    } catch (error) {
        showStatus('Error testing API key: ' + error.message, 'error');
        console.error('API Test Exception:', error);
    }
}

async function saveExtensionSettings() {
    const blockingEnabled = document.getElementById('blockingEnabled').checked;
    
    try {
        await chrome.storage.local.set({ 
            settings: { blockingEnabled } 
        });
        showStatus('Settings saved successfully', 'success');
    } catch (error) {
        showStatus('Error saving settings: ' + error.message, 'error');
    }
}

async function saveTasks() {
    const tasks = document.getElementById('userTasks').value.trim();
    
    try {
        await chrome.storage.local.set({ userTasks: tasks });
        updateModeIndicator(tasks);
        showStatus('Tasks saved successfully', 'success');
        
        // Notify background script of mode change
        chrome.runtime.sendMessage({
            type: 'TASKS_UPDATED',
            tasks: tasks
        });
    } catch (error) {
        showStatus('Error saving tasks: ' + error.message, 'error');
    }
}

function updateModeIndicator(tasks) {
    const indicator = document.getElementById('modeIndicator');
    const modeText = document.getElementById('modeText');
    
    if (!tasks || tasks.trim() === '') {
        indicator.className = 'mode-indicator blacklist-mode';
        modeText.textContent = 'Blacklist Mode: AI Disabled (Add tasks to enable AI)';
    } else {
        indicator.className = 'mode-indicator ai-mode';
        modeText.textContent = 'AI Mode: Active with Task Context';
    }
}

async function addToBlacklist() {
    const entry = document.getElementById('newBlacklistEntry').value.trim();
    
    if (!entry) {
        showStatus('Please enter a website URL', 'error');
        return;
    }
    
    try {
        const result = await chrome.storage.local.get(['blacklist']);
        const blacklist = result.blacklist || [];
        
        if (blacklist.includes(entry)) {
            showStatus('This entry is already in the blacklist', 'error');
            return;
        }
        
        blacklist.push(entry);
        await chrome.storage.local.set({ blacklist });
        
        document.getElementById('newBlacklistEntry').value = '';
        displayBlacklist(blacklist);
        updateStatistics();
        showStatus('Added to blacklist successfully', 'success');
        
    } catch (error) {
        showStatus('Error adding to blacklist: ' + error.message, 'error');
    }
}

async function removeFromBlacklist(index) {
    try {
        const result = await chrome.storage.local.get(['blacklist']);
        const blacklist = result.blacklist || [];
        
        blacklist.splice(index, 1);
        await chrome.storage.local.set({ blacklist });
        
        displayBlacklist(blacklist);
        updateStatistics();
        showStatus('Removed from blacklist', 'success');
        
    } catch (error) {
        showStatus('Error removing from blacklist: ' + error.message, 'error');
    }
}

async function addToWhitelist() {
    const entry = document.getElementById('newWhitelistEntry').value.trim();
    
    if (!entry) {
        showStatus('Please enter a website URL', 'error');
        return;
    }
    
    try {
        const result = await chrome.storage.local.get(['whitelist']);
        const whitelist = result.whitelist || [];
        
        if (whitelist.includes(entry)) {
            showStatus('This entry is already in the whitelist', 'error');
            return;
        }
        
        whitelist.push(entry);
        await chrome.storage.local.set({ whitelist });
        
        document.getElementById('newWhitelistEntry').value = '';
        displayWhitelist(whitelist);
        updateStatistics();
        showStatus('Added to whitelist successfully', 'success');
        
    } catch (error) {
        showStatus('Error adding to whitelist: ' + error.message, 'error');
    }
}

async function removeFromWhitelist(index) {
    try {
        const result = await chrome.storage.local.get(['whitelist']);
        const whitelist = result.whitelist || [];
        
        whitelist.splice(index, 1);
        await chrome.storage.local.set({ whitelist });
        
        displayWhitelist(whitelist);
        updateStatistics();
        showStatus('Removed from whitelist', 'success');
        
    } catch (error) {
        showStatus('Error removing from whitelist: ' + error.message, 'error');
    }
}

async function updateStatistics() {
    try {
        const result = await chrome.storage.local.get([
            'whitelist',
            'blacklist',
            'temporaryAllowed',
            'deniedCooldowns'
        ]);
        
        const whitelistCount = (result.whitelist || []).length;
        const blacklistCount = (result.blacklist || []).length;
        const temporaryCount = Object.keys(result.temporaryAllowed || {}).length;
        
        // Count active cooldowns (within 45 minutes)
        const cooldowns = result.deniedCooldowns || {};
        const now = Date.now();
        const activeCooldowns = Object.values(cooldowns).filter(
            timestamp => now - timestamp < 45 * 60 * 1000
        ).length;
        
        document.getElementById('whitelistCount').textContent = whitelistCount;
        document.getElementById('blacklistCount').textContent = blacklistCount;
        document.getElementById('temporaryCount').textContent = temporaryCount;
        document.getElementById('cooldownCount').textContent = activeCooldowns;
        
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

async function exportData() {
    try {
        const data = await chrome.storage.local.get([
            'whitelist',
            'blacklist',
            'temporaryAllowed',
            'deniedCooldowns',
            'aiMemory',
            'settings'
        ]);
        
        // Don't export API key for security
        const exportData = {
            ...data,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `focus-extension-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus('Settings exported successfully', 'success');
        
    } catch (error) {
        showStatus('Error exporting data: ' + error.message, 'error');
    }
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Validate data structure
        if (!data.version) {
            throw new Error('Invalid settings file format');
        }
        
        // Import data (excluding API key for security)
        const importKeys = ['whitelist', 'blacklist', 'temporaryAllowed', 'deniedCooldowns', 'aiMemory', 'settings'];
        const toImport = {};
        
        importKeys.forEach(key => {
            if (data[key]) {
                toImport[key] = data[key];
            }
        });
        
        await chrome.storage.local.set(toImport);
        
        // Reload page to reflect changes
        showStatus('Settings imported successfully', 'success');
        setTimeout(() => {
            location.reload();
        }, 1000);
        
    } catch (error) {
        showStatus('Error importing data: ' + error.message, 'error');
    }
    
    // Reset file input
    event.target.value = '';
}

async function clearTemporaryPermissions() {
    if (!confirm('Are you sure you want to clear all temporary permissions?')) {
        return;
    }
    
    try {
        await chrome.storage.local.set({ 
            temporaryAllowed: {},
            deniedCooldowns: {}
        });
        
        updateStatistics();
        showStatus('Temporary permissions cleared', 'success');
        
    } catch (error) {
        showStatus('Error clearing temporary permissions: ' + error.message, 'error');
    }
}

async function resetExtension() {
    if (!confirm('Are you sure you want to reset ALL extension data? This cannot be undone!')) {
        return;
    }
    
    if (!confirm('This will delete your whitelist, API key, and all settings. Continue?')) {
        return;
    }
    
    try {
        await chrome.storage.local.clear();
        showStatus('Extension reset successfully', 'success');
        
        setTimeout(() => {
            location.reload();
        }, 1000);
        
    } catch (error) {
        showStatus('Error resetting extension: ' + error.message, 'error');
    }
}

function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 5000);
}

// Make removeFromWhitelist and removeFromBlacklist globally available
window.removeFromWhitelist = removeFromWhitelist;
window.removeFromBlacklist = removeFromBlacklist;