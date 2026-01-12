// --- MOBILE MENU LOGIC ---
function openLeftSidebar() {
    document.getElementById('leftSidebar').classList.add('open');
    document.getElementById('leftOverlay').classList.add('open');
}
function openRightSidebar() {
    document.getElementById('rightSidebar').classList.add('open');
    document.getElementById('rightOverlay').classList.add('open');
}
function closeSidebars() {
    document.getElementById('leftSidebar').classList.remove('open');
    document.getElementById('rightSidebar').classList.remove('open');
    document.getElementById('leftOverlay').classList.remove('open');
    document.getElementById('rightOverlay').classList.remove('open');
}

// --- STATE ---
let user = { id: null, name: 'Anon', color: '#3498db' };
let peerProfiles = {}; 
let appData = {}; 
let activeListId = null;
let settings = { autoDelete: false };
let activeFilters = new Set(); // Stores IDs of selected users

let customColors = { "mmk1102": "#000000", "mmk1102x": "#000000", "author": "#000000" };
let peer = null;
let connections = {}; 
let myPeerId = null;

// --- INITIALIZATION ---
const storedId = localStorage.getItem('taskerUserId');
if (storedId) {
    user.id = storedId;
} else {
    user.id = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('taskerUserId', user.id);
}

const storedProfiles = localStorage.getItem('taskerProfiles');
if (storedProfiles) peerProfiles = JSON.parse(storedProfiles);

const savedData = localStorage.getItem('taskerMesh_v4');
if (savedData) {
    appData = JSON.parse(savedData);
    activeListId = Object.keys(appData)[0];
} else {
    const defId = 'team-' + Date.now();
    appData[defId] = { name: 'General', tasks: [] };
    activeListId = defId;
}

const savedSettings = localStorage.getItem('taskerSettings');
if(savedSettings) settings = JSON.parse(savedSettings);
document.getElementById('autoDeleteToggle').checked = settings.autoDelete;

// Fetch Custom Colors
async function loadCustomColors() {
    const url = 'https://raw.githubusercontent.com/mmk1102x/tasker/refs/heads/main/users.json?t=' + Date.now();
    try {
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            for (let key in data) customColors[key.toLowerCase()] = data[key];
            if (user.name) {
                user.color = stringToColor(user.name);
                updateProfileUI();
                renderTasks();
            }
        }
    } catch (e) { console.error("Fetch error:", e); }
}
loadCustomColors();

if (peerProfiles[user.id]) {
    user.name = peerProfiles[user.id].name;
    user.color = peerProfiles[user.id].color; 
    document.getElementById('loginModal').style.display = 'none';
    initApp();
} else {
    document.getElementById('loginModal').style.display = 'flex';
}

// --- THEME & UTILS ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const btn = document.getElementById('themeToggleBtn');
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.body.classList.add('dark-mode');
        btn.innerText = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        btn.innerText = '🌙';
    }
}
initTheme();

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('themeToggleBtn').innerText = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function isLightColor(hex) {
    if(!hex) return false;
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128); 
}

function stringToColor(str) {
    const lower = str.toLowerCase();
    for (let key in customColors) {
        if (lower.includes(key)) return customColors[key];
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + "00000".substring(0, 6 - c.length) + c;
}

// --- PROFILE ---
function submitProfile() {
    const name = document.getElementById('nicknameInput').value.trim();
    if (!name) return alert("Name required");
    user.name = name;
    user.color = stringToColor(name);
    peerProfiles[user.id] = { name: user.name, color: user.color };
    saveProfiles();
    document.getElementById('loginModal').style.display = 'none';
    if (!peer) initApp();
    else {
        updateProfileUI();
        renderTasks();
        broadcastProfile(); 
    }
}

function openProfileModal() {
    document.getElementById('modalTitle').innerText = "Update Profile";
    document.getElementById('nicknameInput').value = user.name;
    document.getElementById('loginModal').style.display = 'flex';
}

function saveProfiles() { localStorage.setItem('taskerProfiles', JSON.stringify(peerProfiles)); }

function updateProfileUI() {
    user.color = stringToColor(user.name);
    const nameEl = document.getElementById('userNameDisplay');
    nameEl.innerText = user.name;
    nameEl.style.color = user.color; 
    nameEl.className = 'user-name-display ' + (isLightColor(user.color) ? 'outline-dark' : 'outline-light');
    const avatar = document.getElementById('userAvatar');
    avatar.style.backgroundColor = user.color;
    avatar.innerText = user.name.charAt(0).toUpperCase();
    avatar.style.color = isLightColor(user.color) ? '#000' : '#fff';
}

function initApp() {
    initNetwork();
    renderSidebar();
    renderTasks();
    updateProfileUI();
    updateUserListUI(); // Initial render of user list
}

function toggleAutoDelete() {
    settings.autoDelete = document.getElementById('autoDeleteToggle').checked;
    localStorage.setItem('taskerSettings', JSON.stringify(settings));
    renderTasks(); 
}

// --- TEAMS ---
function renderSidebar() {
    const listUi = document.getElementById('teamListUi');
    listUi.innerHTML = '';
    Object.keys(appData).forEach(id => {
        const list = appData[id];
        const li = document.createElement('li');
        li.className = `team-item ${id === activeListId ? 'active' : ''}`;
        li.innerText = list.name;
        li.onclick = () => {
            switchTeam(id);
            if(window.innerWidth <= 900) closeSidebars();
        };
        listUi.appendChild(li);
    });
    if(appData[activeListId]) document.getElementById('currentTeamTitle').innerText = appData[activeListId].name;
}

function createNewTeam() {
    const name = prompt("Enter Team Name:");
    if(!name) return;
    const newId = 'team-' + Date.now() + Math.random().toString(36).substr(2, 5);
    appData[newId] = { name: name, tasks: [] };
    saveData(); // FIX: Save immediately so it persists
    switchTeam(newId);
    if(window.innerWidth <= 900) closeSidebars();
}

function switchTeam(id) {
    activeListId = id;
    activeFilters.clear(); // Clear filters when switching teams
    renderSidebar();
    renderTasks();
    updateUserListUI();
}

function deleteCurrentTeam() {
    if(Object.keys(appData).length <= 1) return alert("Cannot delete the last team.");
    if(!confirm("Delete this team?")) return;
    delete appData[activeListId];
    activeListId = Object.keys(appData)[0];
    saveData();
    renderSidebar();
    renderTasks();
    updateUserListUI();
}

// --- USER FILTER LOGIC ---
function toggleUserFilter(userId) {
    if (activeFilters.has(userId)) {
        activeFilters.delete(userId);
    } else {
        activeFilters.add(userId);
    }
    updateUserListUI();
    renderTasks();
}

function updateUserListUI() {
    const listUi = document.getElementById('userFilterList');
    listUi.innerHTML = '';

    // 1. Gather all unique authors from current tasks
    const uniqueUsers = new Map();
    
    // Add Self
    uniqueUsers.set(user.id, { name: user.name, color: user.color, isOnline: true });

    // Add Connected Peers
    Object.keys(connections).forEach(peerId => {
        // We might not know their internal UserID yet, but we know they are connected
        // Ideally we map PeerID -> UserID via profile exchange.
        // For now, we rely on the tasks they sent or profile updates.
        // We iterate peerProfiles to find online ones.
    });

    // Add Authors from Tasks
    if (appData[activeListId]) {
        appData[activeListId].tasks.forEach(task => {
            const info = getAuthorDetails(task);
            const uid = task.authorId || task.author; // Fallback for old tasks
            if (!uniqueUsers.has(uid)) {
                uniqueUsers.set(uid, { ...info, isOnline: false });
            }
        });
    }

    // Render
    uniqueUsers.forEach((info, uid) => {
        const li = document.createElement('li');
        li.className = `user-filter-item ${activeFilters.has(uid) ? 'selected' : ''}`;
        li.onclick = () => toggleUserFilter(uid);
        
        const outlineClass = isLightColor(info.color) ? 'outline-dark' : 'outline-light';
        const avatarTextColor = isLightColor(info.color) ? '#000' : '#fff';

        li.innerHTML = `
            <div class="mini-avatar" style="background:${info.color}; color:${avatarTextColor}">${info.name.charAt(0).toUpperCase()}</div>
            <span style="color:${info.color}" class="${outlineClass}">${info.name}</span>
            ${info.isOnline ? '<span class="online-dot"></span>' : ''}
        `;
        listUi.appendChild(li);
    });
}

// --- PEERJS ---
function initNetwork() {
    if(peer) return;
    peer = new Peer(); 
    peer.on('open', (id) => {
        myPeerId = id;
        document.getElementById('myIdDisplay').innerText = `My ID: ${id} (Click to Copy Link)`;
        const targetId = window.location.hash.substring(1);
        if(targetId && targetId !== myPeerId) {
            document.getElementById('peerIdInput').value = targetId;
            connectToPeer(targetId);
        }
    });
    peer.on('connection', (conn) => { handleConnection(conn); });
}

function connectToPeer(overrideId = null) {
    const remoteId = overrideId || document.getElementById('peerIdInput').value.trim();
    if (!remoteId || remoteId === myPeerId || connections[remoteId]) return;
    const conn = peer.connect(remoteId);
    handleConnection(conn);
}

function handleConnection(conn) {
    conn.on('open', () => {
        connections[conn.peer] = conn;
        conn.send({ type: 'PROFILE', id: user.id, name: user.name, color: user.color });
        if(appData[activeListId]) {
            conn.send({ type: 'SYNC', listId: activeListId, listName: appData[activeListId].name, tasks: appData[activeListId].tasks });
        }
        const knownPeers = Object.keys(connections).filter(id => id !== conn.peer);
        if (knownPeers.length > 0) conn.send({ type: 'PEERS', peers: knownPeers });
        updateUserListUI();
    });

    conn.on('data', (msg) => {
        if (msg.type === 'SYNC') handleSyncMessage(msg);
        else if (msg.type === 'PROFILE') handleProfileMessage(msg);
        else if (msg.type === 'PEERS') {
            msg.peers.forEach(pId => {
                if (pId !== myPeerId && !connections[pId]) handleConnection(peer.connect(pId));
            });
        }
    });
    conn.on('close', () => { delete connections[conn.peer]; updateUserListUI(); });
}

function broadcastProfile() {
    const payload = { type: 'PROFILE', id: user.id, name: user.name, color: user.color };
    Object.values(connections).forEach(conn => { if (conn.open) conn.send(payload); });
}

function broadcastData() {
    const payload = { type: 'SYNC', listId: activeListId, listName: appData[activeListId].name, tasks: appData[activeListId].tasks };
    Object.values(connections).forEach(conn => { if (conn.open) conn.send(payload); });
}

function copyId() { 
    const url = window.location.origin + window.location.pathname + '#' + myPeerId;
    navigator.clipboard.writeText(url); 
    alert("Shareable Link Copied!"); 
}

function handleProfileMessage(msg) {
    const resolvedColor = stringToColor(msg.name);
    peerProfiles[msg.id] = { name: msg.name, color: resolvedColor };
    saveProfiles();
    renderTasks();
    updateUserListUI();
}

function handleSyncMessage(msg) {
    const { listId, listName, tasks: remoteTasks } = msg;
    if (!appData[listId]) {
        appData[listId] = { name: listName, tasks: [] };
        renderSidebar();
    }
    const localList = appData[listId];
    let changed = false;
    remoteTasks.forEach(remoteTask => {
        const localTask = localList.tasks.find(t => t.id === remoteTask.id);
        if (!localTask) {
            localList.tasks.push(remoteTask);
            changed = true;
        } else {
            if (remoteTask.lastUpdated > localTask.lastUpdated) {
                Object.assign(localTask, remoteTask);
                changed = true;
            }
        }
    });
    if (changed) {
        saveData();
        if (listId === activeListId) { renderTasks(); updateUserListUI(); }
    }
}

function saveData() { localStorage.setItem('taskerMesh_v4', JSON.stringify(appData)); }
function saveAndBroadcast() { saveData(); renderTasks(); broadcastData(); updateUserListUI(); }

// --- TASK LOGIC ---
function addTask() {
    const input = document.getElementById('mainInput');
    const text = input.value.trim();
    if (!text) return;
    const newTask = {
        id: myPeerId + '-' + Date.now(),
        text: text,
        completed: false,
        authorId: user.id, 
        author: user.name, 
        authorColor: user.color, 
        lastUpdated: Date.now(),
        deleted: false,
        deletedBy: null,
        subtasks: [],
        _localDismissed: false 
    };
    appData[activeListId].tasks.push(newTask);
    input.value = '';
    saveAndBroadcast();
}

function toggleTask(id) {
    const task = appData[activeListId].tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        task.lastUpdated = Date.now();
        saveAndBroadcast();
    }
}

function markAsDeleted(id) {
    const task = appData[activeListId].tasks.find(t => t.id === id);
    if (task) {
        task.deleted = true;
        task.deletedBy = user.name;
        task.lastUpdated = Date.now();
        saveAndBroadcast();
    }
}

function dismissTask(id) {
    const task = appData[activeListId].tasks.find(t => t.id === id);
    if (task) {
        task._localDismissed = true; 
        saveData(); 
        renderTasks();
    }
}

function getAuthorDetails(task) {
    let info = { name: task.author, color: task.authorColor };
    if (task.authorId && peerProfiles[task.authorId]) {
        info = peerProfiles[task.authorId];
    }
    info.color = stringToColor(info.name);
    return info;
}

function renderTasks() {
    const ul = document.getElementById('taskList');
    ul.innerHTML = '';
    const currentTasks = appData[activeListId].tasks;

    const visibleTasks = currentTasks.filter(t => {
        if (t._localDismissed) return false; 
        if (t.deleted && settings.autoDelete) return false; 
        
        // FILTER LOGIC
        if (activeFilters.size > 0) {
            const uid = t.authorId || t.author;
            if (!activeFilters.has(uid)) return false;
        }

        return true;
    }).sort((a,b) => b.lastUpdated - a.lastUpdated);

    visibleTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        if (task.deleted) li.classList.add('marked-deleted');
        
        const authorInfo = getAuthorDetails(task);
        li.style.borderLeftColor = authorInfo.color;

        let actionBtn = '';
        if (task.deleted) {
            actionBtn = `<button class="delete-btn" onclick="dismissTask('${task.id}')" title="Confirm Deletion">🗑️ Confirm</button>`;
        } else {
            actionBtn = `<button class="delete-btn" onclick="markAsDeleted('${task.id}')">✕</button>`;
        }

        let statusText = '';
        if (task.deleted) {
            statusText = `<span style="color:var(--deleted-text); font-weight:bold;">Deleted by ${task.deletedBy || 'someone'}</span>`;
        } else {
            const outlineClass = isLightColor(authorInfo.color) ? 'outline-dark' : 'outline-light';
            statusText = `Added by <span class="author-tag ${outlineClass}" style="color:${authorInfo.color}">${authorInfo.name}</span>`;
        }

        li.innerHTML = `
            <div class="task-main">
                <input type="checkbox" ${task.completed ? 'checked' : ''} ${task.deleted ? 'disabled' : ''} onchange="toggleTask('${task.id}')">
                <span class="task-text ${task.completed ? 'completed' : ''}">${task.text}</span>
                ${actionBtn}
            </div>
            <div class="task-meta">${statusText}</div>
        `;

        if (!task.deleted) {
            const subUl = document.createElement('div');
            subUl.className = 'subtask-list';
            task.subtasks.forEach(sub => {
                const subDiv = document.createElement('div');
                subDiv.className = 'subtask-item';
                subDiv.innerHTML = `
                    <input type="checkbox" ${sub.completed ? 'checked' : ''} onchange="toggleSubtask('${task.id}', ${sub.id})">
                    <span style="flex-grow:1; ${sub.completed ? 'text-decoration:line-through; opacity:0.6' : ''}">${sub.text}</span>
                `;
                subUl.appendChild(subDiv);
            });
            li.appendChild(subUl);
        }
        ul.appendChild(li);
    });
}

function toggleSubtask(parentId, subId) {
    const task = appData[activeListId].tasks.find(t => t.id === parentId);
    const sub = task.subtasks.find(s => s.id === subId);
    if(sub) { sub.completed = !sub.completed; task.lastUpdated = Date.now(); saveAndBroadcast(); }
}

document.getElementById('mainInput').addEventListener('keypress', e => { if(e.key === 'Enter') addTask() });