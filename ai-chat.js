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
        
        // Get Gemini API key and user tasks from storage
        const result = await chrome.storage.local.get(['geminiApiKey', 'userTasks']);
        if (!result.geminiApiKey) {
            throw new Error('Gemini API key not configured. Please set it in extension settings.');
        }
        
        // Get current whitelist for context
        const whitelistResponse = await chrome.runtime.sendMessage({ type: 'GET_WHITELIST' });
        
        // Simplified prompt that works better with Gemini
        const systemPrompt = `You are helping manage website access. User wants to access: ${window.location.href}

Current context:
- Site: ${window.location.hostname}
- Page title: ${document.title || 'Unknown'}
- User tasks: ${result.userTasks || 'No specific tasks defined'}
- Current whitelist includes: ${(whitelistResponse.whitelist || []).length} sites

User message: ${userMessage}

Please respond as a helpful assistant. If you think access should be granted, respond EXACTLY in this JSON format:
{"message": "your response", "decision": {"type": "permanent_whitelist|allow_once|allow_temporary|deny", "scope": "domain|page", "duration": 3600000, "reasoning": "your reason"}}

If you need more information, just respond with:
{"message": "your question to the user", "decision": null}

Types:
- permanent_whitelist: add to permanent whitelist
- allow_once: allow until tab closed  
- allow_temporary: allow for specific time (include duration in milliseconds)
- deny: block access

Scope:
- domain: entire domain (${window.location.hostname})
- page: just this specific page`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${result.geminiApiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
    
    // Make functions globally available if needed
    window.focusExtensionChat = {
        openAIChat,
        closeAIChat,
        sendMessage
    };
})();