// Navigation
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        // Update buttons
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update views
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(`${tab}-view`).classList.add('active');
    });
});

// API Client
async function fetchData(endpoint) {
    try {
        // Map 'drive' to 'files' and 'gmail' to 'messages' to match server routes
        const route = endpoint === 'drive' ? 'files' : endpoint === 'gmail' ? 'messages' : endpoint;
        const res = await fetch(`/api/${route}`, {
            credentials: 'include' // Include cookies for session
        });
        
        // Handle 401 Unauthorized - show sign-in prompt instead of redirecting
        if (res.status === 401) {
            showSignInPrompt();
            return null;
        }
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error(`Error fetching ${endpoint}:`, e);
        return null;
    }
}

// Check authentication status (non-blocking)
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/status', {
            credentials: 'include',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!res.ok) {
            updateUserMenu(false);
            return null;
        }
        
        const data = await res.json();
        
        if (!data.authenticated) {
            updateUserMenu(false);
            return null;
        }
        
        console.log('Authenticated as:', data.user?.email);
        
        // Display user info if available
        if (data.user) {
            const avatar = document.querySelector('.user-profile .avatar');
            if (avatar && data.user.picture) {
                avatar.style.backgroundImage = `url(${data.user.picture})`;
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
            }
        }
        
        updateUserMenu(true);
        return data.user;
    } catch (e) {
        console.error('Error checking auth:', e);
        updateUserMenu(false);
        return null;
    }
}

// Update user menu based on authentication status
function updateUserMenu(isAuthenticated) {
    const signInBtn = document.getElementById('sign-in-btn');
    const signOutBtn = document.getElementById('sign-out-btn');
    
    if (isAuthenticated) {
        signInBtn.style.display = 'none';
        signOutBtn.style.display = 'block';
    } else {
        signInBtn.style.display = 'block';
        signOutBtn.style.display = 'none';
    }
}

// Toggle user menu
function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    menu.classList.toggle('show');
}

// Close user menu when clicking outside
function closeUserMenu(event) {
    const menu = document.getElementById('user-menu');
    const avatar = document.getElementById('avatar-btn');
    
    if (menu && avatar && !menu.contains(event.target) && !avatar.contains(event.target)) {
        menu.classList.remove('show');
    }
}

// Show sign-in prompt instead of redirecting
function showSignInPrompt() {
    const welcomeCard = document.querySelector('.welcome-card');
    if (welcomeCard) {
        welcomeCard.innerHTML = `
            <h1>Welcome to AI Agent</h1>
            <p>Sign in with Google to view your Gmail messages and Drive files.</p>
            <button onclick="window.location.href='/auth/signin'" style="
                margin-top: 20px;
                padding: 12px 24px;
                background: var(--accent-color);
                color: var(--bg-color);
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                Sign in with Google
            </button>
        `;
    }
    
    // Show empty states for files and messages
    const filesContainer = document.getElementById('dashboard-files');
    const messagesContainer = document.getElementById('dashboard-messages');
    if (filesContainer) {
        filesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#888">Sign in to view your files</div>';
    }
    if (messagesContainer) {
        messagesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#888">Sign in to view your messages</div>';
    }
}

// Render Functions
function renderFileItem(file) {
    // Sanitize inputs
    const safeName = (file.name || '').replace(/[<>&"']/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
    const safeLink = file.webViewLink || '#';

    return `
        <a href="${safeLink}" target="_blank" class="list-item" rel="noopener noreferrer">
            <div class="item-icon">📄</div>
            <div class="item-details">
                <div class="item-title">${safeName}</div>
                <div class="item-subtitle">Google Drive</div>
            </div>
        </a>
    `;
}

function renderMessageItem(msg) {
    const subject = msg.payload.headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
    const from = msg.payload.headers.find(h => h.name === 'From')?.value || 'Unknown';

    // Sanitize inputs
    const safeSubject = subject.replace(/[<>&"']/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
    const safeFrom = from.replace(/[<>&"']/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));

    return `
        <a href="https://mail.google.com/mail/u/0/#inbox/${msg.id}" target="_blank" class="list-item" rel="noopener noreferrer">
            <div class="item-icon">✉️</div>
            <div class="item-details">
                <div class="item-title">${safeSubject}</div>
                <div class="item-subtitle">${safeFrom}</div>
            </div>
        </a>
    `;
}

// Load Data
async function loadDrive() {
    const container = document.getElementById('drive-list');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await fetchData('drive');
    // Server returns { files: [...] }
    const files = data?.files || [];

    if (files.length) {
        container.innerHTML = files.map(renderFileItem).join('');
        // Also update dashboard
        const dashboardContainer = document.getElementById('dashboard-files');
        if (dashboardContainer) {
            dashboardContainer.innerHTML = files.slice(0, 5).map(renderFileItem).join('');
        }
    } else {
        const emptyState = '<div style="text-align:center; padding:20px; color:#888">No files found</div>';
        container.innerHTML = emptyState;
        const dashboardContainer = document.getElementById('dashboard-files');
        if (dashboardContainer) {
            dashboardContainer.innerHTML = emptyState;
        }
    }
}

async function loadGmail() {
    const container = document.getElementById('gmail-list');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await fetchData('gmail');
    // Server returns { messages: [...] }
    const messages = data?.messages || [];

    if (messages.length) {
        container.innerHTML = messages.map(renderMessageItem).join('');
        // Also update dashboard
        const dashboardContainer = document.getElementById('dashboard-messages');
        if (dashboardContainer) {
            dashboardContainer.innerHTML = messages.slice(0, 5).map(renderMessageItem).join('');
        }
    } else {
        const emptyState = '<div style="text-align:center; padding:20px; color:#888">No messages found</div>';
        container.innerHTML = emptyState;
        const dashboardContainer = document.getElementById('dashboard-messages');
        if (dashboardContainer) {
            dashboardContainer.innerHTML = emptyState;
        }
    }
}

// Initial Load & Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication (non-blocking)
    const user = await checkAuth();
    
    if (user) {
        // User is authenticated - load their data
        loadDrive();
        loadGmail();
    } else {
        // User is not authenticated - show sign-in prompt
        showSignInPrompt();
    }

    // Avatar click handler
    const avatarBtn = document.getElementById('avatar-btn');
    if (avatarBtn) {
        avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserMenu();
        });
    }

    // Sign in button handler
    const signInBtn = document.getElementById('sign-in-btn');
    if (signInBtn) {
        signInBtn.addEventListener('click', () => {
            window.location.href = '/auth/signin';
        });
    }

    // Sign out button handler
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            // Navigate to signout endpoint - server will handle redirect
            window.location.href = '/auth/signout';
        });
    }

    // Close menu when clicking outside
    document.addEventListener('click', closeUserMenu);

    // Bind refresh buttons
    document.querySelectorAll('.refresh-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.closest('section');
            if (section.id === 'drive-view') {
                // Check auth before loading
                checkAuth().then(user => {
                    if (user) loadDrive();
                    else window.location.href = '/auth/signin';
                });
            }
            if (section.id === 'gmail-view') {
                // Check auth before loading
                checkAuth().then(user => {
                    if (user) loadGmail();
                    else window.location.href = '/auth/signin';
                });
            }
        });
    });
});
