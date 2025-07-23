// AI Chat functionality for blocked pages
(function() {
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        console.log("AI Initialized!")
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
                console.log("In cooldown!")
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
        console.log("Opening chat...")
        const overlay = document.getElementById('chatOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            initializeAIChat();
        }
    }
    
    function closeAIChat() {
        console.log("Closing chat...")
        const overlay = document.getElementById('chatOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    async function initializeAIChat() {
        console.log("Init chat...")
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            
            // Add initial AI message
            addMessage('ai', 'Hello! I see you want to access ' + window.location.hostname + '. Can you tell me why you need to visit this site?');
        }
    }
    
    function addMessage(sender, content) {
        console.log("Adding messege...")
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'focus-message ' + sender;
        messageDiv.textContent = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    async function sendMessage() {
        console.log("Sending messege...")
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
        console.log("Sending response...")
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
        console.log("Handling AI decision...")
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
