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
        const res = await fetch(`/api/${route}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error(`Error fetching ${endpoint}:`, e);
        return null;
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
document.addEventListener('DOMContentLoaded', () => {
    loadDrive();
    loadGmail();

    // Bind refresh buttons
    document.querySelectorAll('.refresh-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.closest('section');
            if (section.id === 'drive-view') loadDrive();
            if (section.id === 'gmail-view') loadGmail();
        });
    });
});
