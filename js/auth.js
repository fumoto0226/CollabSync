function initAuth() {
    const { auth, db, doc, getDoc, setDoc } = window.fb;
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

function startDataSync(uid) {
    const { db, collection, query, where, onSnapshot, doc, updateDoc } = window.fb;
    const MAX_LOCK_MS = 99 * 60 * 60 * 1000; // 99 小时

    // 1. Sync All Users
    unsubs.users = onSnapshot(collection(db, "users"), (snap) => {
        state.users = snap.docs.map(d => d.data());
        Render();
    });

    // 2. Sync My Projects
    const qProjects = query(collection(db, "projects"), where("memberIds", "array-contains", uid));
    unsubs.projects = onSnapshot(qProjects, (snap) => {
        state.projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        Render();
    });

    // 3. Sync Tasks (only tasks under my projects)
    unsubs.tasks = onSnapshot(collection(db, "tasks"), (snap) => {
        const prevTasksById = new Map(state.tasks.map(t => [t.id, t]));
        const allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const myProjectIds = new Set(state.projects.map(p => p.id));
        const nextTasks = allTasks.filter(t => myProjectIds.has(t.projectId));
        state.tasks = nextTasks;

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
