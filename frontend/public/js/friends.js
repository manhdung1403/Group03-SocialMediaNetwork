(async () => {
    const baseUrl = window.location.origin === 'http://127.0.0.1:5500' || window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
    const usersList = document.getElementById('usersList');
    const searchInput = document.getElementById('searchInput');
    const tabAll = document.getElementById('tabAll');
    const tabFollowing = document.getElementById('tabFollowing');
    let allUsers = [];
    let currentTab = 'all';

    async function ensureAuth() {
        const r = await fetch(`${baseUrl}/api/auth/status`, { credentials: 'include' });
        const d = await r.json();
        if (!d.loggedIn) location.href = `${baseUrl}/user/login.html`;
        return d.user;
    }

    async function loadUsers() {
        usersList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i>Đang tải...</div>';
        const r = await fetch(`${baseUrl}/api/users`, { credentials: 'include' });
        allUsers = await r.json();
        render(allUsers);
    }

    function goToProfile(userId) {
        location.href = `${baseUrl}/user/profile.html?userId=${userId}`;
    }

    function getFiltered() {
        const q = searchInput.value.trim().toLowerCase();
        let list = currentTab === 'following' ? allUsers.filter(u => u.is_following) : allUsers;
        if (q) list = list.filter(u => u.username.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q));
        return list;
    }

    function render(users) {
        if (!users.length) {
            usersList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-slash"></i>Không tìm thấy người dùng</div>';
            return;
        }
        usersList.innerHTML = '';
        users.forEach(u => {
            const card = document.createElement('div');
            card.className = 'user-card';

            const avatarLetter = (u.username || 'U').charAt(0).toUpperCase();
            const avatarHtml = u.avatar
                ? `<img src="${u.avatar}" alt="${u.username}">`
                : avatarLetter;

            card.innerHTML = `
                <div class="avatar-link" data-id="${u.id}">
                    <div class="avatar">${avatarHtml}</div>
                </div>
                <div class="user-info">
                    <span class="name-link" data-id="${u.id}">${u.username}</span>
                    ${u.full_name ? `<span class="user-fullname">${u.full_name}</span>` : ''}
                </div>
                <div class="actions">
                    <button class="btn-follow ${u.is_following ? 'following' : ''}" data-id="${u.id}">
                        ${u.is_following ? 'Đang theo dõi' : 'Theo dõi'}
                    </button>
                    <button class="btn-chat" data-id="${u.id}">
                        <i class="fa-solid fa-comment"></i> <span>Nhắn tin</span>
                    </button>
                </div>`;

            // Navigate to profile
            card.querySelector('.avatar-link').addEventListener('click', () => goToProfile(u.id));
            card.querySelector('.name-link').addEventListener('click', () => goToProfile(u.id));

            // Follow / Unfollow
            const followBtn = card.querySelector('.btn-follow');
            followBtn.addEventListener('click', async () => {
                followBtn.disabled = true;
                if (u.is_following) {
                    await fetch(`${baseUrl}/api/unfollow`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ userId: u.id }) });
                    u.is_following = 0;
                } else {
                    await fetch(`${baseUrl}/api/follow`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ userId: u.id }) });
                    u.is_following = 1;
                }
                followBtn.disabled = false;
                render(getFiltered());
            });

            // Chat
            const chatBtn = card.querySelector('.btn-chat');
            chatBtn.addEventListener('click', async () => {
                chatBtn.disabled = true;
                try {
                    const r = await fetch(`${baseUrl}/api/conversations`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantIds: [u.id], title: u.username }) });
                    const data = await r.json();
                    if (data && data.id) {
                        location.href = `${baseUrl}/chat.html?conv=${data.id}`;
                        return;
                    }
                    alert('Không tạo được cuộc trò chuyện');
                } catch {
                    alert('Lỗi khi tạo cuộc trò chuyện');
                } finally {
                    chatBtn.disabled = false;
                }
            });

            usersList.appendChild(card);
        });
    }

    searchInput.addEventListener('input', () => render(getFiltered()));

    tabAll.addEventListener('click', () => {
        currentTab = 'all';
        tabAll.classList.add('active');
        tabFollowing.classList.remove('active');
        render(getFiltered());
    });

    tabFollowing.addEventListener('click', () => {
        currentTab = 'following';
        tabFollowing.classList.add('active');
        tabAll.classList.remove('active');
        render(getFiltered());
    });

    // Handle bfcache
    window.addEventListener('pageshow', (ev) => {
        if (ev.persisted) loadUsers();
    });

    await ensureAuth();
    await loadUsers();
})();
