// Popup functionality
document.addEventListener('DOMContentLoaded', function() {
    loadPopupData();
    setupEventListeners();
});

function setupEventListeners() {
    // Toggle blocking
    document.getElementById('blockingToggle').addEventListener('click', toggleBlocking);
    
    // Open settings page
    document.getElementById('openSettings').addEventListener('click', openSettings);
    
    // Clear temporary permissions
    document.getElementById('clearTemporary').addEventListener('click', clearTemporary);
}

async function loadPopupData() {
    try {
        const result = await chrome.storage.local.get([
            'settings',
            'whitelist',
            'blacklist',
            'temporaryAllowed',
            'deniedCooldowns',
            'geminiApiKey'
        ]);
        
        // Update blocking status
        const blockingEnabled = result.settings?.blockingEnabled !== false;
        updateBlockingStatus(blockingEnabled);
        
        // Update statistics
        updateStatistics(result);
        
        // Update overall status
        updateOverallStatus(result);
        
    } catch (error) {
        console.error('Error loading popup data:', error);
        document.getElementById('statusText').textContent = 'Error loading data';
    }
}

function updateBlockingStatus(enabled) {
    const toggle = document.getElementById('blockingToggle');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    if (enabled) {
        toggle.classList.add('active');
        statusIndicator.className = 'status-indicator status-active';
        statusText.textContent = 'Protection Active';
    } else {
        toggle.classList.remove('active');
        statusIndicator.className = 'status-indicator status-inactive';
        statusText.textContent = 'Protection Disabled';
    }
}

function updateStatistics(data) {
    // Whitelist count
    const whitelistCount = (data.whitelist || []).length;
    document.getElementById('whitelistCount').textContent = whitelistCount;
    
    // Temporary permissions count
    const temporaryCount = Object.keys(data.temporaryAllowed || {}).length;
    document.getElementById('temporaryCount').textContent = temporaryCount;
    
    // Blocked sites today (simplified - count cooldowns from today)
    const cooldowns = data.deniedCooldowns || {};
    const today = new Date().toDateString();
    const blockedToday = Object.values(cooldowns).filter(timestamp => {
        return new Date(timestamp).toDateString() === today;
    }).length;
    document.getElementById('blockedCount').textContent = blockedToday;
}

function updateOverallStatus(data) {
    const hasApiKey = Boolean(data.geminiApiKey);
    const blockingEnabled = data.settings?.blockingEnabled !== false;
    
    let statusText = '';
    let statusClass = '';
    
    if (!hasApiKey) {
        statusText = 'API Key Required';
        statusClass = 'status-inactive';
    } else if (!blockingEnabled) {
        statusText = 'Protection Disabled';
        statusClass = 'status-inactive';
    } else {
        statusText = 'Protection Active';
        statusClass = 'status-active';
    }
    
    document.getElementById('statusText').textContent = statusText;
    document.getElementById('statusIndicator').className = `status-indicator ${statusClass}`;
}

async function toggleBlocking() {
    try {
        const result = await chrome.storage.local.get(['settings']);
        const currentSettings = result.settings || {};
        const newBlockingState = !currentSettings.blockingEnabled;
        
        await chrome.storage.local.set({
            settings: {
                ...currentSettings,
                blockingEnabled: newBlockingState
            }
        });
        
        updateBlockingStatus(newBlockingState);
        
        // Show feedback
        showNotification(
            newBlockingState ? 'Protection enabled' : 'Protection disabled',
            newBlockingState ? 'success' : 'warning'
        );
        
    } catch (error) {
        console.error('Error toggling blocking:', error);
        showNotification('Error updating settings', 'error');
    }
}

function openSettings() {
    chrome.runtime.openOptionsPage();
    window.close();
}

async function clearTemporary() {
    try {
        await chrome.storage.local.set({
            temporaryAllowed: {},
            deniedCooldowns: {}
        });
        
        // Reload data to reflect changes
        loadPopupData();
        
        showNotification('Temporary permissions cleared', 'success');
        
    } catch (error) {
        console.error('Error clearing temporary permissions:', error);
        showNotification('Error clearing permissions', 'error');
    }
}

function showNotification(message, type) {
    // Create a simple notification within the popup
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        padding: 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        text-align: center;
        z-index: 1000;
        animation: slideDown 0.3s ease;
    `;
    
    // Set color based on type
    switch (type) {
        case 'success':
            notification.style.background = '#4CAF50';
            notification.style.color = 'white';
            break;
        case 'warning':
            notification.style.background = '#ff9800';
            notification.style.color = 'white';
            break;
        case 'error':
            notification.style.background = '#f44336';
            notification.style.color = 'white';
            break;
        default:
            notification.style.background = 'rgba(255, 255, 255, 0.9)';
            notification.style.color = '#333';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 2 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 2000);
}

// Add CSS for notification animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);