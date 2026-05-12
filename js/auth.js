async function initAuth() {
    const { auth, db, doc, getDoc, setDoc, getRedirectResult } = window.fb;
    // 进入页面就先等 redirect 结果解析完，避免 onAuthStateChanged 先以 null 触发然后 UI 闪一下未登录态。
    if (getRedirectResult) {
        state.authStatus = 'loading';
        if (typeof Render === 'function') Render();
        try {
            await getRedirectResult(auth);
        } catch (err) {
            console.error('Redirect login failed:', err);
            const code = err?.code || '';
            // 用户主动取消或弹窗类错误不打扰；其它错误提示一下
            if (code && !['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/null-user'].includes(code)) {
                alert('登录回跳异常，请再试一次（如使用 iOS Safari，建议保持在前台等回跳完成）。\n错误码: ' + code);
            }
        }
    }
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Check if user exists in Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            let userData = userDoc.exists() ? userDoc.data() : null;

            if (!userData) {
                userData = {
                    uid: user.uid,
                    name: user.displayName || '未知用户',
                    email: user.email,
                    emoji: pickRandomEmoji(),
                    projectOrder: [], // 个人项目排序
                    pinnedProjects: [], // 个人置顶项目列表
                    createdAt: Date.now()
                };
                await setDoc(doc(db, "users", user.uid), userData);
            }

            // Ensure uid always exists on state.currentUser
            userData.uid = user.uid;
            state.currentUser = userData;

            // 在监听器返回数据之前，先用 localStorage 缓存即时填充 projects/tasks/users，
            // 避免新用户/标签页激活时出现"空白几秒"。
            hydrateCachedData(user.uid);

            // 从本地恢复展开的项目和上次浏览的视图
            try {
                const expRaw = localStorage.getItem('cs_expanded_projects');
                if (expRaw) {
                    const exp = JSON.parse(expRaw);
                    if (exp && typeof exp === 'object') {
                        state.expandedProjects = exp;
                    }
                }
            } catch (e) {
                console.warn('恢复展开项目状态失败:', e);
            }
            try {
                const viewRaw = localStorage.getItem('cs_last_view');
                if (viewRaw) {
                    const view = JSON.parse(viewRaw);
                    if (view && view.type) {
                        state.activeView = view;
                    }
                }
            } catch (e) {
                console.warn('恢复上次视图失败:', e);
            }
            state.authStatus = 'authenticated';
            startDataSync(user.uid);
        } else {
            state.currentUser = null;
            state.authStatus = 'unauthenticated';
            stopDataSync();
        }
        Render();
    });
}

function hydrateCachedData(uid) {
    try {
        const proj = localStorage.getItem(`cs_cache_projects_${uid}`);
        if (proj) {
            const arr = JSON.parse(proj);
            if (Array.isArray(arr) && arr.length) state.projects = arr;
        }
        const tasks = localStorage.getItem(`cs_cache_tasks_${uid}`);
        if (tasks) {
            const arr = JSON.parse(tasks);
            if (Array.isArray(arr) && arr.length) state.tasks = arr;
        }
        const users = localStorage.getItem(`cs_cache_users_${uid}`);
        if (users) {
            const arr = JSON.parse(users);
            if (Array.isArray(arr) && arr.length) state.users = arr;
        }
    } catch (e) {
        console.warn('从缓存填充数据失败:', e);
    }
}

function saveCache(key, uid, data) {
    try {
        localStorage.setItem(`cs_cache_${key}_${uid}`, JSON.stringify(data));
    } catch (e) {
        // localStorage 满了等错误忽略
    }
}

function startDataSync(uid) {
    const { db, collection, query, where, onSnapshot, doc, updateDoc } = window.fb;
    const MAX_LOCK_MS = 99 * 60 * 60 * 1000; // 99 小时
    // 标记首屏项目是否已收到首个权威快照；用于决定能否信任空快照。
    state.ui.projectsLoading = state.projects.length === 0;

    // 1. Sync All Users
    unsubs.users = onSnapshot(collection(db, "users"), (snap) => {
        // 来自缓存的空快照视为占位（断网/标签页休眠时），保留旧数据
        if (snap.empty && snap.metadata?.fromCache && state.users.length > 0) return;
        state.users = snap.docs.map(d => d.data());
        saveCache('users', uid, state.users);
        Render();
    });

    // 2. Sync My Projects
    const qProjects = query(collection(db, "projects"), where("memberIds", "array-contains", uid));
    unsubs.projects = onSnapshot(qProjects, (snap) => {
        if (snap.empty && snap.metadata?.fromCache && state.projects.length > 0) return;
        state.projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        saveCache('projects', uid, state.projects);
        state.ui.projectsLoading = false;
        Render();
    });

    // 3. Sync Tasks (only tasks under my projects)
    let pendingTodoChecked = false;
    unsubs.tasks = onSnapshot(collection(db, "tasks"), (snap) => {
        if (snap.empty && snap.metadata?.fromCache && state.tasks.length > 0) return;
        const prevTasksById = new Map(state.tasks.map(t => [t.id, t]));
        const allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const myProjectIds = new Set(state.projects.map(p => p.id));
        const nextTasks = allTasks.filter(t => myProjectIds.has(t.projectId));
        state.tasks = nextTasks;
        saveCache('tasks', uid, state.tasks);

        // 首次任务同步完成后，检查是否有上次未发出的待办草稿
        if (!pendingTodoChecked) {
            pendingTodoChecked = true;
            setTimeout(() => Actions.checkPendingTodoOnLogin(), 0);
        }

        // Animate todos added/edited by others (or other clients).
        nextTasks.forEach(t => {
            const prev = prevTasksById.get(t.id);
            if (!prev) return; // Skip first-seen tasks to avoid initial-load animation flood.
            const prevTodoById = new Map((prev.todos || []).map(td => [td.id, td]));
            (t.todos || []).forEach(td => {
                const prevTd = prevTodoById.get(td.id);
                const prevImgs = JSON.stringify(prevTd?.images || []);
                const currImgs = JSON.stringify(td.images || []);
                if (!prevTd || prevTd.text !== td.text || prevImgs !== currImgs) {
                    if (window.queueTodoAnimation) window.queueTodoAnimation(t.id, td.id);
                }
            });
        });

        // 检查占用是否超过 99 小时，自动视为放弃编辑并写入活动记录
        const now = Date.now();
        state.tasks.forEach(t => {
            if (t.isLocked && t.lockedAt && (now - t.lockedAt > MAX_LOCK_MS)) {
                const duration = now - t.lockedAt;
                const activities = [{
                    type: 'auto_discard',
                    userId: t.lockedBy,
                    timestamp: now,
                    duration
                }, ...(t.activities || [])];
                updateDoc(doc(db, 'tasks', t.id), {
                    isLocked: false,
                    lockedBy: null,
                    lockedAt: null,
                    activities
                }).catch(e => console.warn('自动释放超时锁失败:', t.id, e));
            }
        });

        Render();
    });
}

function stopDataSync() {
    Object.values(unsubs).forEach(fn => fn && fn());
    state.projects = [];
    state.tasks = [];
    state.users = [];
}

// Wait for Firebase module to expose fb to window
const checkFB = setInterval(() => {
    if (window.fb) {
        clearInterval(checkFB);
        initAuth();
    }
}, 100);
