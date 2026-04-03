/* ===== TripMate App ===== */
(function () {
    'use strict';

    // ===== Firebase Config =====
    const firebaseConfig = {
        apiKey: "AIzaSyCcRLNQUUqgoIeLrudKJ9IsClwuc93WwHM",
        authDomain: "potatoplan-9dedc.firebaseapp.com",
        databaseURL: "https://potatoplan-9dedc-default-rtdb.firebaseio.com",
        projectId: "potatoplan-9dedc",
        storageBucket: "potatoplan-9dedc.firebasestorage.app",
        messagingSenderId: "759154119060",
        appId: "1:759154119060:web:665a705e2f848d4dce3f81",
        measurementId: "G-EXZLG8WCLQ"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // ===== State =====
    const STATE_KEY = 'tripmate_state';
    let state = loadState();

    function defaultState() {
        return {
            user: null,
            friends: [],
            trips: [],
        };
    }

    function loadState() {
        try {
            const data = localStorage.getItem(STATE_KEY);
            if (data) return JSON.parse(data);
        } catch (e) { /* ignore */ }
        return defaultState();
    }

    function saveState() {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }

    function generateId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let id = '';
        for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
        return id;
    }

    function uuid() {
        return 'xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
    }

    // ===== Navigation =====
    let currentScreen = 'screen-login';
    let screenHistory = [];

    function navigateTo(screenId, pushHistory = true) {
        const current = document.getElementById(currentScreen);
        const target = document.getElementById(screenId);
        if (!current || !target || currentScreen === screenId) return;

        if (pushHistory) screenHistory.push(currentScreen);

        current.classList.remove('active');
        current.classList.add('slide-out');
        setTimeout(() => current.classList.remove('slide-out'), 350);

        target.classList.add('active');
        currentScreen = screenId;
    }

    function goBack() {
        if (screenHistory.length === 0) return;
        const prev = screenHistory.pop();
        const current = document.getElementById(currentScreen);
        const target = document.getElementById(prev);

        current.classList.remove('active');
        target.classList.add('active');
        currentScreen = prev;
    }

    // ===== Toast =====
    let toastTimer;
    function showToast(message, type = '') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show ' + type;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.className = 'toast', 2500);
    }

    // ===== Modals =====
    function openModal(id) {
        document.getElementById(id).classList.add('open');
    }

    function closeModal(id) {
        document.getElementById(id).classList.remove('open');
    }

    function closeAllModals() {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }

    // ===== Auth =====
    function initAuth() {
        const googleBtn = document.getElementById('btn-google-login');
        const loadingEl = document.getElementById('login-loading');

        // Google Sign-In button
        googleBtn.addEventListener('click', async () => {
            googleBtn.classList.add('hidden');
            loadingEl.classList.remove('hidden');
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                await auth.signInWithPopup(provider);
                // onAuthStateChanged will handle the rest
            } catch (error) {
                googleBtn.classList.remove('hidden');
                loadingEl.classList.add('hidden');
                if (error.code !== 'auth/popup-closed-by-user') {
                    showToast('ログインに失敗しました', 'error');
                    console.error('Auth error:', error);
                }
            }
        });

        // Auth state listener
        auth.onAuthStateChanged((firebaseUser) => {
            if (firebaseUser) {
                // User is signed in
                const shortId = firebaseUser.uid.substring(0, 8).toUpperCase();
                state.user = {
                    id: shortId,
                    uid: firebaseUser.uid,
                    name: firebaseUser.displayName || 'ユーザー',
                    email: firebaseUser.email || '',
                    photoURL: firebaseUser.photoURL || '',
                };
                saveState();

                // Save user to Firestore
                db.collection('users').doc(firebaseUser.uid).set({
                    uid: firebaseUser.uid,
                    shortId: shortId,
                    name: state.user.name,
                    email: state.user.email,
                    photoURL: state.user.photoURL,
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(err => console.error("Error saving user:", err));

                // Listen to trips
                listenToTrips();

                navigateTo('screen-home', false);
                renderHome();
                showToast(`ようこそ、${state.user.name}さん！`, 'success');
            } else {
                // User is signed out — show login screen
                if (currentScreen !== 'screen-login') {
                    navigateTo('screen-login', false);
                    screenHistory = [];
                }
                // Show the button, hide loading
                const googleBtn = document.getElementById('btn-google-login');
                const loadingEl = document.getElementById('login-loading');
                if (googleBtn) googleBtn.classList.remove('hidden');
                if (loadingEl) loadingEl.classList.add('hidden');
            }
        });
    }

    // ===== Profile =====
    function renderProfile() {
        if (!state.user) return;

        document.getElementById('profile-name').textContent = state.user.name;
        document.getElementById('profile-id').textContent = state.user.id;
        document.getElementById('profile-email').textContent = state.user.email || '';

        // Avatar
        const avatarImg = document.getElementById('profile-avatar-img');
        const avatarEmoji = document.getElementById('profile-avatar-emoji');
        if (state.user.photoURL) {
            avatarImg.src = state.user.photoURL;
            avatarImg.classList.remove('hidden');
            avatarEmoji.classList.add('hidden');
        } else {
            avatarImg.classList.add('hidden');
            avatarEmoji.classList.remove('hidden');
        }

        // Generate QR Code
        const qrContainer = document.getElementById('profile-qr');
        qrContainer.innerHTML = '';
        try {
            new QRCode(qrContainer, {
                text: state.user.id,
                width: 160,
                height: 160,
                colorDark: '#1a1a2e',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M,
            });
        } catch (e) {
            qrContainer.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;">QR生成エラー</p>';
        }
    }

    // ===== Home =====
    function renderHome() {
        const tripList = document.getElementById('trip-list');
        const emptyState = document.getElementById('empty-trips');

        if (state.trips.length === 0) {
            tripList.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        tripList.classList.remove('hidden');
        emptyState.classList.add('hidden');

        tripList.innerHTML = state.trips.map(trip => {
            const memberAvatars = getMemberAvatars(trip);
            const startFormatted = formatDateShort(trip.startDate);
            const endFormatted = formatDateShort(trip.endDate);
            const isCreator = trip.createdBy === state.user.id || (trip.participantIds && trip.participantIds[0] === state.user.id);

            return `
                <div class="trip-card" data-trip-id="${trip.id}">
                    <div class="trip-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                        <div class="trip-card-name" style="margin-bottom:0; font-size:17px; font-weight:700; color:var(--text-primary);">${escapeHtml(trip.name)}</div>
                        ${isCreator ? `
                        <div class="trip-actions" style="display:flex; gap:4px; margin-top:-4px; margin-right:-8px;">
                            <button class="icon-btn btn-ghost trip-edit-btn" data-edit-trip="${trip.id}" style="width:32px; height:32px;" title="編集">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="icon-btn btn-ghost trip-delete-btn" data-delete-trip="${trip.id}" style="width:32px; height:32px; color:var(--danger)" title="削除">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                        ` : ''}
                    </div>
                    <div class="trip-card-dates">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ${startFormatted} 〜 ${endFormatted}
                    </div>
                    <div class="trip-card-members">
                        ${memberAvatars}
                    </div>
                </div>
            `;
        }).join('');

        // Click handlers
        tripList.querySelectorAll('.trip-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if(e.target.closest('.trip-edit-btn') || e.target.closest('.trip-delete-btn')) return;
                const tripId = card.dataset.tripId;
                openTripOverview(tripId);
            });
            
            const editBtn = card.querySelector('.trip-edit-btn');
            if(editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditTripModal(card.dataset.tripId);
                });
            }
            
            const delBtn = card.querySelector('.trip-delete-btn');
            if(delBtn) {
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm('この旅行を削除しますか？')) {
                        try {
                            await db.collection('trips').doc(card.dataset.tripId).delete();
                            showToast('旅行を削除しました');
                            // renderHome will be triggered by onSnapshot
                        } catch(err) { console.error(err); }
                    }
                });
            }
        });
    }

    function getMemberAvatars(trip) {
        const pids = trip.participantIds || [state.user.id, ...(trip.friendIds || [])];
        const members = pids.map(pid => {
            if (pid === state.user.id) return state.user.name;
            const f = state.friends.find(fr => fr.id === pid);
            return f ? f.name : '?';
        });

        const avatars = members.slice(0, 4).map(name =>
            `<div class="member-avatar">${name ? name.charAt(0) : '?'}</div>`
        ).join('');

        const extra = members.length > 4 ? `<span class="member-count">+${members.length - 4}</span>` : '';
        return avatars + extra;
    }

    // ===== Friends =====
    function renderFriends() {
        const list = document.getElementById('friend-list');
        const empty = document.getElementById('empty-friends');

        if (state.friends.length === 0) {
            list.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }

        list.classList.remove('hidden');
        empty.classList.add('hidden');

        list.innerHTML = state.friends.map(f => `
            <div class="friend-item" data-friend-id="${f.id}">
                <div class="friend-avatar">${f.name.charAt(0)}</div>
                <div class="friend-info">
                    <div class="friend-name">${escapeHtml(f.name)}</div>
                    <div class="friend-id-text">${f.id}</div>
                </div>
                <button class="friend-remove-btn" data-remove-friend="${f.id}" aria-label="削除">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `).join('');

        list.querySelectorAll('.friend-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.removeFriend;
                state.friends = state.friends.filter(f => f.id !== id);
                saveState();
                renderFriends();
                showToast('フレンドを削除しました');
            });
        });
    }

    async function addFriendById(friendId) {
        friendId = friendId.trim().toUpperCase();

        if (!friendId) {
            showToast('IDを入力してください', 'error');
            return false;
        }

        if (friendId === state.user.id) {
            showToast('自分のIDは追加できません', 'error');
            return false;
        }

        if (state.friends.some(f => f.id === friendId)) {
            showToast('すでに追加されています', 'error');
            return false;
        }

        try {
            const snapshot = await db.collection('users').where('shortId', '==', friendId).limit(1).get();
            if (snapshot.empty) {
                showToast('ユーザーが見つかりません', 'error');
                return false;
            }
            const userData = snapshot.docs[0].data();
            state.friends.push({
                id: userData.shortId,
                name: userData.name,
            });
            saveState();
            renderFriends();
            showToast(`${userData.name}さんを追加しました！`, 'success');
            return true;
        } catch (e) {
            console.error("Error adding friend:", e);
            showToast('エラーが発生しました', 'error');
            return false;
        }
    }

    // ===== New Trip =====
    function renderFriendSelector() {
        const selector = document.getElementById('friend-selector');

        if (state.friends.length === 0) {
            selector.innerHTML = '<p class="no-friends-msg">まだ友達が追加されていません</p>';
            return;
        }

        selector.innerHTML = state.friends.map(f => `
            <div class="friend-check-item" data-check-friend="${f.id}">
                <div class="friend-checkbox">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div class="friend-avatar" style="width:32px;height:32px;font-size:12px;">${f.name.charAt(0)}</div>
                <span class="friend-check-name">${escapeHtml(f.name)}</span>
            </div>
        `).join('');

        selector.querySelectorAll('.friend-check-item').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('selected');
            });
        });
    }

    let unsubscribeTrips = null;

    function listenToTrips() {
        if (!state.user) return;
        if (unsubscribeTrips) unsubscribeTrips();
        
        unsubscribeTrips = db.collection('trips')
            .where('participantIds', 'array-contains', state.user.id)
            .onSnapshot(snapshot => {
                const loadedTrips = [];
                snapshot.forEach(doc => {
                    loadedTrips.push(doc.data());
                });
                loadedTrips.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
                state.trips = loadedTrips;
                saveState();
                
                if (currentScreen === 'screen-home') renderHome();
                if (currentScreen === 'screen-trip-overview' && currentTripId) {
                    const t = state.trips.find(x => x.id === currentTripId);
                    if (t) renderTripOverview();
                    else { currentTripId = null; goBack(); }
                }
                if (currentScreen === 'screen-trip' && currentTripId) {
                    const t = state.trips.find(x => x.id === currentTripId);
                    if (t) renderTripDetail();
                    else { currentTripId = null; goBack(); } // Trip was deleted
                }
            }, err => console.error("Error listening to trips:", err));
    }

    let editingTripId = null;

    function openEditTripModal(tripId) {
        const trip = state.trips.find(t => t.id === tripId);
        if (!trip) return;
        editingTripId = tripId;
        
        const titleEl = document.getElementById('modal-trip-title');
        const submitEl = document.getElementById('btn-submit-trip');
        if(titleEl) titleEl.textContent = '旅行を編集';
        if(submitEl) submitEl.textContent = '保存する';
        
        document.getElementById('trip-name').value = trip.name;
        document.getElementById('trip-start').value = trip.startDate;
        document.getElementById('trip-end').value = trip.endDate;
        
        renderFriendSelector();
        // Prefill friends
        document.querySelectorAll('.friend-check-item').forEach(item => {
            if (trip.friendIds && trip.friendIds.includes(item.dataset.checkFriend)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        openModal('modal-new-trip');
    }

    async function createTrip(name, startDate, endDate, friendIds) {
        if (editingTripId) {
            try {
                const participantIds = [state.user.id, ...friendIds];
                await db.collection('trips').doc(editingTripId).update({
                    name, startDate, endDate, friendIds, participantIds
                });
                editingTripId = null;
            } catch (e) {
                console.error("Error updating trip:", e);
                showToast('旅行の更新に失敗しました', 'error');
            }
            return;
        }

        const tripId = uuid();
        const trip = {
            id: tripId,
            name: name,
            startDate: startDate,
            endDate: endDate,
            friendIds: friendIds,
            participantIds: [state.user.id, ...friendIds],
            createdBy: state.user.id,
            schedules: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await db.collection('trips').doc(tripId).set(trip);
            return tripId;
        } catch (e) {
            console.error("Error creating trip:", e);
            showToast('旅行の作成に失敗しました', 'error');
            return null;
        }
    }

    // ===== Trip Overview =====
    function openTripOverview(tripId) {
        currentTripId = tripId;
        navigateTo('screen-trip-overview');
        renderTripOverview();
    }

    function renderTripOverview() {
        const trip = state.trips.find(t => t.id === currentTripId);
        if (!trip) return;

        document.getElementById('overview-title').textContent = trip.name;
        
        const banner = document.getElementById('overview-banner');
        const coverImg = document.getElementById('overview-cover-img');
        const iconEl = document.getElementById('overview-icon');
        const purposeEl = document.getElementById('overview-purpose');
        const editHints = document.querySelectorAll('#screen-trip-overview .edit-hint');
        
        const isCreator = trip.createdBy === state.user.id || (trip.participantIds && trip.participantIds[0] === state.user.id);
        
        if (isCreator) {
            document.getElementById('btn-edit-purpose').style.display = '';
            banner.style.cursor = 'pointer';
            iconEl.style.cursor = 'pointer';
            editHints.forEach(el => el.style.display = '');
        } else {
            document.getElementById('btn-edit-purpose').style.display = 'none';
            banner.style.cursor = 'default';
            iconEl.style.cursor = 'default';
            editHints.forEach(el => el.style.display = 'none');
        }

        if (trip.coverImage) {
            coverImg.src = trip.coverImage;
            coverImg.style.display = 'block';
        } else {
            coverImg.style.display = 'none';
            banner.style.background = 'linear-gradient(135deg, var(--accent-start), var(--accent-mid))';
        }

        iconEl.textContent = trip.icon || '✈️';
        purposeEl.textContent = trip.purpose || 'まだ目的が設定されていません。';

        // Render Tasks
        const taskList = document.getElementById('task-list');
        const tasks = trip.tasks || [];
        if (tasks.length === 0) {
            taskList.innerHTML = '<p style="text-align:center; color:var(--text-tertiary); font-size:13px; margin-top:20px;">タスクはありません</p>';
        } else {
            taskList.innerHTML = tasks.map(task => `
                <div class="task-item" style="display:flex; align-items:center; gap:12px; padding:12px; background:white; border-radius:var(--radius-md); border:1px solid var(--border-light);">
                    <div class="task-checkbox" data-task-id="${task.id}" style="width:24px; height:24px; border-radius:50%; border:2px solid ${task.isCompleted ? 'var(--success)' : 'var(--border)'}; background:${task.isCompleted ? 'var(--success)' : 'transparent'}; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer;">
                        ${task.isCompleted ? '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                    </div>
                    <div style="flex:1; font-size:15px; color:${task.isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)'}; text-decoration:${task.isCompleted ? 'line-through' : 'none'}; word-break:break-all;">
                        ${escapeHtml(task.text)}
                    </div>
                    <button class="icon-btn btn-ghost task-delete-btn" data-task-id="${task.id}" style="width:28px; height:28px; color:var(--text-tertiary); flex-shrink:0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `).join('');
        }
    }

    // ===== Trip Detail =====
    let currentTripId = null;
    let currentDayIndex = 0;
    let currentMemberFilter = 'all';

    function openTripSchedule() {
        currentDayIndex = 0;
        currentMemberFilter = 'all';
        navigateTo('screen-trip');
        renderTripDetail();
    }

    function getTripDays(trip) {
        const days = [];
        const start = new Date(trip.startDate);
        const end = new Date(trip.endDate);
        const current = new Date(start);

        while (current <= end) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return days;
    }

    function renderTripDetail() {
        const trip = state.trips.find(t => t.id === currentTripId);
        if (!trip) return;

        // Title
        document.getElementById('trip-detail-title').textContent = trip.name;

        // Permissions
        const isCreator = trip.createdBy === state.user.id || (trip.participantIds && trip.participantIds[0] === state.user.id);
        const delBtn = document.getElementById('btn-delete-trip');
        const editBtn = document.getElementById('btn-edit-trip-detail');
        if (isCreator) {
            if(delBtn) delBtn.style.display = '';
            if(editBtn) editBtn.style.display = '';
        } else {
            if(delBtn) delBtn.style.display = 'none';
            if(editBtn) editBtn.style.display = 'none';
        }

        // Meta
        const meta = document.getElementById('trip-meta');
        const days = getTripDays(trip);
        const pids = trip.participantIds || [state.user.id, ...(trip.friendIds || [])];
        const memberNames = pids.map(pid => {
            if (pid === state.user.id) return state.user.name;
            const f = state.friends.find(fr => fr.id === pid);
            return f ? f.name : '未登録';
        });

        meta.innerHTML = `
            <span class="trip-meta-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${days.length}日間
            </span>
            <span class="trip-meta-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                ${memberNames.length}人
            </span>
        `;

        // Day tabs
        renderDayTabs(days);

        // Member filter
        renderMemberFilter(trip);

        // Schedule for selected day
        renderSchedule(trip, days);
    }

    function renderMemberFilter(trip) {
        const container = document.getElementById('member-filter');
        const pids = trip.participantIds || [state.user.id, ...(trip.friendIds || [])];
        const members = pids.map(pid => {
            if (pid === state.user.id) return { id: pid, name: state.user.name, isMe: true };
            const f = state.friends.find(fr => fr.id === pid);
            if (f) return { id: pid, name: f.name, isFriend: true };
            return { id: pid, name: '未登録 (' + pid + ')', isUnknown: true };
        });

        let html = `<button class="member-filter-btn ${currentMemberFilter === 'all' ? 'active' : ''}" data-member-filter="all">ALL</button>`;
        members.forEach(m => {
            html += `
                <div style="display:inline-flex; align-items:center; position:relative; flex-shrink:0;">
                    <button class="member-filter-btn ${currentMemberFilter === m.id ? 'active' : ''}" data-member-filter="${m.id}" style="${m.isUnknown ? 'padding-right: 36px;' : ''}">
                        <span class="filter-avatar">${m.name ? m.name.charAt(0) : '?'}</span>
                        ${escapeHtml(m.name)}
                    </button>
                    ${m.isUnknown ? `
                        <button class="btn-add-unknown" data-unknown-id="${m.id}" title="友達に追加" style="position:absolute; right:4px; top:50%; transform:translateY(-50%); width:26px; height:26px; border-radius:50%; border:none; background:var(--accent-gradient); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                    ` : ''}
                </div>
            `;
        });
        container.innerHTML = html;

        container.querySelectorAll('.member-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('btn-add-unknown')) return; // Ignore add button clicks for filter
                currentMemberFilter = btn.dataset.memberFilter;
                renderMemberFilter(trip);
                renderSchedule(trip, getTripDays(trip));
            });
        });

        container.querySelectorAll('.btn-add-unknown').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const uid = btn.dataset.unknownId;
                const success = await addFriendById(uid);
                if (success) {
                    renderTripDetail(); // Re-render to show updated name
                }
            });
        });
    }

    function renderDayTabs(days) {
        const container = document.getElementById('day-tabs');
        const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

        container.innerHTML = days.map((day, i) => {
            const label = `Day ${i + 1}`;
            const month = day.getMonth() + 1;
            const date = day.getDate();
            const dow = dayLabels[day.getDay()];

            return `
                <button class="day-tab ${i === currentDayIndex ? 'active' : ''}" data-day-index="${i}">
                    <span class="day-label">${label}</span>
                    <span class="day-date">${month}/${date}</span>
                    <span class="day-label">${dow}</span>
                </button>
            `;
        }).join('');

        container.querySelectorAll('.day-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentDayIndex = parseInt(tab.dataset.dayIndex);
                const trip = state.trips.find(t => t.id === currentTripId);
                if (trip) {
                    renderDayTabs(getTripDays(trip));
                    renderSchedule(trip, getTripDays(trip));
                }
            });
        });

        // Scroll active tab into view
        setTimeout(() => {
            const activeTab = container.querySelector('.day-tab.active');
            if (activeTab) {
                activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }, 100);
    }

    function renderSchedule(trip, days) {
        const list = document.getElementById('schedule-list');
        const empty = document.getElementById('empty-schedule');

        if (!days[currentDayIndex]) return;

        const dayStr = formatDateISO(days[currentDayIndex]);
        let daySchedules = trip.schedules
            .filter(s => s.date === dayStr)
            .sort((a, b) => a.time.localeCompare(b.time));

        // Apply member filter
        if (currentMemberFilter === 'all') {
            // Show shared schedules only
            daySchedules = daySchedules.filter(s => s.isShared);
        } else {
            // Show that member's personal schedules + shared schedules
            daySchedules = daySchedules.filter(s => s.isShared || s.createdBy === currentMemberFilter);
        }

        if (daySchedules.length === 0) {
            list.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }

        list.classList.remove('hidden');
        empty.classList.add('hidden');

        list.innerHTML = daySchedules.map(s => {
            const scopeLabel = s.isShared ? 'みんな' : '自分だけ';
            const scopeClass = s.isShared ? '' : 'personal';
            const creator = s.createdBy === state.user.id ? 'あなた' : getNameById(s.createdBy);

            const timeDisplay = s.endTime ? `${s.time} 〜 ${s.endTime}` : s.time;

            return `
                <div class="schedule-item ${scopeClass}" data-schedule-id="${s.id}">
                    <div class="schedule-time">
                        ${timeDisplay}
                        <span class="schedule-scope-tag">${scopeLabel}</span>
                    </div>
                    <div class="schedule-title">
                        ${s.icon ? `<span class="schedule-icon-display">${s.icon}</span>` : ''}
                        ${escapeHtml(s.title)}
                    </div>
                    ${s.memo ? `<div class="schedule-memo" style="font-size:13px; color:var(--text-secondary); margin-top:4px; padding-left:12px; border-left:2px solid var(--border); white-space:pre-wrap;">${escapeHtml(s.memo)}</div>` : ''}
                    <div class="schedule-creator">${creator}が追加</div>
                    <button class="schedule-delete-btn" data-delete-schedule="${s.id}" aria-label="削除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            `;
        }).join('');

        // Toggle expand on tap
        list.querySelectorAll('.schedule-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.schedule-delete-btn')) return;
                // Close others
                list.querySelectorAll('.schedule-item.expanded').forEach(other => {
                    if (other !== item) other.classList.remove('expanded');
                });
                item.classList.toggle('expanded');
            });
        });

        // Delete handlers
        list.querySelectorAll('.schedule-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sid = btn.dataset.deleteSchedule;
                const scheduleToRemove = trip.schedules.find(s => s.id === sid);
                if(scheduleToRemove) {
                    try {
                        await db.collection('trips').doc(trip.id).update({
                            schedules: firebase.firestore.FieldValue.arrayRemove(scheduleToRemove)
                        });
                        showToast('予定を削除しました');
                    } catch(err) { console.error(err); }
                }
            });
        });
    }

    async function addSchedule(tripId, date, time, endTime, title, memo, isShared, icon) {
        const scheduleId = uuid();
        const newSchedule = {
            id: scheduleId,
            date: date,
            time: time,
            endTime: endTime || '',
            title: title,
            memo: memo || '',
            isShared: isShared,
            icon: icon || '📍',
            createdBy: state.user.id,
        };
        try {
            await db.collection('trips').doc(tripId).update({
                schedules: firebase.firestore.FieldValue.arrayUnion(newSchedule)
            });
        } catch(e) { console.error("Error adding schedule:", e); }
    }

    function getNameById(id) {
        if (state.user && state.user.id === id) return state.user.name;
        const f = state.friends.find(fr => fr.id === id);
        return f ? f.name : '不明';
    }

    // ===== Helpers =====
    function formatDateShort(dateStr) {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    }

    function formatDateISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== Event Setup =====
    function setupEvents() {
        // Back buttons
        document.querySelectorAll('[data-back]').forEach(btn => {
            btn.addEventListener('click', goBack);
        });

        // Close modals
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                closeAllModals();
            });
        });

        // Click overlay to close
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeAllModals();
            });
        });

        // Nav buttons
        document.getElementById('btn-friends').addEventListener('click', () => {
            navigateTo('screen-friends');
            renderFriends();
        });

        document.getElementById('btn-profile').addEventListener('click', () => {
            navigateTo('screen-profile');
            renderProfile();
        });

        // New trip button
        document.getElementById('btn-new-trip').addEventListener('click', () => {
            editingTripId = null;
            const titleEl = document.getElementById('modal-trip-title');
            const submitEl = document.getElementById('btn-submit-trip');
            if(titleEl) titleEl.textContent = '新しい旅行';
            if(submitEl) submitEl.textContent = '旅行を作成';

            renderFriendSelector();
            // Set default dates
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('trip-start').value = formatDateISO(today);
            document.getElementById('trip-end').value = formatDateISO(tomorrow);
            document.getElementById('trip-name').value = '';
            openModal('modal-new-trip');
        });

        // New trip form submit
        document.getElementById('form-new-trip').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('trip-name').value.trim();
            const startDate = document.getElementById('trip-start').value;
            const endDate = document.getElementById('trip-end').value;

            if (!name || !startDate || !endDate) {
                showToast('すべての項目を入力してください', 'error');
                return;
            }

            if (new Date(startDate) > new Date(endDate)) {
                showToast('開始日は終了日より前にしてください', 'error');
                return;
            }

            const selectedFriends = [];
            document.querySelectorAll('.friend-check-item.selected').forEach(item => {
                selectedFriends.push(item.dataset.checkFriend);
            });

            const tripId = await createTrip(name, startDate, endDate, selectedFriends);
            closeAllModals();
            showToast(editingTripId ? '旅行を更新しました！' : '旅行を作成しました！ 🎉', 'success');
            
            if (!editingTripId && tripId) {
                // Navigate to the newly created trip overview
                openTripOverview(tripId);
            }
        });

        // Add friend button
        document.getElementById('btn-add-friend').addEventListener('click', () => {
            document.getElementById('friend-id-input').value = '';
            openModal('modal-add-friend');
        });

        // Add friend by ID form
        document.getElementById('form-add-friend-id').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('friend-id-input').value;
            const success = await addFriendById(id);
            if (success) {
                closeAllModals();
            }
        });

        // Friend add tabs
        document.querySelectorAll('.add-friend-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.add-friend-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('#modal-add-friend .tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');
            });
        });

        // QR Scanner (basic placeholder — full implementation needs a QR library)
        document.getElementById('btn-start-scan').addEventListener('click', async () => {
            try {
                const video = document.getElementById('qr-video');
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                video.srcObject = stream;
                video.style.display = 'block';
                video.play();
                document.querySelector('.qr-scanner-placeholder').style.display = 'none';
                document.getElementById('qr-scan-result').innerHTML =
                    '<p style="color:var(--text-secondary)">カメラが起動しました。デモではIDを手動入力してください。</p>' +
                    '<button class="btn btn-secondary btn-sm" id="btn-stop-scan" style="margin-top:8px;">カメラを停止</button>';
                document.getElementById('btn-stop-scan').addEventListener('click', () => {
                    stream.getTracks().forEach(t => t.stop());
                    video.style.display = 'none';
                    document.querySelector('.qr-scanner-placeholder').style.display = '';
                    document.getElementById('qr-scan-result').innerHTML = '';
                });
            } catch (err) {
                document.getElementById('qr-scan-result').innerHTML =
                    '<p style="color:var(--danger)">カメラにアクセスできません</p>';
            }
        });

        // Copy ID
        document.getElementById('btn-copy-id').addEventListener('click', () => {
            if (state.user) {
                navigator.clipboard.writeText(state.user.id).then(() => {
                    showToast('IDをコピーしました！', 'success');
                }).catch(() => {
                    showToast('コピーに失敗しました', 'error');
                });
            }
        });

        // Edit Profile Name
        const btnEditName = document.getElementById('btn-edit-name');
        if(btnEditName) {
            btnEditName.addEventListener('click', async () => {
                if(!state.user || !auth.currentUser) return;
                const newName = prompt('新しい表示名を入力してください', state.user.name);
                if (newName && newName.trim().length > 0 && newName.trim() !== state.user.name) {
                    try {
                        const trimmed = newName.trim();
                        await auth.currentUser.updateProfile({ displayName: trimmed });
                        await db.collection('users').doc(state.user.uid).update({ name: trimmed });
                        state.user.name = trimmed;
                        saveState();
                        renderProfile();
                        showToast('表示名を変更しました', 'success');
                    } catch (e) {
                        showToast('表示名の変更に失敗しました', 'error');
                        console.error(e);
                    }
                }
            });
        }

        // Logout
        document.getElementById('btn-logout').addEventListener('click', async () => {
            if (confirm('ログアウトしますか？')) {
                try {
                    await auth.signOut();
                    if (typeof unsubscribeTrips === 'function') unsubscribeTrips();
                    localStorage.removeItem(STATE_KEY);
                    state = defaultState();
                    screenHistory = [];
                    showToast('ログアウトしました');
                } catch (e) {
                    showToast('ログアウトに失敗しました', 'error');
                }
            }
        });

        // Add schedule button
        document.getElementById('btn-add-schedule').addEventListener('click', () => {
            document.getElementById('schedule-time').value = '';
            document.getElementById('schedule-end-time').value = '';
            document.getElementById('schedule-title').value = '';
            const memoEl = document.getElementById('schedule-memo');
            if (memoEl) memoEl.value = '';
            // Reset toggle
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.toggle-btn[data-scope="shared"]').classList.add('active');
            openModal('modal-add-schedule');
        });

        // Schedule scope toggle
        document.querySelectorAll('.toggle-btn[data-scope]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.toggle-btn[data-scope]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Schedule icon picker
        document.querySelectorAll('.icon-btn-choice').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.icon-btn-choice').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Add schedule form
        document.getElementById('form-add-schedule').addEventListener('submit', (e) => {
            e.preventDefault();
            const trip = state.trips.find(t => t.id === currentTripId);
            if (!trip) return;

            const days = getTripDays(trip);
            const dayStr = formatDateISO(days[currentDayIndex]);
            const time = document.getElementById('schedule-time').value;
            const endTime = document.getElementById('schedule-end-time').value;
            const title = document.getElementById('schedule-title').value.trim();
            const memoEl = document.getElementById('schedule-memo');
            const memo = memoEl ? memoEl.value.trim() : '';
            const isShared = document.querySelector('.toggle-btn[data-scope].active').dataset.scope === 'shared';
            
            const activeIconBtn = document.querySelector('.icon-btn-choice.active');
            const icon = activeIconBtn ? activeIconBtn.dataset.icon : '📍';

            if (!time || !title) {
                showToast('すべての項目を入力してください', 'error');
                return;
            }

            if (endTime && endTime <= time) {
                showToast('終了時間は開始時間より後にしてください', 'error');
                return;
            }

            addSchedule(currentTripId, dayStr, time, endTime, title, memo, isShared, icon);
            closeAllModals();
            renderSchedule(trip, days);
            showToast('予定を追加しました！', 'success');
        });

        // Edit trip Detail
        const btnEditDetail = document.getElementById('btn-edit-trip-detail');
        if (btnEditDetail) {
            btnEditDetail.addEventListener('click', () => {
                if (currentTripId) openEditTripModal(currentTripId);
            });
        }

        // Delete trip
        document.getElementById('btn-delete-trip').addEventListener('click', async () => {
            if (confirm('この旅行を削除しますか？')) {
                try {
                    await db.collection('trips').doc(currentTripId).delete();
                    currentTripId = null;
                    goBack();
                    renderHome(); // IMPORTANT FIX
                    showToast('旅行を削除しました');
                } catch(e) { console.error(e); }
            }
        });

        // ===== Trip Overview Events =====
        const bannerEl = document.getElementById('overview-banner');
        if (bannerEl) {
            bannerEl.addEventListener('click', async () => {
                const trip = state.trips.find(t => t.id === currentTripId);
                // check permissions: creator or first participant
                if (!trip || (trip.createdBy !== state.user.id && (!trip.participantIds || trip.participantIds[0] !== state.user.id))) return;
                
                const newUrl = prompt('カバー画像のURLを入力してください', trip.coverImage || '');
                if (newUrl !== null) {
                    try {
                        await db.collection('trips').doc(currentTripId).update({ coverImage: newUrl.trim() });
                        showToast('カバー画像を設定しました', 'success');
                    } catch (e) {
                        console.error(e);
                        showToast('更新に失敗しました', 'error');
                    }
                }
            });
        }

        const iconEl = document.getElementById('overview-icon');
        if (iconEl) {
            iconEl.addEventListener('click', async (e) => {
                e.stopPropagation(); // prevent banner click
                const trip = state.trips.find(t => t.id === currentTripId);
                if (!trip || (trip.createdBy !== state.user.id && (!trip.participantIds || trip.participantIds[0] !== state.user.id))) return;
                
                const newIcon = prompt('アイコンの絵文字を入力してください', trip.icon || '✈️');
                if (newIcon !== null && newIcon.trim().length > 0) {
                    try {
                        await db.collection('trips').doc(currentTripId).update({ icon: newIcon.trim() });
                        showToast('アイコンを更新しました', 'success');
                    } catch (err) {
                        console.error(err);
                        showToast('更新に失敗しました', 'error');
                    }
                }
            });
        }

        const btnEditPurpose = document.getElementById('btn-edit-purpose');
        if (btnEditPurpose) {
            btnEditPurpose.addEventListener('click', async () => {
                const trip = state.trips.find(t => t.id === currentTripId);
                if (!trip) return;
                const newPurpose = prompt('旅の目的・メモを入力', trip.purpose || '');
                if (newPurpose !== null) {
                    try {
                        await db.collection('trips').doc(currentTripId).update({ purpose: newPurpose });
                        showToast('目的を更新しました', 'success');
                    } catch (e) {
                        console.error(e);
                        showToast('更新に失敗しました', 'error');
                    }
                }
            });
        }

        const btnAddTask = document.getElementById('btn-add-task');
        if (btnAddTask) {
            btnAddTask.addEventListener('click', async () => {
                const input = document.getElementById('new-task-input');
                const text = input.value.trim();
                if (!text || !currentTripId) return;
                try {
                    const newTask = { id: uuid(), text, isCompleted: false };
                    await db.collection('trips').doc(currentTripId).update({
                        tasks: firebase.firestore.FieldValue.arrayUnion(newTask)
                    });
                    input.value = '';
                    showToast('タスクを追加しました', 'success');
                } catch (e) {
                    console.error(e);
                    showToast('追加に失敗しました', 'error');
                }
            });
        }

        const taskList = document.getElementById('task-list');
        if (taskList) {
            taskList.addEventListener('click', async (e) => {
                const checkBtn = e.target.closest('.task-checkbox');
                const delBtn = e.target.closest('.task-delete-btn');
                
                if (checkBtn) {
                    const taskId = checkBtn.dataset.taskId;
                    const trip = state.trips.find(t => t.id === currentTripId);
                    if (!trip || !trip.tasks) return;
                    const updatedTasks = trip.tasks.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t);
                    try {
                        await db.collection('trips').doc(currentTripId).update({ tasks: updatedTasks });
                    } catch (err) { console.error(err); }
                } else if (delBtn) {
                    const taskId = delBtn.dataset.taskId;
                    const trip = state.trips.find(t => t.id === currentTripId);
                    if (!trip || !trip.tasks) return;
                    const taskToRemove = trip.tasks.find(t => t.id === taskId);
                    if (taskToRemove && confirm('このタスクを削除しますか？')) {
                        try {
                            await db.collection('trips').doc(currentTripId).update({
                                tasks: firebase.firestore.FieldValue.arrayRemove(taskToRemove)
                            });
                            showToast('タスクを削除しました');
                        } catch (err) { console.error(err); }
                    }
                }
            });
        }

        const btnGoSchedule = document.getElementById('btn-go-schedule');
        if (btnGoSchedule) {
            btnGoSchedule.addEventListener('click', () => {
                if (currentTripId) openTripSchedule();
            });
        }
    }

    // ===== Init =====
    function init() {
        setupEvents();
        initAuth();
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
