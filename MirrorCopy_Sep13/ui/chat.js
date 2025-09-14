let currentChatId = null;

function getChatHistory() { return JSON.parse(localStorage.getItem('chatHistory') || '[]'); }
function saveChatHistory(history) { localStorage.setItem('chatHistory', JSON.stringify(history)); }

function showThinkingIndicator() {
    const chatLog = document.getElementById('chat-log');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('self-start');
    const loader = document.createElement('div');
    loader.className = 'eleva-loader';
    const svgRing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgRing.setAttribute('class', 'eleva-ring');
    svgRing.setAttribute('viewBox', '0 0 50 50');
    svgRing.innerHTML = `<defs><linearGradient id="elevaGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0096C7"/><stop offset="40%" stop-color="#48CAE4"/><stop offset="70%" stop-color="#90E0EF"/><stop offset="100%" stop-color="#CAF0F8"/></linearGradient></defs><circle class="path" cx="25" cy="25" r="20" fill="none" stroke="url(#elevaGradient)" stroke-width="4"/>`;
    const icon = document.createElement('img');
    icon.className = 'eleva-icon';
    icon.src = 'images/ElevaAI_short_logo.svg';
    icon.alt = 'Eleva AI';
    loader.appendChild(svgRing);
    loader.appendChild(icon);
    messageDiv.appendChild(loader);
    chatLog.appendChild(messageDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
    return messageDiv;
}

// ## MODIFICATION START ##
function addMessageToLog(message, sender) {
    const chatLog = document.getElementById('chat-log');
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('p-3', 'rounded-lg', 'max-w-xs', 'lg:max-w-4xl', 'break-words');
    messageContainer.classList.add(sender === 'user' ? 'user-message' : 'assistant-message');

    if (sender === 'assistant') {
        // Use Marked to parse Markdown and DOMPurify to sanitize the result for security
        const dirtyHtml = marked.parse(message);
        messageContainer.innerHTML = DOMPurify.sanitize(dirtyHtml);
    } else {
        // User messages are always plain text
        messageContainer.textContent = message;
    }
    
    chatLog.appendChild(messageContainer);
    chatLog.scrollTop = chatLog.scrollHeight;
}
// ## MODIFICATION END ##

function handleChatSubmit(renderChatHistoryFunc) {
    const chatInput = document.getElementById('chat-input');
    const chatWelcome = document.getElementById('chat-welcome');
    const chatLog = document.getElementById('chat-log');
    const chatSection = document.getElementById('chat-section');

    const userMessage = chatInput.value.trim();
    if (!userMessage) return;
    
    chatWelcome.classList.add('hidden');
    chatLog.classList.remove('hidden');
    chatSection.classList.remove('is-new-chat');
    addMessageToLog(userMessage, 'user');
    chatInput.value = '';
    const thinkingIndicator = showThinkingIndicator();
    
    let history = getChatHistory();
    let currentChat;

    if (currentChatId === null) {
        currentChatId = `chat-${new Date().getTime()}`;
        const newChat = { 
            id: currentChatId, 
            title: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : ''), 
            messages: [{ sender: 'user', text: userMessage }] 
        };
        history.unshift(newChat);
        currentChat = newChat;
        renderChatHistoryFunc();
    } else {
        currentChat = history.find(c => c.id === currentChatId);
        if (currentChat) {
            currentChat.messages.push({ sender: 'user', text: userMessage });
        }
    }
    saveChatHistory(history); 

    const historyForApi = currentChat.messages
        .slice(0, -1) 
        .map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

    fetch('http://127.0.0.1:5000/api/chat', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            message: userMessage, 
            history: historyForApi
        })
    })
    .then(response => response.json())
    .then(data => {
        thinkingIndicator.remove();
        const assistantMessageText = data.data || data.response;
        addMessageToLog(assistantMessageText, 'assistant');

        if (currentChat) {
            currentChat.messages.push({ sender: 'assistant', text: assistantMessageText, data: data });
            saveChatHistory(history); 
        }
    })
    .catch(error => {
        thinkingIndicator.remove();
        console.error('Error with chat API:', error);
        addMessageToLog('Sorry, I had trouble connecting.', 'assistant');
    });
}

function deleteChat(chatId, renderChatHistoryFunc) {
    let history = getChatHistory();
    saveChatHistory(history.filter(chat => chat.id !== chatId));
    renderChatHistoryFunc();
    if (currentChatId === chatId) startNewChat();
}

function loadChat(chatId, showChatView) {
    const chatLog = document.getElementById('chat-log');
    const chatWelcome = document.getElementById('chat-welcome');
    const chatSection = document.getElementById('chat-section');
    const chat = getChatHistory().find(c => c.id === chatId);
    if (chat) {
        currentChatId = chatId;
        chatLog.innerHTML = '';
        chat.messages.forEach(msg => addMessageToLog(msg.text, msg.sender, msg.data));
        chatWelcome.classList.add('hidden');
        chatLog.classList.remove('hidden');
        chatSection.classList.remove('is-new-chat');
        showChatView();
    }
}

export function startNewChat() {
    const chatLog = document.getElementById('chat-log');
    const chatWelcome = document.getElementById('chat-welcome');
    const chatSection = document.getElementById('chat-section');
    currentChatId = null;
    chatLog.innerHTML = '';
    chatLog.classList.add('hidden');
    chatWelcome.classList.remove('hidden');
    chatSection.classList.add('is-new-chat');
}

function renderChatHistory(showChatView) {
    const chatHistoryList = document.getElementById('chat-history-list');
    const history = getChatHistory();
    chatHistoryList.innerHTML = '';
    history.forEach(chat => {
        const historyItem = document.createElement('div');
        historyItem.classList.add('group', 'flex', 'items-center', 'justify-between', 'p-2', 'text-sm', 'hover:bg-gray-300', 'rounded', 'cursor-pointer');
        historyItem.setAttribute('data-chat-id', chat.id);
        historyItem.addEventListener('click', () => loadChat(chat.id, showChatView));
        const title = document.createElement('span');
        title.classList.add('truncate');
        title.textContent = chat.title;
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('opacity-0', 'group-hover:opacity-100', 'p-1', 'rounded-md', 'hover:bg-gray-400', 'z-10');
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
        deleteBtn.addEventListener('click', (event) => { 
            event.stopPropagation(); 
            deleteChat(chat.id, () => renderChatHistory(showChatView)); 
        });
        historyItem.appendChild(title);
        historyItem.appendChild(deleteBtn);
        chatHistoryList.appendChild(historyItem);
    });
}

export function initChat(showChatView) {
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    
    chatSendBtn.addEventListener('click', () => handleChatSubmit(() => renderChatHistory(showChatView)));
    chatInput.addEventListener('keydown', (event) => { 
        if (event.key === 'Enter') handleChatSubmit(() => renderChatHistory(showChatView)); 
    });
    
    renderChatHistory(showChatView);
}