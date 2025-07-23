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
    
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + keyToTest, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: 'Hello, this is a test message. Please respond with "API key is working correctly."'
                    }]
                }]
            })
        });
        
        if (response.ok) {
            showStatus('API key is working correctly!', 'success');
        } else {
            showStatus('API key test failed: ' + response.statusText, 'error');
        }
    } catch (error) {
        showStatus('Error testing API key: ' + error.message, 'error');
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
            'temporaryAllowed',
            'deniedCooldowns'
        ]);
        
        const whitelistCount = (result.whitelist || []).length;
        const temporaryCount = Object.keys(result.temporaryAllowed || {}).length;
        
        // Count active cooldowns (within 45 minutes)
        const cooldowns = result.deniedCooldowns || {};
        const now = Date.now();
        const activeCooldowns = Object.values(cooldowns).filter(
            timestamp => now - timestamp < 45 * 60 * 1000
        ).length;
        
        document.getElementById('whitelistCount').textContent = whitelistCount;
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
            'temporaryAllowed',
            'deniedCooldowns',
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
        const importKeys = ['whitelist', 'temporaryAllowed', 'deniedCooldowns', 'settings'];
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

// Make removeFromWhitelist globally available
window.removeFromWhitelist = removeFromWhitelist;