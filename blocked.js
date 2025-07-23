// Standalone blocked page script
(function() {
    // Stop the page from loading
    if (document.readyState === 'loading') {
        window.stop();
    }
    
    // Replace page content with blocked message
    document.documentElement.innerHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Site Blocked - Focus Extension</title>
            <link rel="stylesheet" href="${chrome.runtime.getURL('styles.css')}">
        </head>
        <body>
            <div class="focus-extension-blocked-overlay">
                <div class="focus-blocked-container">
                    <div class="focus-blocked-icon">🛡️</div>
                    <h1 class="focus-blocked-title">Site Blocked</h1>
                    <p class="focus-blocked-message">This website is currently blocked by Focus Extension. You can request access through AI assistance.</p>
                    <div class="focus-blocked-url">${window.location.href}</div>
                    
                    <div id="cooldownMessage" class="focus-cooldown-message" style="display: none;">
                        This site was recently denied access. AI chat is temporarily unavailable.
                    </div>
                    
                    <div id="actionButtons">
                        <button id="aiChatButton" class="focus-ai-chat-button">🤖 Request Access with AI</button>
                        <br>
                        <button id="backButton" class="focus-back-button">← Go Back</button>
                    </div>
                </div>
                
                <div id="chatOverlay" class="focus-chat-overlay">
                    <div class="focus-chat-container">
                        <div class="focus-chat-header">
                            AI Access Assistant
                            <button class="focus-close-chat" id="closeChat">×</button>
                        </div>
                        <div id="chatMessages" class="focus-chat-messages"></div>
                        <div class="focus-chat-input-container">
                            <input type="text" id="chatInput" class="focus-chat-input" placeholder="Explain why you need access to this site...">
                            <button id="sendMessage" class="focus-send-button">Send</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <script src="${chrome.runtime.getURL('ai-chat.js')}"></script>
        </body>
        </html>
    `;
})();