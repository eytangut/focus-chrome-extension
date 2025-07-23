// AI Chat functionality for blocked pages
(function() {
    let conversationHistory = [];
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    function initialize() {
        // Check if in cooldown
        checkCooldownStatus();
        
        // Event listeners
        const aiButton = document.getElementById('aiChatButton');
        const backButton = document.getElementById('backButton');
        const closeChat = document.getElementById('closeChat');
        const sendButton = document.getElementById('sendMessage');
        const chatInput = document.getElementById('chatInput');
        
        if (aiButton) aiButton.addEventListener('click', openAIChat);
        if (backButton) backButton.addEventListener('click', () => window.history.back());
        if (closeChat) closeChat.addEventListener('click', closeAIChat);
        if (sendButton) sendButton.addEventListener('click', sendMessage);
        if (chatInput) {
            chatInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') sendMessage();
            });
        }
    }
    
    async function checkCooldownStatus() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_COOLDOWN_STATUS',
                url: window.location.href
            });
            
            if (response && response.inCooldown) {
                const cooldownMsg = document.getElementById('cooldownMessage');
                const aiButton = document.getElementById('aiChatButton');
                
                if (cooldownMsg) cooldownMsg.style.display = 'block';
                if (aiButton) {
                    aiButton.disabled = true;
                    aiButton.textContent = '🚫 AI Chat Unavailable (Cooldown)';
                }
            }
        } catch (error) {
            console.error('Error checking cooldown status:', error);
        }
    }
    
    function openAIChat() {
        const overlay = document.getElementById('chatOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            initializeAIChat();
        }
    }
    
    function closeAIChat() {
        const overlay = document.getElementById('chatOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    async function initializeAIChat() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            
            // Add initial AI message
            addMessage('ai', 'Hello! I see you want to access ' + window.location.hostname + '. Can you tell me why you need to visit this site?');
        }
        
        conversationHistory = [{
            role: 'system',
            content: 'You are an AI assistant helping users manage website access. The user wants to access: ' + window.location.href + '. Your job is to understand their reasoning and decide whether to grant access. You can: 1) Add to permanent whitelist (domain or page), 2) Allow once until tab closed (domain or page), 3) Allow temporarily for a time period (domain or page), 4) Deny request. Be conversational but focused on understanding their need.'
        }];
    }
    
    function addMessage(sender, content) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'focus-message ' + sender;
        messageDiv.textContent = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    async function sendMessage() {
        const input = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendMessage');
        
        if (!input || !sendButton) return;
        
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
        // Add user message to conversation history
        conversationHistory.push({
            role: 'user',
            content: userMessage
        });
        
        // Get Gemini API key from storage
        const result = await chrome.storage.local.get(['geminiApiKey']);
        if (!result.geminiApiKey) {
            throw new Error('Gemini API key not configured. Please set it in extension settings.');
        }
        
        // Get current whitelist for context
        const whitelistResponse = await chrome.runtime.sendMessage({ type: 'GET_WHITELIST' });
        
        const systemContext = {
            role: 'system',
            content: `You are managing access to: ${window.location.href}
Current whitelist: ${JSON.stringify(whitelistResponse.whitelist)}
Page title: ${document.title || 'Unknown'}

Based on the conversation, decide if you should grant access. Respond with a JSON object containing:
{
  "message": "Your conversational response to the user",
  "decision": null OR {
    "type": "permanent_whitelist" | "allow_once" | "allow_temporary" | "deny",
    "scope": "domain" | "page",
    "duration": milliseconds (only for allow_temporary),
    "reasoning": "Your reasoning for this decision"
  }
}

Only make a decision when you have enough information. Ask follow-up questions if needed.`
        };
        
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + result.geminiApiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: systemContext.content + '\n\nConversation:\n' + 
                              conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')
                    }]
                }]
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to get AI response: ' + response.statusText);
        }
        
        const data = await response.json();
        const aiMessage = data.candidates[0].content.parts[0].text;
        
        // Try to parse as JSON, fallback to plain text
        try {
            return JSON.parse(aiMessage);
        } catch {
            return { message: aiMessage, decision: null };
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
    
    // Make functions globally available if needed
    window.focusExtensionChat = {
        openAIChat,
        closeAIChat,
        sendMessage
    };
})();