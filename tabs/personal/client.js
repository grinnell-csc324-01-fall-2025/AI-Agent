// State
let isAuthenticated = false;
let chatHistory = [];
let isLoading = false;

// Icon helper - returns Lucide icon HTML
function icon(name, className = '') {
    return `<i data-lucide="${name}" class="${className}"></i>`;
}

// Reinitialize icons after dynamic content is added
function refreshIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const signinOverlay = document.getElementById('signin-overlay');
const quickActions = document.getElementById('quick-actions');

// Navigation
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        
        // Update nav
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}-view`).classList.add('active');
        
        // Load data for view
        if (isAuthenticated) {
            if (view === 'files') loadFiles();
            if (view === 'mail') loadMail();
            if (view === 'tasks') loadTasks();
        }
    });
});

// Current user data
let currentUser = null;

// Auth Check
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/status', { credentials: 'include' });
        if (!res.ok) {
            updateProfileMenu(false, null);
            return false;
        }
        
        const data = await res.json();
        if (data.authenticated && data.user) {
            isAuthenticated = true;
            currentUser = data.user;
            
            // Update avatar
            const avatar = document.getElementById('avatar');
            if (data.user.picture) {
                avatar.style.backgroundImage = `url(${data.user.picture})`;
            }
            
            // Update profile menu
            updateProfileMenu(true, data.user);
            
            signinOverlay.classList.remove('show');
            return true;
        }
    } catch (e) {
        console.error('Auth check failed:', e);
    }
    
    isAuthenticated = false;
    currentUser = null;
    updateProfileMenu(false, null);
    signinOverlay.classList.add('show');
    return false;
}

// Profile Menu Functions
function toggleProfileMenu() {
    const menu = document.getElementById('profile-menu');
    menu.classList.toggle('show');
}

function closeProfileMenu() {
    const menu = document.getElementById('profile-menu');
    menu.classList.remove('show');
}

function updateProfileMenu(authenticated, user) {
    const menuAvatar = document.getElementById('profile-menu-avatar');
    const menuName = document.getElementById('profile-menu-name');
    const menuEmail = document.getElementById('profile-menu-email');
    const menuItems = document.getElementById('profile-menu-items');
    const userStatus = document.getElementById('user-status');
    
    if (authenticated && user) {
        // Signed in state
        if (user.picture) {
            menuAvatar.style.backgroundImage = `url(${user.picture})`;
        }
        menuName.textContent = user.name || 'User';
        menuEmail.textContent = user.email || '';
        userStatus.classList.remove('offline');
        
        menuItems.innerHTML = `
            <button class="profile-menu-item" onclick="viewProfile()">
                ${icon('user')} View Profile
            </button>
            <button class="profile-menu-item" onclick="openSettings()">
                ${icon('settings')} Settings
            </button>
            <div class="profile-menu-divider" style="margin: 8px 0;"></div>
            <button class="profile-menu-item danger" onclick="signOut()">
                ${icon('log-out')} Sign Out
            </button>
        `;
    } else {
        // Signed out state
        menuAvatar.style.backgroundImage = '';
        menuName.textContent = 'Guest';
        menuEmail.textContent = 'Not signed in';
        userStatus.classList.add('offline');
        
        menuItems.innerHTML = `
            <button class="profile-menu-item" onclick="signIn()">
                ${icon('log-in')} Sign In with Google
            </button>
        `;
    }
    
    refreshIcons();
}

function signIn() {
    closeProfileMenu();
    window.location.href = '/auth/signin';
}

function signOut() {
    closeProfileMenu();
    window.location.href = '/auth/signout';
}

function viewProfile() {
    closeProfileMenu();
    // For now, just show an alert
    if (currentUser) {
        alert(`Profile\n\nName: ${currentUser.name}\nEmail: ${currentUser.email}`);
    }
}

function openSettings() {
    closeProfileMenu();
    alert('Settings coming soon!');
}

// Close profile menu when clicking outside
document.addEventListener('click', (e) => {
    const profileMenu = document.getElementById('profile-menu');
    const avatar = document.getElementById('avatar');
    
    if (profileMenu && !profileMenu.contains(e.target) && e.target !== avatar) {
        closeProfileMenu();
    }
});

// Chat Functions
async function sendMessage(content) {
    if (!content.trim() || isLoading) return;
    
    // Add user message
    addMessage('user', content);
    chatHistory.push({ role: 'user', content });
    
    // Clear input
    chatInput.value = '';
    autoResize(chatInput);
    
    // Show typing indicator
    const typingEl = showTyping();
    isLoading = true;
    sendBtn.disabled = true;
    
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                messages: chatHistory,
                includeContext: true
            })
        });
        
        if (!res.ok) {
            if (res.status === 401) {
                signinOverlay.classList.add('show');
                throw new Error('Please sign in to continue');
            }
            throw new Error('Failed to get response');
        }
        
        const data = await res.json();
        
        // Remove typing indicator
        typingEl.remove();
        
        // Add assistant message
        addMessage('assistant', data.response);
        chatHistory.push({ role: 'assistant', content: data.response });
        
    } catch (error) {
        typingEl.remove();
        addMessage('assistant', `Sorry, I encountered an error: ${error.message}`);
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
    }
}

function addMessage(role, content) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    
    const avatar = role === 'assistant' ? icon('bot') : icon('user');
    
    // Parse markdown-like formatting
    const formattedContent = formatMessage(content);
    
    div.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">${formattedContent}</div>
    `;
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    refreshIcons();
}

function formatMessage(text) {
    // Simple markdown parsing
    let html = text
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Wrap in paragraph if not already
    if (!html.startsWith('<')) {
        html = `<p>${html}</p>`;
    }
    
    return html;
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.innerHTML = `
        <div class="message-avatar">${icon('bot')}</div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    refreshIcons();
    return div;
}

// Quick Actions
quickActions?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.action-chip');
    if (!btn || isLoading) return;
    
    const action = btn.dataset.action;
    
    switch(action) {
        case 'summary':
            await getDailySummary();
            break;
        case 'tasks':
            await extractTasks();
            break;
        case 'unread':
            sendMessage('Summarize my unread emails');
            break;
        case 'files':
            sendMessage('Show me my recent files');
            break;
    }
});

async function getDailySummary() {
    const typingEl = showTyping();
    isLoading = true;
    
    try {
        const res = await fetch('/api/chat/summary', { credentials: 'include' });
        
        if (!res.ok) {
            if (res.status === 401) {
                signinOverlay.classList.add('show');
                throw new Error('Please sign in');
            }
            throw new Error('Failed to get summary');
        }
        
        const summary = await res.json();
        typingEl.remove();
        
        // Format summary as message
        let content = `**${summary.greeting}**\n\n`;
        
        if (summary.tasks?.length > 0) {
            content += `📋 **${summary.taskCount} Tasks Found:**\n`;
            summary.tasks.slice(0, 5).forEach(task => {
                const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
                content += `${priority} ${task.title}${task.due ? ` (Due: ${task.due})` : ''}\n`;
            });
            content += '\n';
        }
        
        if (summary.emailHighlights?.length > 0) {
            content += `✉️ **Email Highlights:**\n`;
            summary.emailHighlights.forEach(h => content += `• ${h}\n`);
            content += '\n';
        }
        
        if (summary.suggestions?.length > 0) {
            content += `💡 **Suggestions:**\n`;
            summary.suggestions.forEach(s => content += `• ${s}\n`);
        }
        
        addMessage('assistant', content);
        
    } catch (error) {
        typingEl.remove();
        addMessage('assistant', `Sorry, I couldn't generate a summary: ${error.message}`);
    } finally {
        isLoading = false;
    }
}

async function extractTasks() {
    const typingEl = showTyping();
    isLoading = true;
    
    try {
        const res = await fetch('/api/chat/tasks', { credentials: 'include' });
        
        if (!res.ok) {
            if (res.status === 401) {
                signinOverlay.classList.add('show');
                throw new Error('Please sign in');
            }
            throw new Error('Failed to extract tasks');
        }
        
        const data = await res.json();
        typingEl.remove();
        
        if (data.tasks?.length > 0) {
            let content = `📋 **Found ${data.tasks.length} tasks in your emails:**\n\n`;
            
            data.tasks.forEach((task, i) => {
                const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
                content += `${i + 1}. ${priority} **${task.title}**\n`;
                if (task.due) content += `   📅 Due: ${task.due}\n`;
                if (task.source) content += `   📧 Source: ${task.source}\n`;
                content += '\n';
            });
            
            addMessage('assistant', content);
            
            // Also update tasks view
            renderTasksList(data.tasks);
        } else {
            addMessage('assistant', "I didn't find any tasks in your recent emails. Your inbox looks clear! 🎉");
        }
        
    } catch (error) {
        typingEl.remove();
        addMessage('assistant', `Sorry, I couldn't extract tasks: ${error.message}`);
    } finally {
        isLoading = false;
    }
}

// Tasks View
async function loadTasks() {
    const container = document.getElementById('tasks-list');
    container.innerHTML = '<div class="loading-state"><div class="loader"></div><p>Loading tasks...</p></div>';
    
    try {
        const res = await fetch('/api/chat/tasks', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load tasks');
        
        const data = await res.json();
        renderTasksList(data.tasks || []);
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon('alert-triangle')}</span><p>Failed to load tasks</p></div>`;
        refreshIcons();
    }
}

function renderTasksList(tasks) {
    const container = document.getElementById('tasks-list');
    
    if (!tasks.length) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">${icon('check-square')}</span>
                <p>No tasks found</p>
                <p class="empty-hint">Click "Extract from Emails" to find tasks</p>
            </div>
        `;
        refreshIcons();
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="task-item">
            <div class="task-priority ${task.priority}"></div>
            <div class="task-content">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-meta">
                    ${task.due ? `<span class="task-due">${icon('calendar')} ${task.due}</span>` : ''}
                    ${task.source ? `<span class="task-source">${icon('mail')} ${escapeHtml(task.source)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    refreshIcons();
}

// Files View
async function loadFiles() {
    const container = document.getElementById('files-list');
    container.innerHTML = '<div class="loading-state"><div class="loader"></div><p>Loading files...</p></div>';
    
    try {
        const res = await fetch('/api/files', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load files');
        
        const data = await res.json();
        const files = data.files || [];
        const isMock = data.mock === true;
        
        if (!files.length) {
            container.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon('folder-open')}</span><p>No recent files</p></div>`;
            refreshIcons();
            return;
        }
        
        let html = files.map(file => `
            <a href="${file.webViewLink || '#'}" target="_blank" class="file-card" rel="noopener">
                <div class="file-icon">${getFileIcon(file.mimeType)}</div>
                <div class="file-info">
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    <div class="file-type">${getFileType(file.mimeType)}</div>
                </div>
            </a>
        `).join('');
        
        // Add demo notice if using mock data
        if (isMock) {
            html += `
                <div class="files-demo-notice">
                    ${icon('info')}
                    <span>Showing demo files. Connect your Google Drive for real files.</span>
                </div>
            `;
        }
        
        container.innerHTML = html;
        refreshIcons();
    } catch (e) {
        console.error('Failed to load files:', e);
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon('alert-triangle')}</span><p>Failed to load files</p></div>`;
        refreshIcons();
    }
}

function getFileIcon(mimeType) {
    if (!mimeType) return icon('file');
    if (mimeType.includes('document')) return icon('file-text');
    if (mimeType.includes('spreadsheet')) return icon('file-spreadsheet');
    if (mimeType.includes('presentation')) return icon('presentation');
    if (mimeType.includes('image')) return icon('image');
    if (mimeType.includes('pdf')) return icon('file-text');
    if (mimeType.includes('folder')) return icon('folder');
    return icon('file');
}

function getFileType(mimeType) {
    if (!mimeType) return 'File';
    if (mimeType.includes('document')) return 'Document';
    if (mimeType.includes('spreadsheet')) return 'Spreadsheet';
    if (mimeType.includes('presentation')) return 'Presentation';
    if (mimeType.includes('image')) return 'Image';
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('folder')) return 'Folder';
    return 'File';
}

// Mail View
async function loadMail() {
    const container = document.getElementById('mail-list');
    const countEl = document.getElementById('mail-count');
    const paginationEl = document.getElementById('mail-pagination');
    const demoNotice = document.getElementById('mail-demo-notice');
    
    container.innerHTML = '<div class="loading-state"><div class="loader"></div><p>Loading messages...</p></div>';
    if (demoNotice) demoNotice.style.display = 'none';
    
    try {
        const res = await fetch('/api/messages', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load messages');
        
        const data = await res.json();
        const messages = data.messages || [];
        const isMock = data.mock === true;
        
        // Update count and pagination
        if (countEl) countEl.textContent = `${messages.length} messages`;
        if (paginationEl) paginationEl.textContent = `1-${messages.length} of ${messages.length}`;
        
        // Show demo notice if using mock data
        if (demoNotice && isMock) {
            demoNotice.style.display = 'flex';
        }
        
        if (!messages.length) {
            container.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon('inbox')}</span><p>No messages</p></div>`;
            refreshIcons();
            return;
        }
        
        container.innerHTML = messages.map((msg, index) => {
            const subject = msg.payload?.headers?.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const fromRaw = msg.payload?.headers?.find(h => h.name === 'From')?.value || 'Unknown';
            const dateRaw = msg.payload?.headers?.find(h => h.name === 'Date')?.value;
            const snippet = msg.snippet || '';
            const isUnread = msg.labelIds?.includes('UNREAD') || false;
            const isStarred = msg.labelIds?.includes('STARRED') || false;
            
            // Parse sender name and email
            const senderMatch = fromRaw.match(/^([^<]+)?<?([^>]+)?>?$/);
            const senderName = senderMatch?.[1]?.trim() || senderMatch?.[2] || fromRaw;
            const senderInitial = senderName.charAt(0).toUpperCase();
            
            // Format date
            const formattedDate = formatMailDate(dateRaw);
            
            // Assign avatar color based on sender
            const colorIndex = (senderName.charCodeAt(0) % 5) + 1;
            
            return `
                <div class="mail-item ${isUnread ? 'unread' : ''}" data-id="${msg.id}">
                    <div class="mail-checkbox"></div>
                    <button class="mail-star ${isStarred ? 'starred' : ''}" onclick="toggleStar(this, event)">
                        ${icon(isStarred ? 'star' : 'star')}
                    </button>
                    <div class="mail-avatar color-${colorIndex}">${senderInitial}</div>
                    <div class="mail-content">
                        <div class="mail-header">
                            <span class="mail-sender">${escapeHtml(senderName)}</span>
                        </div>
                        <div class="mail-subject">
                            ${escapeHtml(subject)}
                            <span class="mail-separator">-</span>
                            <span class="mail-snippet">${escapeHtml(snippet.substring(0, 100))}</span>
                        </div>
                    </div>
                    <span class="mail-date">${formattedDate}</span>
                    <div class="mail-actions">
                        <button class="mail-action-btn" onclick="archiveEmail('${msg.id}', event)" title="Archive">
                            ${icon('archive')}
                        </button>
                        <button class="mail-action-btn" onclick="deleteEmail('${msg.id}', event)" title="Delete">
                            ${icon('trash-2')}
                        </button>
                        <button class="mail-action-btn" onclick="summarizeEmail('${msg.id}', this)" title="Summarize with AI">
                            ${icon('sparkles')}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        refreshIcons();
    } catch (e) {
        console.error('Failed to load mail:', e);
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon('alert-triangle')}</span><p>Failed to load messages</p></div>`;
        refreshIcons();
    }
}

// Format mail date like Gmail
function formatMailDate(dateStr) {
    if (!dateStr) return '';
    
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // Today - show time
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            // This week - show day name
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else if (date.getFullYear() === now.getFullYear()) {
            // This year - show month and day
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
            // Older - show full date
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    } catch (e) {
        return '';
    }
}

// Toggle star on email
function toggleStar(btn, event) {
    event.stopPropagation();
    btn.classList.toggle('starred');
    refreshIcons();
}

// Archive email (placeholder)
function archiveEmail(emailId, event) {
    event.stopPropagation();
    const item = document.querySelector(`.mail-item[data-id="${emailId}"]`);
    if (item) {
        item.style.opacity = '0.5';
        item.style.transform = 'translateX(100px)';
        setTimeout(() => item.remove(), 300);
    }
}

// Delete email (placeholder)
function deleteEmail(emailId, event) {
    event.stopPropagation();
    const item = document.querySelector(`.mail-item[data-id="${emailId}"]`);
    if (item) {
        item.style.opacity = '0.5';
        item.style.transform = 'translateX(-100px)';
        setTimeout(() => item.remove(), 300);
    }
}

async function summarizeEmail(emailId, btn) {
    const originalText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;
    
    try {
        const res = await fetch('/api/chat/summarize-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ emailId })
        });
        
        if (!res.ok) throw new Error('Failed to summarize');
        
        const data = await res.json();
        
        // Switch to chat view and show summary
        document.querySelector('[data-view="chat"]').click();
        addMessage('assistant', `**Email Summary:**\n\n${data.summary}`);
        
    } catch (e) {
        alert('Failed to summarize email');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Utility Functions
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[<>&"']/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// Event Listeners
chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(chatInput.value);
    }
});

chatInput?.addEventListener('input', () => autoResize(chatInput));

sendBtn?.addEventListener('click', () => sendMessage(chatInput.value));

document.getElementById('extract-tasks-btn')?.addEventListener('click', extractTasks);
document.getElementById('refresh-files-btn')?.addEventListener('click', loadFiles);
document.getElementById('refresh-mail-btn')?.addEventListener('click', loadMail);

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const authenticated = await checkAuth();
    
    // Always preload data - API returns mock data when not authenticated or on error
    // This ensures the demo works even without signing in
    loadFiles();
    loadMail();
});

// Make functions global for onclick handlers
window.summarizeEmail = summarizeEmail;
window.toggleStar = toggleStar;
window.archiveEmail = archiveEmail;
window.deleteEmail = deleteEmail;
window.toggleProfileMenu = toggleProfileMenu;
window.closeProfileMenu = closeProfileMenu;
window.signIn = signIn;
window.signOut = signOut;
window.viewProfile = viewProfile;
window.openSettings = openSettings;
