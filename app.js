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

            return `
                <div class="trip-card" data-trip-id="${trip.id}">
                    <div class="trip-card-name">${escapeHtml(trip.name)}</div>
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
            card.addEventListener('click', () => {
                const tripId = card.dataset.tripId;
                openTripDetail(tripId);
            });
        });
    }

    function getMemberAvatars(trip) {
        const members = [state.user.name];
        trip.friendIds.forEach(fid => {
            const f = state.friends.find(fr => fr.id === fid);
            if (f) members.push(f.name);
        });

        const avatars = members.slice(0, 4).map(name =>
            `<div class="member-avatar">${name.charAt(0)}</div>`
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

    function addFriendById(friendId) {
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

        // Simulate friend lookup — in a real app this would be a server call
        // For demo, we create a friend with a generated name
        const friendNames = ['ハルカ', 'ユウト', 'サクラ', 'レン', 'アオイ', 'ソラ', 'ヒナタ', 'カイト', 'ミク', 'リク'];
        const randomName = friendNames[Math.floor(Math.random() * friendNames.length)];

        state.friends.push({
            id: friendId,
            name: randomName,
        });
        saveState();
        renderFriends();
        showToast(`${randomName}さんを追加しました！`, 'success');
        return true;
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

    function createTrip(name, startDate, endDate, friendIds) {
        const trip = {
            id: uuid(),
            name: name,
            startDate: startDate,
            endDate: endDate,
            friendIds: friendIds,
            schedules: [],
        };
        state.trips.unshift(trip);
        saveState();
        renderHome();
        return trip;
    }

    // ===== Trip Detail =====
    let currentTripId = null;
    let currentDayIndex = 0;
    let currentMemberFilter = 'all';

    function openTripDetail(tripId) {
        currentTripId = tripId;
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

        // Meta
        const meta = document.getElementById('trip-meta');
        const days = getTripDays(trip);
        const memberNames = [state.user.name, ...trip.friendIds.map(fid => {
            const f = state.friends.find(fr => fr.id === fid);
            return f ? f.name : '不明';
        })];

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
        const members = [
            { id: state.user.id, name: state.user.name },
            ...trip.friendIds.map(fid => {
                const f = state.friends.find(fr => fr.id === fid);
                return f ? { id: f.id, name: f.name } : { id: fid, name: '不明' };
            })
        ];

        let html = `<button class="member-filter-btn ${currentMemberFilter === 'all' ? 'active' : ''}" data-member-filter="all">ALL</button>`;
        members.forEach(m => {
            html += `
                <button class="member-filter-btn ${currentMemberFilter === m.id ? 'active' : ''}" data-member-filter="${m.id}">
                    <span class="filter-avatar">${m.name.charAt(0)}</span>
                    ${escapeHtml(m.name)}
                </button>
            `;
        });
        container.innerHTML = html;

        container.querySelectorAll('.member-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentMemberFilter = btn.dataset.memberFilter;
                renderMemberFilter(trip);
                renderSchedule(trip, getTripDays(trip));
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
                    <div class="schedule-title">${escapeHtml(s.title)}</div>
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
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sid = btn.dataset.deleteSchedule;
                trip.schedules = trip.schedules.filter(s => s.id !== sid);
                saveState();
                renderSchedule(trip, days);
                showToast('予定を削除しました');
            });
        });
    }

    function addSchedule(tripId, date, time, endTime, title, isShared) {
        const trip = state.trips.find(t => t.id === tripId);
        if (!trip) return;

        trip.schedules.push({
            id: uuid(),
            date: date,
            time: time,
            endTime: endTime || '',
            title: title,
            isShared: isShared,
            createdBy: state.user.id,
        });
        saveState();
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
        document.getElementById('form-new-trip').addEventListener('submit', (e) => {
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

            createTrip(name, startDate, endDate, selectedFriends);
            closeAllModals();
            showToast('旅行を作成しました！ 🎉', 'success');
        });

        // Add friend button
        document.getElementById('btn-add-friend').addEventListener('click', () => {
            document.getElementById('friend-id-input').value = '';
            openModal('modal-add-friend');
        });

        // Add friend by ID form
        document.getElementById('form-add-friend-id').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('friend-id-input').value;
            if (addFriendById(id)) {
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

        // Logout
        document.getElementById('btn-logout').addEventListener('click', async () => {
            if (confirm('ログアウトしますか？')) {
                try {
                    await auth.signOut();
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
            const isShared = document.querySelector('.toggle-btn[data-scope].active').dataset.scope === 'shared';

            if (!time || !title) {
                showToast('すべての項目を入力してください', 'error');
                return;
            }

            if (endTime && endTime <= time) {
                showToast('終了時間は開始時間より後にしてください', 'error');
                return;
            }

            addSchedule(currentTripId, dayStr, time, endTime, title, isShared);
            closeAllModals();
            renderSchedule(trip, days);
            showToast('予定を追加しました！', 'success');
        });

        // Delete trip
        document.getElementById('btn-delete-trip').addEventListener('click', () => {
            if (confirm('この旅行を削除しますか？')) {
                state.trips = state.trips.filter(t => t.id !== currentTripId);
                saveState();
                goBack();
                renderHome();
                showToast('旅行を削除しました');
            }
        });
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
