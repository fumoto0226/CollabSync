// --- Actions ---

// 工具函数：检查当前用户是否已激活（且未过期，或永久激活）
function isUserActivated() {
    const u = state.currentUser;
    if (!u) return false;
    // 管理员始终视为已激活
    if (u.uid === '0gKyPFlHBGg6jdljKDZ02gP8zGl1') return true;
    // 永久激活
    if (u.activationInfinite) return true;
    if (!u.activationExpiresAt) return false;
    const expiresMs = u.activationExpiresAt.seconds
        ? u.activationExpiresAt.seconds * 1000
        : u.activationExpiresAt;
    return Date.now() < expiresMs;
}

const Actions = {
    login: async () => {
        const { auth, googleProvider, signInWithPopup, signInWithRedirect } = window.fb;
        // 优先尝试弹窗登录（移动端也支持）。仅当弹窗被浏览器拦截或环境不支持时才回退到 redirect。
        // signInWithRedirect 在 iOS Safari / 移动端 Chrome 上常因 ITP 导致回跳后 session 丢失，
        // 所以尽量避免使用它。
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            const code = err?.code || '';
            const fallbackCodes = new Set([
                'auth/popup-blocked',
                'auth/popup-closed-by-user',
                'auth/cancelled-popup-request',
                'auth/operation-not-supported-in-this-environment'
            ]);
            if (fallbackCodes.has(code)) {
                try {
                    await signInWithRedirect(auth, googleProvider);
                    return;
                } catch (e2) {
                    console.error('Redirect login fallback failed:', e2);
                    alert('登录失败，请重试');
                    return;
                }
            }
            console.error('Login failed:', err);
            alert('登录失败，请重试');
        }
    },
    logout: async () => {
        const { auth, signOut } = window.fb;
        await signOut(auth);
        state.activeView = { type: 'welcome' };
        state.ui.mobilePane = 'sidebar';
        try {
            localStorage.removeItem('cs_last_view');
        } catch (e) { }
        state.ui.profileModalOpen = false;
        Render();
    },
    setView: (view) => {
        if (state.authStatus !== 'authenticated') return;
        state.activeView = view;
        if (state.ui.isMobile) {
            state.ui.mobilePane = view.type === 'welcome' ? 'sidebar' : 'main';
        }
        if (view.type === 'project_dashboard') Actions.fetchSummary(view.projectId);
        try {
            localStorage.setItem('cs_last_view', JSON.stringify(view));
        } catch (e) { }
        Render();
    },
    goMobileSidebar: () => {
        state.ui.mobilePane = 'sidebar';
        Render();
    },
    trimTrailingTodoBreaks: (html) => {
        const raw = String(html || '');
        if (!raw) return '';
        const box = document.createElement('div');
        box.innerHTML = raw;

        const hasMeaningfulContent = (el) => {
            if (!el) return false;
            const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
            return !!text || !!el.querySelector('img, .todo-mention');
        };

        const pruneTrailing = (node) => {
            while (node && node.lastChild) {
                const last = node.lastChild;
                if (last.nodeType === Node.TEXT_NODE) {
                    const trimmed = (last.textContent || '').replace(/[\s\u00a0]+$/g, '');
                    if (!trimmed) {
                        last.remove();
                        continue;
                    }
                    if (trimmed !== last.textContent) {
                        last.textContent = trimmed;
                    }
                    break;
                }
                if (last.nodeType === Node.ELEMENT_NODE) {
                    if (last.tagName === 'BR') {
                        last.remove();
                        continue;
                    }
                    pruneTrailing(last);
                    if ((last.tagName === 'DIV' || last.tagName === 'P') && !hasMeaningfulContent(last)) {
                        last.remove();
                        continue;
                    }
                    break;
                }
                break;
            }
        };

        pruneTrailing(box);
        return box.innerHTML.trim();
    },

    // ===== Pending Todo Draft (recovery after interrupted send) =====
    _pendingTodoKey: () => {
        const uid = state.currentUser?.uid || 'anon';
        return `cs_pending_todo_${uid}`;
    },
    savePendingTodoDraft: (tid, { html, priority }) => {
        try {
            const t = state.tasks.find(x => x.id === tid);
            const project = t ? state.projects.find(p => p.id === t.projectId) : null;
            const images = (state.ui.editorImages || []).map(img => {
                if (typeof img !== 'object' || !img) return null;
                return {
                    name: img.name || '图片',
                    // 已上传的图片 URL 可以恢复；未上传的本地 File 无法持久化
                    url: img.file ? null : (img.url || img.previewUrl || null),
                    pending: !!img.file
                };
            }).filter(Boolean);
            const record = {
                taskId: tid,
                taskName: t?.name || '',
                projectId: t?.projectId || null,
                projectName: project?.name || '',
                html: html || '',
                priority: priority || 'none',
                images,
                savedAt: Date.now()
            };
            localStorage.setItem(Actions._pendingTodoKey(), JSON.stringify(record));
        } catch (e) {
            console.warn('保存待办草稿失败:', e);
        }
    },
    clearPendingTodoDraft: (tid) => {
        try {
            const raw = localStorage.getItem(Actions._pendingTodoKey());
            if (!raw) return;
            const rec = JSON.parse(raw);
            if (!tid || rec.taskId === tid) {
                localStorage.removeItem(Actions._pendingTodoKey());
            }
        } catch (e) {
            console.warn('清除待办草稿失败:', e);
        }
    },
    loadPendingTodoDraft: () => {
        try {
            const raw = localStorage.getItem(Actions._pendingTodoKey());
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    },
    checkPendingTodoOnLogin: () => {
        const rec = Actions.loadPendingTodoDraft();
        if (!rec) return;
        // 至少要有内容或图片占位才提示
        const hasContent = (rec.html && rec.html.trim()) || (rec.images && rec.images.length);
        if (!hasContent) {
            Actions.clearPendingTodoDraft();
            return;
        }
        state.ui.pendingTodoRecovery = rec;
        Render();
    },
    restorePendingTodoDraft: () => {
        const rec = state.ui.pendingTodoRecovery;
        if (!rec) return;
        const t = state.tasks.find(x => x.id === rec.taskId);
        if (!t) {
            alert('原任务已不存在，无法恢复草稿。');
            Actions.dismissPendingTodoRecovery();
            return;
        }
        // 跳转到任务详情并打开编辑器
        state.activeView = { type: 'task_detail', projectId: t.projectId, taskId: t.id };
        state.ui.editorTaskId = t.id;
        state.ui.editorContent = rec.html || '';
        state.ui.editorPriority = rec.priority || 'none';
        // 恢复已上传的图片 URL；本地 File 已丢失，提示用户重新添加
        const restorableImages = (rec.images || [])
            .filter(img => img && img.url && !img.pending)
            .map((img, idx) => ({
                id: `restored:${idx}:${Date.now()}`,
                name: img.name || `图片${idx + 1}`,
                url: img.url,
                previewUrl: img.url,
                file: null
            }));
        state.ui.editorImages = restorableImages;
        const missingCount = (rec.images || []).filter(img => img && img.pending).length;
        state.ui.pendingTodoRecovery = null;
        Actions.clearPendingTodoDraft();
        state.ui.todoScrollTarget = { type: 'editor', taskId: t.id };
        Render();
        if (missingCount > 0) {
            setTimeout(() => alert(`已恢复未发送的待办内容。其中有 ${missingCount} 张图片当时还未上传完成，已丢失，请重新添加。`), 0);
        }
    },
    dismissPendingTodoRecovery: () => {
        state.ui.pendingTodoRecovery = null;
        Actions.clearPendingTodoDraft();
        Render();
    },

    toggleProject: (pid) => {
        state.expandedProjects[pid] = !state.expandedProjects[pid];
        try {
            localStorage.setItem('cs_expanded_projects', JSON.stringify(state.expandedProjects));
        } catch (e) { }
        Render();
    },
    startSidebarResize: (event) => {
        if (!event) return;
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = state.ui.sidebarWidth || 280;
        const MIN_W = 240;
        const MAX_W = 460;

        state.ui.isSidebarResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = (e) => {
            const next = Math.max(MIN_W, Math.min(MAX_W, startWidth + (e.clientX - startX)));
            if (next === state.ui.sidebarWidth) return;
            state.ui.sidebarWidth = next;
            Render();
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            state.ui.isSidebarResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            try {
                localStorage.setItem('cs_sidebar_width', String(state.ui.sidebarWidth || 280));
            } catch (e) { }
            Render();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    },
    openProjectContextMenu: (event, pid) => {
        if (!event) return;
        event.preventDefault();
        event.stopPropagation();
        state.contextMenu.visible = true;
        state.contextMenu.x = event.clientX;
        state.contextMenu.y = event.clientY;
        state.contextMenu.projectId = pid;
        state.contextMenu.taskId = null;
        Render();
    },
    markProjectCompleted: async (pid) => {
        const { db, doc, updateDoc } = window.fb;
        try {
            const now = Date.now();
            const p = state.projects.find(p => p.id === pid);
            const nextCompleted = !(p?.completed);
            await updateDoc(doc(db, 'projects', pid), {
                completed: nextCompleted,
                completedAt: nextCompleted ? now : null
            });
            if (p) {
                p.completed = nextCompleted;
                p.completedAt = nextCompleted ? now : null;
            }
        } catch (err) {
            console.error('标记项目完成失败:', err);
            alert('标记项目完成失败，请检查权限');
        }
        Actions.closeContextMenu();
    },

    // Creation Flows
    initNewProject: () => {
        state.draft = { name: '', desc: '', members: [], memberSearchInput: '', file: null, fileNote: '', kind: 'text', projectId: null };
        state.ui.draftSearchResult = null;
        Actions.setView({ type: 'new_project' });
    },
    initNewTask: (pid) => {
        state.draft = { name: '', desc: '', members: [], memberSearchInput: '', file: null, fileNote: '', kind: 'text', projectId: pid };
        Actions.setView({ type: 'new_task', projectId: pid });
    },
    updateDraft: (key, value) => {
        state.draft[key] = value;
        if (key !== 'name' && key !== 'desc' && key !== 'memberSearchInput') Render();
    },
    draftSearchMember: async () => {
        const input = state.draft.memberSearchInput.trim();
        if (!input) {
            state.ui.draftSearchResult = null;
            Render();
            return;
        }

        const { db, collection, query, where, getDocs } = window.fb;

        try {
            const q = query(collection(db, "users"), where("email", "==", input));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                state.ui.draftSearchResult = { found: false };
                console.log("未找到邮箱为:", input);
            } else {
                const userDoc = querySnapshot.docs[0];
                const user = { uid: userDoc.id, ...userDoc.data() };
                state.ui.draftSearchResult = { found: true, user };
                console.log("找到用户:", user);
            }
            Render();
        } catch (err) {
            console.error("搜索用户失败:", err);
            state.ui.draftSearchResult = { found: false, error: err.message };
            alert("搜索用户失败: " + err.message);
            Render();
        }
    },
    draftAddMember: async () => {
        const result = state.ui.draftSearchResult;
        if (!result || !result.found) return;

        const user = result.user;

        // 检查是否已经添加
        if (user.uid === state.currentUser.uid) {
            alert("不能添加自己作为成员");
            return;
        }

        if (state.draft.members.find(m => m.uid === user.uid)) {
            alert("该用户已在成员列表中");
            return;
        }

        state.draft.members.push(user);
        state.draft.memberSearchInput = '';
        state.ui.draftSearchResult = null;
        Render();
    },
    draftRemoveMember: (uid) => {
        state.draft.members = state.draft.members.filter(m => m.uid !== uid);
        Render();
    },
    submitNewProject: async () => {
        const { db, collection, addDoc, doc, updateDoc, arrayUnion } = window.fb;
        const { name, desc, members } = state.draft;
        if (!name) { alert("请输入项目名称"); return; }

        try {
            // 创建项目时，确保至少包含创建者本人（即当前登录用户），并且该创建者是 owner
            // 统一使用 uid 作为成员标识
            const memberIds = Array.from(new Set([
                state.currentUser.uid,
                ...members.map(m => m.uid).filter(Boolean)
            ]));

            const newProjectData = {
                name,
                description: desc || '暂无描述',
                memberIds: memberIds,
                members: memberIds, // 保持冗余以兼容旧代码
                ownerId: state.currentUser.uid,
                createdAt: Date.now()
            };
            const docRef = await addDoc(collection(db, "projects"), newProjectData);

            // 更新所有成员的 projectIds（双向同步）
            await Promise.all(memberIds.map(uid =>
                updateDoc(doc(db, "users", uid), {
                    projectIds: arrayUnion(docRef.id)
                }).catch(e => console.warn("Failed to update user projectIds:", uid, e))
            ));

            state.expandedProjects[docRef.id] = true;
            try {
                localStorage.setItem('cs_expanded_projects', JSON.stringify(state.expandedProjects));
            } catch (e) { }
            Actions.setView({ type: 'project_dashboard', projectId: docRef.id });
        } catch (err) {
            console.error("Error adding project:", err);
            alert("创建项目失败，请检查数据库权限");
        }
    },
    handleDraftFileChange: (file) => {
        const MAX_SIZE = 3 * 1024 * 1024; // 3MB
        if (file && file.size > MAX_SIZE) {
            alert('初始文件大小不能超过 3MB，请选择更小的文件。');
            state.draft.file = null;
        } else {
            state.draft.file = file || null;
        }
        Render();
    },
    submitNewTask: async () => {
        const { db, collection, addDoc, doc, updateDoc, storage, ref, uploadBytes, getDownloadURL, query, where, getDocs } = window.fb;
        const { projectId, name, desc, file, fileNote, kind } = state.draft;
        if (!name) { alert("请输入任务名称"); return; }

        try {
            // 计算新任务的 order：比当前项目所有任务的最大 order 大 1
            const projectTasks = state.tasks.filter(t => t.projectId === projectId);
            const maxOrder = projectTasks.reduce((max, t) => Math.max(max, t.order || 0), 0);
            const newOrder = maxOrder + 1;

            const baseTaskData = {
                projectId,
                name,
                description: desc || '...',
                todos: [],
                file: null,
                isLocked: false,
                lockedBy: null,
                activities: [],
                completed: false,
                kind: kind || 'text',
                order: newOrder,
                createdAt: Date.now()
            };
            const docRef = await addDoc(collection(db, "tasks"), baseTaskData);

            // 如果是文件任务且有初始文件，上传到 Storage 并更新任务
            if ((kind === 'file' || !kind) && file) {
                const tid = docRef.id;
                const path = `tasks/${tid}/v1/${file.name}`;
                const storageRef = ref(storage, path);

                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);

                const note = (fileNote || '').trim();

                const fileObj = {
                    name: file.name,
                    size: formatFileSize(file.size),
                    bytes: file.size,
                    lastUpdated: new Date().toISOString(),
                    version: 1,
                    downloadURL: url,
                    path,
                    note
                };

                const activities = [{
                    type: 'upload',
                    userId: state.currentUser.uid,
                    timestamp: Date.now(),
                    duration: 0,
                    version: 1,
                    size: formatFileSize(file.size),
                    downloadURL: url,
                    path,
                    note
                }];

                try {
                    await updateDoc(doc(db, "tasks", tid), {
                        file: fileObj,
                        activities
                    });
                } catch (err) {
                    console.warn("创建任务时更新文件信息到 Firestore 失败（列表将由 onSnapshot 同步）:", err);
                }
            }

            Actions.setView({ type: 'task_detail', projectId, taskId: docRef.id });
        } catch (err) {
            console.error("Error adding task:", err);
            alert("创建任务失败，请检查数据库权限");
        }
    },
    cancelCreation: () => {
        if (state.draft.projectId) Actions.setView({ type: 'project_dashboard', projectId: state.draft.projectId });
        else Actions.setView({ type: 'welcome' });
    },

    // Project & Task Editing
    openEditProjectModal: (pid) => {
        state.ui.editProjectId = pid;
        Render();
    },
    closeEditProjectModal: () => {
        state.ui.editProjectId = null;
        Render();
    },
    saveProjectEdit: async () => {
        const { db, doc, updateDoc } = window.fb;
        const pid = state.ui.editProjectId;
        if (!pid) return;
        const p = state.projects.find(p => p.id === pid);
        if (!p) return;

        const nameInput = document.getElementById('edit-project-name');
        const descInput = document.getElementById('edit-project-desc');
        const name = nameInput?.value.trim() || '';
        const desc = descInput?.value.trim() || '';
        if (!name) {
            alert('项目名称不能为空');
            return;
        }

        p.name = name;
        p.description = desc || '';

        try {
            await updateDoc(doc(db, 'projects', pid), {
                name: p.name,
                description: p.description
            });
        } catch (err) {
            console.error('更新项目失败:', err);
            alert('更新项目失败，请检查权限');
        }

        state.ui.editProjectId = null;
        Render();
    },
    openEditTaskModal: (tid) => {
        state.ui.editTaskId = tid;
        Render();
    },
    closeEditTaskModal: () => {
        state.ui.editTaskId = null;
        Render();
    },
    saveTaskEdit: async () => {
        const { db, doc, updateDoc } = window.fb;
        const tid = state.ui.editTaskId;
        if (!tid) return;
        const t = state.tasks.find(t => t.id === tid);
        if (!t) return;

        const nameInput = document.getElementById('edit-task-name');
        const descInput = document.getElementById('edit-task-desc');
        const name = nameInput?.value.trim() || '';
        const desc = descInput?.value.trim() || '';
        if (!name) {
            alert('任务名称不能为空');
            return;
        }

        t.name = name;
        t.description = desc || '';

        try {
            await updateDoc(doc(db, 'tasks', tid), {
                name: t.name,
                description: t.description
            });
        } catch (err) {
            console.error('更新任务失败:', err);
            alert('更新任务失败，请检查权限');
        }

        state.ui.editTaskId = null;
        Render();
    },

    // Member & Action Modals
    openMemberModal: (pid) => {
        state.ui.memberModalProjectId = pid;
        state.ui.inviteInput = '';
        state.ui.inviteSearchResult = null;
        Render();
    },
    closeMemberModal: () => {
        state.ui.memberModalProjectId = null;
        state.ui.inviteSearchResult = null;
        Render();
    },
    toggleMemberListExpanded: (pid) => {
        state.ui.memberListExpandedByProjectId[pid] = !state.ui.memberListExpandedByProjectId[pid];
        Render();
    },
    openMyWorkPopover: () => { state.ui.myWorkPopoverOpen = true; Render(); },
    closeMyWorkPopover: () => { state.ui.myWorkPopoverOpen = false; Render(); },
    toggleMyWorkPopover: () => { state.ui.myWorkPopoverOpen = !state.ui.myWorkPopoverOpen; Render(); },
    randomizeMyEmoji: async () => {
        const { db, doc, updateDoc } = window.fb;
        const newEmoji = pickRandomEmoji();
        state.currentUser.emoji = newEmoji;
        setStoredEmoji(state.currentUser.uid, newEmoji);

        // 同步到 Firestore
        try {
            await updateDoc(doc(db, "users", state.currentUser.uid), {
                emoji: newEmoji
            });
        } catch (err) {
            console.error("Failed to update emoji:", err);
        }

        Render();
    },
    openProfileModal: () => {
        state.ui.profileModalOpen = true;
        state.ui.settingsPopoverOpen = false;
        state.ui.languagePickerOpen = false;
        Render();
    },
    closeProfileModal: () => {
        state.ui.profileModalOpen = false;
        Render();
    },
    toggleSettingsPopover: () => {
        state.ui.settingsPopoverOpen = !state.ui.settingsPopoverOpen;
        state.ui.languagePickerOpen = false;
        Render();
    },
    closeSettingsPopover: () => {
        state.ui.settingsPopoverOpen = false;
        state.ui.languagePickerOpen = false;
        Render();
    },
    toggleLanguagePicker: () => {
        state.ui.languagePickerOpen = !state.ui.languagePickerOpen;
        Render();
    },
    setLocale: (lang) => {
        if (lang !== 'zh' && lang !== 'ja') return;
        state.locale = lang;
        try { localStorage.setItem('cs_locale', lang); } catch (e) {}
        state.ui.settingsPopoverOpen = false;
        state.ui.languagePickerOpen = false;
        Render();
    },
    saveProfile: async () => {
        const { db, doc, updateDoc } = window.fb;
        const input = document.getElementById('edit-profile-name');
        if (!input) return;
        const newName = input.value.trim();
        if (!newName) {
            alert('用户名不能为空');
            return;
        }
        state.currentUser.name = newName;
        try {
            await updateDoc(doc(db, 'users', state.currentUser.uid), {
                name: newName
            });
        } catch (err) {
            console.error('更新用户名失败:', err);
            alert('更新用户名失败，请检查权限');
        }
        state.ui.profileModalOpen = false;
        Render();
    },
    inviteSearchMember: async () => {
        const input = state.ui.inviteInput.trim();
        if (!input) {
            state.ui.inviteSearchResult = null;
            Render();
            return;
        }

        const { db, collection, query, where, getDocs } = window.fb;

        try {
            const q = query(collection(db, "users"), where("email", "==", input));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                state.ui.inviteSearchResult = { found: false };
                console.log("未找到邮箱为:", input);
            } else {
                const userDoc = querySnapshot.docs[0];
                const user = { uid: userDoc.id, ...userDoc.data() };
                state.ui.inviteSearchResult = { found: true, user };
                console.log("找到用户:", user);
            }
            Render();
        } catch (err) {
            console.error("搜索用户失败:", err);
            state.ui.inviteSearchResult = { found: false, error: err.message };
            alert("搜索用户失败: " + err.message);
            Render();
        }
    },
    inviteMember: async () => {
        const result = state.ui.inviteSearchResult;
        if (!result || !result.found) return;

        const user = result.user;
        const pid = state.ui.memberModalProjectId;
        const { db, doc, updateDoc, arrayUnion } = window.fb;

        const p = state.projects.find(p => p.id === pid);

        // 检查是否已经是成员
        if ((p.memberIds || []).includes(user.uid)) {
            alert("该用户已是项目成员");
            return;
        }

        try {
            // 更新项目成员列表
            await updateDoc(doc(db, "projects", pid), {
                memberIds: arrayUnion(user.uid),
                members: arrayUnion(user.uid)
            });

            // 更新用户的 projectIds
            await updateDoc(doc(db, "users", user.uid), {
                projectIds: arrayUnion(pid)
            }).catch(e => console.warn('Failed to update user projectIds:', e));

            state.ui.inviteInput = '';
            state.ui.inviteSearchResult = null;
            Render();
        } catch (err) {
            console.error("Error inviting member:", err);
            alert("邀请成员失败，请重试");
        }
    },
    deleteProject: async (pid) => {
        const { db, doc, deleteDoc, collection, query, where, getDocs, updateDoc, arrayRemove, getDoc } = window.fb;
        try {
            const pRef = doc(db, "projects", pid);
            const pSnap = await getDoc(pRef);
            if (!pSnap.exists()) {
                console.error("项目不存在:", pid);
                return;
            }
            const pData = pSnap.data();
            const memberIds = pData.memberIds || [];

            console.log("开始删除项目:", pid, "成员:", memberIds);

            // 1. Delete all tasks under this project (and their Storage files)
            const qTasks = query(collection(db, "tasks"), where("projectId", "==", pid));
            const tasksSnap = await getDocs(qTasks);
            console.log("删除任务数量:", tasksSnap.docs.length);
            for (const tDoc of tasksSnap.docs) {
                const tData = tDoc.data();
                const paths = [];
                if (tData.file?.path) paths.push(tData.file.path);
                (tData.activities || []).forEach(act => {
                    if (act.type === 'upload' && act.path) paths.push(act.path);
                });
                const todoImageTargets = Actions.collectTodoImageTargets(tData.todos || []);
                await Actions.deleteStorageTargets([...paths, ...todoImageTargets]);
                await deleteDoc(tDoc.ref);
            }

            // 2. Remove project from all members' users doc
            await Promise.all(memberIds.map(uid =>
                updateDoc(doc(db, "users", uid), { projectIds: arrayRemove(pid) }).catch(e => console.warn("Failed to update user projectIds:", uid, e))
            ));

            // 3. Delete the project document
            await deleteDoc(pRef);
            console.log("项目删除成功");

            // 4. 本地立即清理
            state.projects = state.projects.filter(p => p.id !== pid);
            state.tasks = state.tasks.filter(t => t.projectId !== pid);

            if (state.activeView.type === 'project_dashboard' && state.activeView.projectId === pid) {
                Actions.setView({ type: 'welcome' });
            }
        } catch (err) {
            console.error("删除项目失败:", err);
            console.error("错误详情:", err.code, err.message);
            alert("删除项目失败: " + (err.message || "请检查权限"));
        }
    },
    leaveProject: async (pid) => {
        const { db, doc, updateDoc, arrayRemove, getDoc } = window.fb;
        const uid = state.currentUser.uid;

        try {
            const pRef = doc(db, "projects", pid);
            const pSnap = await getDoc(pRef);
            if (!pSnap.exists()) return;

            const pData = pSnap.data();
            const ownerId = pData.ownerId;

            // owner 不允许“退出项目”，应该走“删除项目”
            if (ownerId && ownerId === uid) {
                alert("你是该项目 Owner，不能退出项目；请使用删除项目。");
                return;
            }

            // 1) 从项目成员中移除
            await updateDoc(pRef, {
                memberIds: arrayRemove(uid),
                members: arrayRemove(uid)
            });

            // 2) 从用户的 projectIds 中移除
            await updateDoc(doc(db, "users", uid), {
                projectIds: arrayRemove(pid)
            });

            // 3) 本地状态立即移除，确保侧边栏立刻消失（即使监听回调有延迟）
            state.projects = state.projects.filter(p => p.id !== pid);
            state.tasks = state.tasks.filter(t => t.projectId !== pid);

            Actions.setView({ type: 'welcome' });
        } catch (err) {
            console.error("Error leaving project:", err);
            alert("退出项目失败");
        }
    },
    openActionModal: (tid) => { state.ui.actionModalTaskId = tid; Render(); },
    closeActionModal: () => { state.ui.actionModalTaskId = null; Render(); },

    // Task Context Menu (Sidebar Right Click)
    openTaskContextMenu: (event, projectId, taskId) => {
        if (!event) return;
        event.preventDefault();
        event.stopPropagation();

        state.contextMenu.visible = true;
        state.contextMenu.x = event.clientX;
        state.contextMenu.y = event.clientY;
        state.contextMenu.taskId = taskId;
        state.contextMenu.projectId = projectId;
        Render();
    },
    closeContextMenu: () => {
        if (!state.contextMenu.visible) return;
        state.contextMenu.visible = false;
        state.contextMenu.taskId = null;
        state.contextMenu.projectId = null;
        Render();
    },
    deleteTask: (tid) => {
        // 此函数现在仅用于老代码兼容，真正删除走 deleteTaskReal
        const t = state.tasks.find(x => x.id === tid);
        if (!t) return;
        if (state.activeView.type === 'task_detail' && state.activeView.taskId === tid) {
            Actions.setView({ type: 'project_dashboard', projectId: t.projectId });
        }
        state.tasks = state.tasks.filter(x => x.id !== tid);
        Actions.closeContextMenu();
        Render();
    },
    deleteTaskReal: async (tid) => {
        // 真正从 Firestore 删除任务，并清理 Storage 文件
        const { db, doc, deleteDoc } = window.fb;
        const t = state.tasks.find(x => x.id === tid);
        if (!t) return;

        try {
            // 先删除 Storage 中的所有版本文件
            const paths = [];
            if (t.file?.path) paths.push(t.file.path);
            (t.activities || []).forEach(act => {
                if (act.type === 'upload' && act.path) paths.push(act.path);
            });
            const todoImageTargets = Actions.collectTodoImageTargets(t.todos || []);
            await Actions.deleteStorageTargets([...paths, ...todoImageTargets]);

            await deleteDoc(doc(db, "tasks", tid));
            // 本地立刻清理
            state.tasks = state.tasks.filter(x => x.id !== tid);
            if (state.activeView.type === 'task_detail' && state.activeView.taskId === tid) {
                Actions.setView({ type: 'project_dashboard', projectId: t.projectId });
            }
            Actions.closeContextMenu();
            Render();
        } catch (err) {
            console.error("Error deleting task:", err);
            alert("删除任务失败，请检查权限");
        }
    },
    toggleTaskCompleted: async (tid, completed) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(x => x.id === tid);
        if (!t) return;
        t.completed = !!completed;
        t.completedAt = t.completed ? Date.now() : null;

        // 完成任务时，若当前我正在编辑该任务，则强制释放锁，避免“已完成但仍占用”
        if (t.completed) {
            t.isLocked = false;
            t.lockedBy = null;
            t.lockedAt = null;
        }

        try {
            await updateDoc(doc(db, 'tasks', tid), {
                completed: t.completed,
                completedAt: t.completedAt,
                isLocked: t.isLocked,
                lockedBy: t.lockedBy,
                lockedAt: t.lockedAt
            });
        } catch (err) {
            console.warn('更新任务完成状态到 Firestore 失败（本地仍已更新）:', err);
        }

        Actions.closeContextMenu();
        Render();
    },

    // Confirmation Modals
    openConfirmModal: (type, id, title, message) => {
        state.confirmModal = { visible: true, type, id, title, message };
        Render();
    },
    closeConfirmModal: () => {
        state.confirmModal.visible = false;
        Render();
    },
    handleConfirm: async () => {
        const { type, id } = state.confirmModal;
        Actions.closeConfirmModal();
        if (type === 'delete_project') {
            await Actions.deleteProject(id);
        } else if (type === 'delete_task') {
            await Actions.deleteTaskReal(id);
        } else if (type === 'leave_project') {
            await Actions.leaveProject(id);
        } else if (type === 'discard_changes') {
            await Actions.discardChanges(id);
        } else if (type === 'delete_activation') {
            await Actions.deleteActivationCode(id);
        }
    },

    // History & Edit History
    openHistoryModal: (tid) => { state.ui.historyModalTaskId = tid; Render(); },
    closeHistoryModal: () => { state.ui.historyModalTaskId = null; Render(); },
    openStartModal: (tid) => { state.ui.startModalTaskId = tid; Render(); },
    closeStartModal: () => { state.ui.startModalTaskId = null; Render(); },
    openEditHistoryModal: (tid) => { state.ui.editHistoryModalTaskId = tid; Render(); },
    closeEditHistoryModal: () => { state.ui.editHistoryModalTaskId = null; Render(); },
    openGithubLinkModal: (tid) => {
        state.ui.githubLinkTaskId = tid;
        Render();
    },
    closeGithubLinkModal: () => {
        state.ui.githubLinkTaskId = null;
        Render();
    },
    parseGithubRepoUrl: (input) => {
        const raw = String(input || '').trim();
        if (!raw) return null;
        try {
            const normalized = raw.startsWith('http') ? raw : `https://${raw}`;
            const url = new URL(normalized);
            if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
            const parts = url.pathname.split('/').filter(Boolean);
            if (parts.length < 2) return null;
            const owner = parts[0];
            const repo = parts[1].replace(/\.git$/i, '');
            if (!owner || !repo) return null;
            return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}` };
        } catch (e) {
            return null;
        }
    },
    saveGithubLink: async () => {
        const { db, doc, updateDoc } = window.fb;
        const tid = state.ui.githubLinkTaskId;
        if (!tid) return;
        const task = state.tasks.find(t => t.id === tid);
        if (!task) return;

        const input = document.getElementById('github-repo-url');
        const parsed = Actions.parseGithubRepoUrl(input?.value || '');
        if (!parsed) {
            alert('请输入公开 GitHub 仓库地址，例如 https://github.com/owner/repo');
            return;
        }

        try {
            const resp = await fetch(`https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`, {
                headers: { 'Accept': 'application/vnd.github+json' }
            });
            if (!resp.ok) {
                throw new Error('仓库不存在或暂时无法访问');
            }
            const repoData = await resp.json();
            if (repoData.private) {
                alert('当前只支持公开仓库，请换一个公开 GitHub 仓库。');
                return;
            }

            task.github = {
                enabled: true,
                repoUrl: parsed.repoUrl,
                owner: parsed.owner,
                repo: parsed.repo,
                branch: repoData.default_branch || 'main',
                linkedAt: Date.now()
            };

            await updateDoc(doc(db, 'tasks', tid), {
                github: task.github
            });

            state.ui.githubLinkTaskId = null;
            Render();
        } catch (err) {
            console.error('绑定 GitHub 仓库失败:', err);
            alert(`绑定 GitHub 仓库失败：${err.message || '请稍后重试'}`);
        }
    },
    disconnectGithubLink: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const task = state.tasks.find(t => t.id === tid);
        if (!task) return;
        task.github = null;
        try {
            await updateDoc(doc(db, 'tasks', tid), {
                github: null
            });
        } catch (err) {
            console.error('断开 GitHub 仓库失败:', err);
            alert('断开 GitHub 仓库失败，请稍后重试');
            return;
        }
        state.ui.githubLinkTaskId = null;
        Render();
    },
    getGithubArchiveUrl: (owner, repo, ref) => {
        return `https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zip/${encodeURIComponent(ref)}`;
    },
    fetchGithubLatestCommit: async (githubLink) => {
        const owner = githubLink?.owner;
        const repo = githubLink?.repo;
        const branch = githubLink?.branch || 'main';
        if (!owner || !repo) {
            throw new Error('GitHub 仓库信息不完整');
        }

        const resp = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(branch)}`, {
            headers: { 'Accept': 'application/vnd.github+json' }
        });
        if (!resp.ok) {
            throw new Error('无法读取 GitHub 最新提交，请确认仓库仍然公开可访问');
        }
        const commitData = await resp.json();
        return {
            sha: commitData.sha,
            message: (commitData.commit?.message || '').split('\n')[0],
            committedAt: commitData.commit?.author?.date || new Date().toISOString(),
            htmlUrl: commitData.html_url || '',
            archiveUrl: Actions.getGithubArchiveUrl(owner, repo, commitData.sha),
            branch
        };
    },
    recordGithubVersion: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(task => task.id === tid);
        if (!t?.github?.enabled) {
            alert('当前任务还没有链接 GitHub 仓库');
            return;
        }

        let note = '';
        const noteInput = document.getElementById(`upload-comment-${tid}`);
        if (noteInput) {
            note = noteInput.value.trim();
        }

        state.ui.isUploading = true;
        Render();

        try {
            const latestCommit = await Actions.fetchGithubLatestCommit(t.github);
            const now = Date.now();
            const nextVer = (t.file?.version || 0) + 1;
            const duration = t.lockedAt ? now - t.lockedAt : 0;
            const shortSha = String(latestCommit.sha || '').slice(0, 7);
            const branchLabel = `${latestCommit.branch} 分支`;

            if (t.lockedAt) {
                t.activities.unshift({
                    type: 'upload',
                    source: 'github',
                    provider: 'github',
                    userId: state.currentUser.uid,
                    timestamp: latestCommit.committedAt || now,
                    duration,
                    version: nextVer,
                    size: branchLabel,
                    downloadURL: latestCommit.archiveUrl,
                    note,
                    commitSha: latestCommit.sha,
                    commitMessage: latestCommit.message,
                    commitUrl: latestCommit.htmlUrl,
                    repoUrl: t.github.repoUrl,
                    owner: t.github.owner,
                    repo: t.github.repo,
                    branch: latestCommit.branch
                });
            }

            t.file = {
                name: 'GitHub 仓库快照',
                size: branchLabel,
                lastUpdated: latestCommit.committedAt || new Date(now).toISOString(),
                version: nextVer,
                downloadURL: latestCommit.archiveUrl,
                note,
                source: 'github',
                provider: 'github',
                commitSha: latestCommit.sha,
                commitMessage: latestCommit.message,
                commitUrl: latestCommit.htmlUrl,
                repoUrl: t.github.repoUrl,
                owner: t.github.owner,
                repo: t.github.repo,
                branch: latestCommit.branch
            };
            t.isLocked = false;
            t.lockedBy = null;
            t.lockedAt = null;

            await updateDoc(doc(db, 'tasks', tid), {
                file: t.file,
                activities: t.activities,
                isLocked: false,
                lockedBy: null,
                lockedAt: null
            });

            state.ui.isUploading = false;
            state.ui.actionModalTaskId = null;
            Render();
        } catch (err) {
            console.error('记录 GitHub 版本失败:', err);
            state.ui.isUploading = false;
            alert(`记录 GitHub 版本失败：${err.message || '请稍后重试'}`);
            Render();
        }
    },

    // Locking & Uploading
    startTask: async (tid, version) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(t => t.id === tid);
        if (!t) return;
        const now = Date.now();
        t.isLocked = true;
        t.lockedBy = state.currentUser.uid;
        t.lockedAt = now;
        state.ui.historyModalTaskId = null;
        state.ui.startModalTaskId = null;
        Render();
        try {
            await updateDoc(doc(db, 'tasks', tid), {
                isLocked: true,
                lockedBy: state.currentUser.uid,
                lockedAt: now
            });
        } catch (e) {
            console.warn('更新任务锁定状态失败（本地已锁定）:', e);
        }
    },
    startTaskWithDownload: (tid, ver) => {
        Actions.downloadVersion(tid, ver);
        Actions.startTask(tid, ver);
    },
    downloadVersion: async (tid, ver) => {
        const t = state.tasks.find(t => t.id === tid);
        if (!t || !t.file) {
            alert('当前任务没有可下载的文件');
            return;
        }

        // 版本号统一转成数字比较，避免 '1' 和 1 不相等
        const targetVer = Number(ver);

        let downloadURL = null;
        let storagePath = null;
        let githubMeta = null;

        if (Number(t.file.version) === targetVer) {
            downloadURL = t.file.downloadURL;
            storagePath = t.file.path;
            if (t.file.source === 'github') {
                githubMeta = t.file;
            }
        } else if (t.activities && t.activities.length) {
            const act = t.activities.find(a =>
                a.type === 'upload' &&
                Number(a.version) === targetVer
            );
            if (act) {
                downloadURL = act.downloadURL;
                storagePath = act.path;
                if (act.source === 'github') {
                    githubMeta = act;
                }
            }
        }

        if (!downloadURL && !storagePath && !githubMeta) {
            alert('当前版本没有可下载的文件（可能是旧数据未记录下载地址）');
            return;
        }

        const fileName = githubMeta
            ? `${githubMeta.repo || t.github?.repo || `task_${tid}`}-${String(githubMeta.commitSha || '').slice(0, 7) || `v${targetVer}`}.zip`
            : ((t.file && t.file.name) ? t.file.name : `task_${tid}_v${targetVer}`);

        try {
            if (githubMeta) {
                const url = githubMeta.downloadURL || Actions.getGithubArchiveUrl(
                    githubMeta.owner || t.github?.owner,
                    githubMeta.repo || t.github?.repo,
                    githubMeta.commitSha
                );
                if (!url) {
                    alert('无法获取 GitHub 下载链接');
                    return;
                }
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                return;
            }

            // 如果没有 downloadURL，从 storage path 重新获取
            let url = downloadURL;
            if (!url && storagePath) {
                const { storage, ref, getDownloadURL } = window.fb;
                const fileRef = ref(storage, storagePath);
                url = await getDownloadURL(fileRef);
            }

            if (!url) {
                alert('无法获取下载链接');
                return;
            }

            // 使用 XMLHttpRequest 来绕过 CORS（设置 responseType 为 blob）
            const xhr = new XMLHttpRequest();
            xhr.responseType = 'blob';
            xhr.onload = function () {
                if (xhr.status === 200) {
                    const blob = xhr.response;
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = fileName;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                } else {
                    console.error('下载失败，状态码:', xhr.status);
                    alert('下载文件失败，请稍后重试');
                }
            };
            xhr.onerror = function () {
                console.error('下载请求失败');
                alert('下载文件失败，请检查网络连接');
            };
            xhr.open('GET', url);
            xhr.send();

        } catch (error) {
            console.error('下载失败:', error);
            alert('下载文件失败: ' + error.message);
        }
    },
    triggerUploadInModal: (tid) => {
        const t = state.tasks.find(task => task.id === tid);
        if (t?.github?.enabled) {
            Actions.recordGithubVersion(tid);
            return;
        }
        if (t && t.kind === 'file' && !isUserActivated()) {
            alert(L('activation.featureLocked'));
            return;
        }
        document.getElementById(`modal-file-upload-${tid}`)?.click();
    },
    triggerInitialUpload: (tid) => {
        const t = state.tasks.find(t => t.id === tid);
        if (t && t.kind === 'file' && !isUserActivated()) {
            alert(L('activation.featureLocked'));
            return;
        }
        document.getElementById(`initial-file-upload-${tid}`)?.click();
    },
    uploadFile: async (tid, inputEl) => {
        const { storage, ref, uploadBytes, getDownloadURL, deleteObject, db, doc, updateDoc } = window.fb;
        const input = inputEl
            || document.getElementById(`modal-file-upload-${tid}`)
            || document.getElementById(`initial-file-upload-${tid}`);
        if (!input || !input.files || !input.files[0]) return;

        const file = input.files[0];
        const MAX_SIZE = 3 * 1024 * 1024; // 3MB
        if (file.size > MAX_SIZE) {
            alert('文件大小不能超过 3MB，请选择更小的文件。');
            input.value = '';
            return;
        }

        const t = state.tasks.find(t => t.id === tid);
        if (!t) return;
        if (t.kind === 'file' && !isUserActivated()) {
            alert(L('activation.featureLocked'));
            input.value = '';
            return;
        }

        // 先读取备注，再触发重新渲染，否则 textarea 会被重置
        let note = '';
        const noteInput = document.getElementById(`upload-comment-${tid}`);
        if (noteInput) {
            note = noteInput.value.trim();
        }

        state.ui.isUploading = true;
        Render();

        const now = Date.now();
        const nextVer = (t.file?.version || 0) + 1;
        const path = `tasks/${tid}/v${nextVer}/${file.name}`;
        const storageRef = ref(storage, path);

        const humanSize = (bytes) => {
            if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
            if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
            return bytes + ' B';
        };

        try {
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            const duration = t.lockedAt ? now - t.lockedAt : 0;
            if (t.lockedAt) {
                t.activities.unshift({
                    type: 'upload',
                    userId: state.currentUser.uid,
                    timestamp: now,
                    duration,
                    version: nextVer,
                    size: humanSize(file.size),
                    downloadURL: url,
                    path,
                    note
                });
            }

            t.file = {
                name: file.name,
                size: humanSize(file.size),
                bytes: file.size,
                lastUpdated: new Date(now).toISOString(),
                version: nextVer,
                downloadURL: url,
                path,
                note
            };
            t.isLocked = false;
            t.lockedBy = null;
            t.lockedAt = null;

            // 只从 Storage 删除超过 3 个版本的旧文件，但 activities 保留全部记录
            const uploadActs = (t.activities || []).filter(a => a.type === 'upload');
            uploadActs.sort((a, b) => b.version - a.version);
            const keepActs = uploadActs.slice(0, 3);
            const removeActs = uploadActs.slice(3);

            // 只删除 Storage 文件，不删除 activities 记录
            await Promise.all(removeActs.map(async act => {
                if (act.path) {
                    try {
                        await deleteObject(ref(storage, act.path));
                        console.log(`已删除旧版本文件: ${act.path}, v${act.version}`);
                    } catch (e) {
                        console.warn('删除旧版本文件失败（忽略）:', act.path, e);
                    }
                }
            }));

            // 持久化到 Firestore（activities 保留全部记录）
            try {
                await updateDoc(doc(db, 'tasks', tid), {
                    file: t.file,
                    activities: t.activities,
                    isLocked: false,
                    lockedBy: null,
                    lockedAt: null
                });
            } catch (err) {
                console.warn('更新任务文件信息到 Firestore 失败（本地仍已更新）:', err);
            }

            state.ui.isUploading = false;
            state.ui.actionModalTaskId = null;
            input.value = '';
            Render();
        } catch (err) {
            console.error('文件上传失败:', err);
            state.ui.isUploading = false;
            alert('文件上传失败，请稍后重试：' + (err.message || '未知错误'));
            Render();
        }
    },
    submitProgress: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(t => t.id === tid);
        if (!t) return;

        const now = Date.now();
        const duration = t.lockedAt ? now - t.lockedAt : 0;

        // 获取当前最高的进度版本号
        const progressActs = (t.activities || []).filter(a => a.type === 'progress');
        const maxVer = progressActs.reduce((m, a) => Math.max(m, a.version || 0), 0);
        const nextVer = maxVer + 1;

        // 添加新的进度活动
        t.activities.unshift({
            type: 'progress',
            userId: state.currentUser.uid,
            timestamp: now,
            duration,
            version: nextVer
        });

        // 释放锁定
        t.isLocked = false;
        t.lockedBy = null;
        t.lockedAt = null;

        state.ui.actionModalTaskId = null;

        try {
            await updateDoc(doc(db, 'tasks', tid), {
                activities: t.activities,
                isLocked: false,
                lockedBy: null,
                lockedAt: null
            });
        } catch (err) {
            console.warn('提交进度到 Firestore 失败（本地仍已更新）:', err);
        }

        Render();
    },
    discardChanges: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(t => t.id === tid);
        const now = Date.now();
        t.activities.unshift({ type: 'discard', userId: state.currentUser.uid, timestamp: now, duration: now - t.lockedAt });
        t.isLocked = false; t.lockedBy = null; t.lockedAt = null;
        state.ui.actionModalTaskId = null;
        try {
            await updateDoc(doc(db, 'tasks', tid), {
                activities: t.activities,
                isLocked: t.isLocked,
                lockedBy: t.lockedBy,
                lockedAt: t.lockedAt
            });
        } catch (err) {
            console.warn('放弃修改记录到 Firestore 失败（本地仍已更新）:', err);
        }
        Render();
    },

    // ===== Activation Codes (Admin) =====
    openActivationCodesModal: async () => {
        const { db, collection, onSnapshot, query, orderBy, functions, httpsCallable } = window.fb;
        state.ui.activationCodesModalOpen = true;
        state.activationCodes = [];
        Render();

        // 自动清理过期码
        try {
            const cleanFn = httpsCallable(functions, 'cleanExpiredCodes');
            const result = await cleanFn();
            if (result.data.deletedCount > 0) {
                console.log(`✅ 已自动清理 ${result.data.deletedCount} 个过期激活码`);
            }
        } catch (err) {
            console.warn('自动清理过期码失败（非致命）:', err);
        }

        // Set up real-time listener for activation codes
        const q = query(collection(db, 'activationCodes'), orderBy('createdAt', 'desc'));
        unsubs.activationCodes = onSnapshot(q, (snap) => {
            state.activationCodes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            Render();
        }, (err) => {
            console.error('监听激活码列表失败:', err);
        });
    },
    closeActivationCodesModal: () => {
        state.ui.activationCodesModalOpen = false;
        // Unsubscribe from activation codes listener
        if (unsubs.activationCodes) {
            unsubs.activationCodes();
            unsubs.activationCodes = null;
        }
        Render();
    },
    generateActivationCode: async () => {
        const { functions, httpsCallable } = window.fb;
        state.ui.activationCodesLoading = true;
        Render();

        try {
            const createCodes = httpsCallable(functions, 'createActivationCodes');
            const result = await createCodes();
            console.log('✅ 激活码已生成:', result.data.code);
        } catch (err) {
            console.error('❌ 生成激活码失败:', err);
            alert('生成激活码失败: ' + (err.message || '未知错误'));
        }

        state.ui.activationCodesLoading = false;
        Render();
    },
    deleteActivationCode: async (code) => {
        // 检查是否已使用且未过期（前端预检查，后端也有保护）
        const codeData = (state.activationCodes || []).find(c => c.code === code);
        if (codeData && codeData.usedCount > 0) {
            if (codeData.userActivationInfinite) {
                alert('该激活码用户为永久激活，无法删除。请先调整该用户的到期时间。');
                return;
            }
            let expiryMs = 0;
            if (codeData.userActivationExpiresAt) {
                expiryMs = codeData.userActivationExpiresAt.seconds
                    ? codeData.userActivationExpiresAt.seconds * 1000
                    : codeData.userActivationExpiresAt;
            } else if (codeData.usedAt) {
                const baseMs = codeData.usedAt.seconds ? codeData.usedAt.seconds * 1000 : codeData.usedAt;
                expiryMs = baseMs + (codeData.durationDays || 90) * 86400000;
            } else if (codeData.createdAt) {
                const baseMs = codeData.createdAt.seconds ? codeData.createdAt.seconds * 1000 : codeData.createdAt;
                expiryMs = baseMs + (codeData.durationDays || 90) * 86400000;
            }
            if (expiryMs && Date.now() < expiryMs) {
                alert('该激活码已被使用且尚未过期，无法删除。请等待过期后再删除。');
                return;
            }
        }

        const { functions, httpsCallable } = window.fb;
        try {
            const deleteFn = httpsCallable(functions, 'deleteActivationCode');
            await deleteFn({ code });
            console.log('✅ 激活码已删除:', code);
        } catch (err) {
            console.error('❌ 删除激活码失败:', err);
            alert('删除激活码失败: ' + (err.message || '未知错误'));
        }
    },
    openExpiryEditor: (code) => {
        state.ui.expiryEditorCode = code;
        Render();
    },
    closeExpiryEditor: () => {
        state.ui.expiryEditorCode = null;
        Render();
    },
    saveUserExpiry: async (code, mode) => {
        const codeData = (state.activationCodes || []).find(c => c.code === code);
        if (!codeData || !codeData.usedByUid) {
            alert('该激活码尚未被任何用户使用');
            return;
        }
        const { functions, httpsCallable } = window.fb;
        const fn = httpsCallable(functions, 'setUserActivationExpiry');
        try {
            if (mode === 'infinite') {
                await fn({ uid: codeData.usedByUid, infinite: true });
            } else {
                const input = document.getElementById(`expiry-date-input-${code}`);
                const value = input?.value;
                if (!value) {
                    alert('请选择到期日期');
                    return;
                }
                // 取选定日期当天的 23:59:59 作为到期时间
                const ms = new Date(value + 'T23:59:59').getTime();
                if (!ms || isNaN(ms)) {
                    alert('日期格式无效');
                    return;
                }
                await fn({ uid: codeData.usedByUid, expiresAt: ms, infinite: false });
            }
            console.log('✅ 用户激活到期时间已更新');
            state.ui.expiryEditorCode = null;
            Render();
        } catch (err) {
            console.error('❌ 更新到期时间失败:', err);
            alert('更新到期时间失败: ' + (err.message || '未知错误'));
        }
    },
    copyActivationCode: async (code) => {
        try {
            await navigator.clipboard.writeText(code);
            console.log('✅ 激活码已复制到剪贴板:', code);
            const copyNode = document.getElementById(`copy-text-${code}`);
            if (copyNode) {
                copyNode.classList.remove('opacity-0');
                setTimeout(() => copyNode.classList.add('opacity-0'), 2000);
            }
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            const copyNode = document.getElementById(`copy-text-${code}`);
            if (copyNode) {
                copyNode.classList.remove('opacity-0');
                setTimeout(() => copyNode.classList.add('opacity-0'), 2000);
            }
        }
    },

    // ===== User Activation (Non-Admin) =====
    openActivationModal: () => {
        state.ui.activationModalOpen = true;
        Render();
    },
    closeActivationModal: () => {
        state.ui.activationModalOpen = false;
        Render();
    },
    submitActivationCode: async () => {
        const input = document.getElementById('activation-code-input');
        const code = input?.value?.trim();
        if (!code) {
            alert('请输入激活码');
            return;
        }

        const { functions, httpsCallable } = window.fb;
        try {
            const activateFn = httpsCallable(functions, 'activateUser');
            const result = await activateFn({ code });
            console.log('✅ 账号激活成功:', result.data);

            // 更新本地用户状态
            state.currentUser.activatedAt = result.data.activatedAt;
            state.currentUser.activationExpiresAt = result.data.activationExpiresAt;

            state.ui.activationModalOpen = false;
            alert(L('activation.successAlert'));
            Render();
        } catch (err) {
            console.error('❌ 激活失败:', err);
            const msg = err.message || '未知错误';
            alert('激活失败: ' + msg);
        }
    },

    // Editor Actions
    openImagePreview: (url) => {
        if (!url) return;
        state.ui.imagePreviewUrl = url;
        Render();
    },
    closeImagePreview: () => {
        state.ui.imagePreviewUrl = null;
        Render();
    },

    // ===== Gantt =====
    _ganttStartOfDay: (ms) => {
        const d = new Date(ms);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    },
    openProjectGantt: (pid) => {
        const today = Actions._ganttStartOfDay(Date.now());
        state.ui.ganttModal = {
            mode: 'project',
            projectId: pid,
            taskId: null,
            viewStartMs: today - 3 * 86400000,
            dayCount: 30,
            selectedItemId: null
        };
        Render();
    },
    openTaskGantt: (tid) => {
        const t = state.tasks.find(x => x.id === tid);
        const today = Actions._ganttStartOfDay(Date.now());
        state.ui.ganttModal = {
            mode: 'task',
            projectId: t?.projectId || null,
            taskId: tid,
            viewStartMs: today - 3 * 86400000,
            dayCount: 30,
            selectedItemId: null
        };
        Render();
    },
    closeGantt: () => {
        state.ui.ganttModal = {
            mode: null, projectId: null, taskId: null,
            viewStartMs: null, dayCount: 14, selectedItemId: null
        };
        Render();
    },
    ganttScroll: (deltaDays) => {
        const g = state.ui.ganttModal;
        if (!g.mode) return;
        g.viewStartMs = g.viewStartMs + deltaDays * 86400000;
        Render();
    },
    ganttJumpToday: () => {
        const g = state.ui.ganttModal;
        if (!g.mode) return;
        const today = Actions._ganttStartOfDay(Date.now());
        g.viewStartMs = today - 2 * 86400000;
        Render();
    },
    ganttJumpToItem: (itemId) => {
        const g = state.ui.ganttModal;
        if (!g.mode) return;
        const item = g.mode === 'project'
            ? state.tasks.find(t => t.id === itemId)
            : state.tasks.find(t => t.id === g.taskId)?.todos?.find(td => td.id === itemId);
        if (!item || !item.startMs) return;
        const start = Actions._ganttStartOfDay(item.startMs);
        g.viewStartMs = start - 3 * 86400000;
        g.selectedItemId = itemId;
        Render();
    },
    selectGanttItem: (itemId) => {
        state.ui.ganttModal.selectedItemId =
            state.ui.ganttModal.selectedItemId === itemId ? null : itemId;
        state.ui.ganttModal.ownerPickerOpen = false;
        state.ui.ganttModal.priorityPickerOpen = false;
        Render();
    },
    // 持久化：把任务或 todo 的排期写到 Firestore
    setTaskSchedule: async (tid, startMs, endMs) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(x => x.id === tid);
        if (!t) return;
        t.startMs = startMs;
        t.endMs = endMs;
        Render();
        try {
            await updateDoc(doc(db, 'tasks', tid), { startMs, endMs });
        } catch (e) {
            console.warn('保存任务排期失败:', e);
        }
    },
    clearTaskSchedule: async (tid) => {
        await Actions.setTaskSchedule(tid, null, null);
        state.ui.ganttModal.selectedItemId = null;
        Render();
    },
    setTodoSchedule: async (tid, todoId, startMs, endMs) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(x => x.id === tid);
        if (!t) return;
        const todo = (t.todos || []).find(td => td.id === todoId);
        if (!todo) return;
        todo.startMs = startMs;
        todo.endMs = endMs;
        Render();
        try {
            await updateDoc(doc(db, 'tasks', tid), { todos: t.todos });
        } catch (e) {
            console.warn('保存 Todo 排期失败:', e);
        }
    },
    clearTodoSchedule: async (tid, todoId) => {
        await Actions.setTodoSchedule(tid, todoId, null, null);
        state.ui.ganttModal.selectedItemId = null;
        Render();
    },
    // 拖拽：HTML5 dragstart 把要排期的项目 id 放进 dataTransfer
    onGanttChipDragStart: (event, itemKind, itemId) => {
        if (!event?.dataTransfer) return;
        // itemKind = 'task' | 'todo'，载荷 = "kind:id"
        event.dataTransfer.setData('text/x-gantt-item', `${itemKind}:${itemId}`);
        event.dataTransfer.setData('text/x-gantt-mode', 'new');
        event.dataTransfer.effectAllowed = 'copyMove';
    },
    // 条本体：横向拖动改区间、纵向拖动手动指定 ganttRow；纯点击切换选中
    onGanttBarMouseDown: (event, itemKind, itemId) => {
        if (!event || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const g = state.ui.ganttModal;
        const CELL_W = 34, ROW_H = 34, DAY = 86400000;
        const item = itemKind === 'task'
            ? state.tasks.find(t => t.id === itemId)
            : state.tasks.find(t => t.id === g.taskId)?.todos?.find(td => td.id === itemId);
        if (!item || !item.startMs || !item.endMs) return;
        const startX = event.clientX, startY = event.clientY;
        const origStart = item.startMs, origEnd = item.endMs;
        // 起始 row 用当前显示行（用户手动设过就用 ganttRow，否则按当前 DOM 上的行号）
        let origRow;
        if (Number.isFinite(item.ganttRow)) {
            origRow = item.ganttRow;
        } else {
            // 从渲染结果取（barsHtml 里的 top 计算用到 itemRowIdx），简化：从 bar DOM 读
            const bar = event.currentTarget?.closest('[style*="top:"]');
            const m = bar && bar.getAttribute('style')?.match(/top:\s*(\d+)px/);
            origRow = m ? Math.round(parseInt(m[1], 10) / ROW_H) : 0;
        }
        let pendingFrame = null, lastX = startX, lastY = startY, moved = false;
        const onMove = (e) => {
            lastX = e.clientX; lastY = e.clientY;
            if (!moved) {
                if (Math.abs(lastX - startX) + Math.abs(lastY - startY) < 4) return;
                moved = true;
            }
            if (pendingFrame) return;
            pendingFrame = requestAnimationFrame(() => {
                pendingFrame = null;
                const deltaDays = Math.round((lastX - startX) / CELL_W);
                item.startMs = origStart + deltaDays * DAY;
                item.endMs = origEnd + deltaDays * DAY;
                const deltaRows = Math.round((lastY - startY) / ROW_H);
                item.ganttRow = Math.max(0, origRow + deltaRows);
                Render();
            });
        };
        const onUp = async () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (pendingFrame) cancelAnimationFrame(pendingFrame);
            if (!moved) {
                Actions.selectGanttItem(itemId);
                return;
            }
            const { db, doc, updateDoc } = window.fb;
            try {
                if (itemKind === 'task') {
                    await updateDoc(doc(db, 'tasks', itemId), {
                        startMs: item.startMs, endMs: item.endMs, ganttRow: item.ganttRow
                    });
                } else {
                    const tt = state.tasks.find(x => x.id === g.taskId);
                    if (tt) await updateDoc(doc(db, 'tasks', g.taskId), { todos: tt.todos });
                }
            } catch (e) {
                console.warn('保存排期失败:', e);
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    },
    onGanttResizeStart: (event, itemKind, itemId, side) => {
        // 用鼠标事件来做实时反馈，绕开 HTML5 drag 拖完才生效的问题
        if (!event) return;
        event.preventDefault();
        event.stopPropagation();
        const g = state.ui.ganttModal;
        const item = itemKind === 'task'
            ? state.tasks.find(t => t.id === itemId)
            : state.tasks.find(t => t.id === g.taskId)?.todos?.find(td => td.id === itemId);
        if (!item || !item.startMs || !item.endMs) return;
        const CELL_W = 34;
        const DAY = 86400000;
        const startX = event.clientX;
        const origStart = item.startMs;
        const origEnd = item.endMs;
        let pendingFrame = null;
        let lastClientX = startX;
        const onMove = (e) => {
            lastClientX = e.clientX;
            if (pendingFrame) return;
            pendingFrame = requestAnimationFrame(() => {
                pendingFrame = null;
                const dx = lastClientX - startX;
                const deltaDays = Math.round(dx / CELL_W);
                if (side === 'end') {
                    const newEnd = origEnd + deltaDays * DAY;
                    item.endMs = Math.max(origStart, newEnd);
                } else {
                    const newStart = origStart + deltaDays * DAY;
                    item.startMs = Math.min(origEnd, newStart);
                }
                Render();
            });
        };
        const onUp = async () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (pendingFrame) { cancelAnimationFrame(pendingFrame); pendingFrame = null; }
            // 写回 Firestore
            const { db, doc, updateDoc } = window.fb;
            try {
                if (itemKind === 'task') {
                    await updateDoc(doc(db, 'tasks', itemId), { startMs: item.startMs, endMs: item.endMs });
                } else {
                    const tt = state.tasks.find(x => x.id === g.taskId);
                    if (tt) await updateDoc(doc(db, 'tasks', g.taskId), { todos: tt.todos });
                }
            } catch (e) {
                console.warn('保存排期失败:', e);
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    },
    onGanttCellDragOver: (event) => {
        if (event?.dataTransfer?.types?.includes('text/x-gantt-item')) {
            event.preventDefault();
        }
    },
    onGanttCellDrop: async (event, dayMs) => {
        if (!event?.dataTransfer) return;
        event.preventDefault();
        const raw = event.dataTransfer.getData('text/x-gantt-item');
        const mode = event.dataTransfer.getData('text/x-gantt-mode') || 'new';
        if (!raw) return;
        const [kind, id] = raw.split(':');
        if (!kind || !id) return;
        const g = state.ui.ganttModal;
        const dayStart = Actions._ganttStartOfDay(Number(dayMs));
        // 拿到现有的排期（resize 需要）
        const findItem = () => {
            if (kind === 'task') return state.tasks.find(t => t.id === id);
            const tt = state.tasks.find(x => x.id === g.taskId);
            return tt?.todos?.find(td => td.id === id);
        };
        let startMs, endMs;
        if (mode === 'move') {
            const durDays = Math.max(1, parseInt(event.dataTransfer.getData('text/x-gantt-duration'), 10) || 1);
            startMs = dayStart;
            endMs = dayStart + (durDays - 1) * 86400000;
        } else if (mode === 'resize-start') {
            const item = findItem();
            if (!item || !item.endMs) return;
            startMs = Math.min(dayStart, item.endMs);
            endMs = item.endMs;
        } else if (mode === 'resize-end') {
            const item = findItem();
            if (!item || !item.startMs) return;
            startMs = item.startMs;
            endMs = Math.max(dayStart, item.startMs);
        } else {
            startMs = dayStart;
            endMs = dayStart;
        }
        if (kind === 'task') {
            await Actions.setTaskSchedule(id, startMs, endMs);
        } else if (kind === 'todo' && g.taskId) {
            await Actions.setTodoSchedule(g.taskId, id, startMs, endMs);
        }
    },
    onGanttUnscheduleDragOver: (event) => {
        if (event?.dataTransfer?.types?.includes('text/x-gantt-item')) {
            event.preventDefault();
        }
    },
    onGanttUnscheduleDrop: async (event) => {
        if (!event?.dataTransfer) return;
        event.preventDefault();
        const raw = event.dataTransfer.getData('text/x-gantt-item');
        if (!raw) return;
        const [kind, id] = raw.split(':');
        const g = state.ui.ganttModal;
        if (kind === 'task') {
            await Actions.clearTaskSchedule(id);
        } else if (kind === 'todo' && g.taskId) {
            await Actions.clearTodoSchedule(g.taskId, id);
        }
    },
    // 切换甘特图条目的项目负责人
    // - 任务：写显式 ganttOwners 数组
    // - Todo：直接增删 todo.text 中的 @mention，达到与外部同步
    toggleGanttOwner: async (kind, id, uid) => {
        const g = state.ui.ganttModal;
        const { db, doc, updateDoc } = window.fb;
        if (kind === 'task') {
            const t = state.tasks.find(x => x.id === id);
            if (!t) return;
            const list = Array.isArray(t.ganttOwners) ? t.ganttOwners.slice() : [];
            const idx = list.indexOf(uid);
            if (idx >= 0) list.splice(idx, 1); else list.push(uid);
            t.ganttOwners = list;
            Render();
            try { await updateDoc(doc(db, 'tasks', id), { ganttOwners: list }); }
            catch (e) { console.warn('保存负责人失败:', e); }
        } else if (kind === 'todo' && g.taskId) {
            const tt = state.tasks.find(x => x.id === g.taskId);
            const td = tt?.todos.find(x => x.id === id);
            if (!td) return;
            const user = state.users.find(u => u.uid === uid);
            if (!user) return;
            const box = document.createElement('div');
            box.innerHTML = td.text || '';
            const existing = box.querySelectorAll(`.todo-mention[data-mention-uid="${uid}"]`);
            if (existing.length) {
                existing.forEach(el => {
                    // 同时移除紧邻的前置空白文本
                    const prev = el.previousSibling;
                    if (prev && prev.nodeType === Node.TEXT_NODE) {
                        prev.textContent = (prev.textContent || '').replace(/[\s ]+$/g, '');
                    }
                    el.remove();
                });
            } else {
                const tone = uid === state.currentUser?.uid ? 'todo-mention-me' : 'todo-mention-other';
                const escName = (user.name || '成员').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const needsLeadingSpace = !!box.textContent && !/[\s ]$/.test(box.textContent);
                box.insertAdjacentHTML('beforeend',
                    `${needsLeadingSpace ? ' ' : ''}<span class="todo-mention ${tone}" contenteditable="false" data-mention-uid="${uid}">@${escName}</span>`);
            }
            td.text = box.innerHTML;
            Render();
            try { await updateDoc(doc(db, 'tasks', g.taskId), { todos: tt.todos }); }
            catch (e) { console.warn('保存负责人失败:', e); }
        }
    },
    toggleGanttOwnerPicker: () => {
        state.ui.ganttModal.ownerPickerOpen = !state.ui.ganttModal.ownerPickerOpen;
        Render();
    },
    toggleGanttHiddenOld: () => {
        state.ui.ganttModal.showHiddenOld = !state.ui.ganttModal.showHiddenOld;
        Render();
    },
    toggleGanttPriorityPicker: () => {
        state.ui.ganttModal.priorityPickerOpen = !state.ui.ganttModal.priorityPickerOpen;
        state.ui.ganttModal.ownerPickerOpen = false;
        Render();
    },
    openGanttQuickAdd: () => {
        state.ui.ganttModal.quickAddOpen = true;
        state.ui.ganttModal.quickAddText = '';
        Render();
        setTimeout(() => document.getElementById('gantt-quickadd-input')?.focus(), 0);
    },
    closeGanttQuickAdd: () => {
        state.ui.ganttModal.quickAddOpen = false;
        state.ui.ganttModal.quickAddText = '';
        Render();
    },
    setGanttQuickAddText: (val) => {
        state.ui.ganttModal.quickAddText = val || '';
    },
    submitGanttQuickAdd: async () => {
        const g = state.ui.ganttModal;
        const raw = (g.quickAddText || '').trim();
        if (!raw) { Actions.closeGanttQuickAdd(); return; }
        const { db, doc, updateDoc } = window.fb;
        if (g.mode === 'task' && g.taskId) {
            const t = state.tasks.find(x => x.id === g.taskId);
            if (!t) return;
            // 把纯文本（含 @name）转成与现有 todo 一致的 HTML（识别成员名 -> mention span）
            const p = state.projects.find(pp => pp.id === t.projectId);
            const memberIds = (p?.memberIds || p?.members || []);
            const members = state.users.filter(u => memberIds.includes(u.uid));
            const byName = new Map(members.map(m => [(m.name || '').toLowerCase(), m]));
            const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            let html = '';
            const mentionRe = /(^|\s)@([^\s@]+)/g;
            let last = 0, m;
            while ((m = mentionRe.exec(raw)) !== null) {
                const prefix = m[1] || '';
                const name = m[2] || '';
                const u = byName.get(name.toLowerCase());
                if (!u) continue;
                html += escHtml(raw.slice(last, m.index)) + escHtml(prefix);
                const tone = u.uid === state.currentUser?.uid ? 'todo-mention-me' : 'todo-mention-other';
                html += `<span class="todo-mention ${tone}" contenteditable="false" data-mention-uid="${u.uid}">@${escHtml(u.name || '')}</span>`;
                last = m.index + prefix.length + 1 + name.length;
            }
            html += escHtml(raw.slice(last));
            const newId = `td${Date.now()}`;
            t.todos = t.todos || [];
            t.todos.push({
                id: newId,
                text: html,
                images: [],
                priority: 'none',
                completed: false,
                createdAt: Date.now(),
                createdBy: state.currentUser?.uid || null
            });
            Render();
            try { await updateDoc(doc(db, 'tasks', g.taskId), { todos: t.todos }); }
            catch (e) { console.warn('保存新待办失败:', e); }
            Actions.closeGanttQuickAdd();
        }
    },
    openGanttQuickEdit: () => {
        const g = state.ui.ganttModal;
        if (!g.selectedItemId) return;
        let text = '';
        if (g.mode === 'project') {
            const t = state.tasks.find(x => x.id === g.selectedItemId);
            text = t?.name || '';
        } else {
            const tt = state.tasks.find(x => x.id === g.taskId);
            const td = tt?.todos?.find(x => x.id === g.selectedItemId);
            // 把 HTML 转换成纯文本，@mention 保留为 "@名字"
            const box = document.createElement('div');
            box.innerHTML = td?.text || '';
            // mention span 已经是 "@名字" 文本，textContent 自然就有
            text = (box.textContent || '').trim();
        }
        state.ui.ganttModal.quickEditOpen = true;
        state.ui.ganttModal.quickEditText = text;
        Render();
        setTimeout(() => document.getElementById('gantt-quickedit-input')?.focus(), 0);
    },
    closeGanttQuickEdit: () => {
        state.ui.ganttModal.quickEditOpen = false;
        state.ui.ganttModal.quickEditText = '';
        Render();
    },
    setGanttQuickEditText: (val) => {
        state.ui.ganttModal.quickEditText = val || '';
    },
    submitGanttQuickEdit: async () => {
        const g = state.ui.ganttModal;
        const raw = (g.quickEditText || '').trim();
        if (!raw || !g.selectedItemId) { Actions.closeGanttQuickEdit(); return; }
        const { db, doc, updateDoc } = window.fb;
        if (g.mode === 'project') {
            const t = state.tasks.find(x => x.id === g.selectedItemId);
            if (!t) return;
            t.name = raw;
            Render();
            try { await updateDoc(doc(db, 'tasks', g.selectedItemId), { name: raw }); }
            catch (e) { console.warn('保存任务名失败:', e); }
        } else {
            const tt = state.tasks.find(x => x.id === g.taskId);
            const td = tt?.todos?.find(x => x.id === g.selectedItemId);
            if (!td) return;
            // 用同样的 @mention 识别规则把纯文本转回 HTML
            const p = state.projects.find(pp => pp.id === tt.projectId);
            const memberIds = (p?.memberIds || p?.members || []);
            const members = state.users.filter(u => memberIds.includes(u.uid));
            const byName = new Map(members.map(m => [(m.name || '').toLowerCase(), m]));
            const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            let html = '';
            const mentionRe = /(^|\s)@([^\s@]+)/g;
            let last = 0, m;
            while ((m = mentionRe.exec(raw)) !== null) {
                const prefix = m[1] || '';
                const name = m[2] || '';
                const u = byName.get(name.toLowerCase());
                if (!u) continue;
                html += escHtml(raw.slice(last, m.index)) + escHtml(prefix);
                const tone = u.uid === state.currentUser?.uid ? 'todo-mention-me' : 'todo-mention-other';
                html += `<span class="todo-mention ${tone}" contenteditable="false" data-mention-uid="${u.uid}">@${escHtml(u.name || '')}</span>`;
                last = m.index + prefix.length + 1 + name.length;
            }
            html += escHtml(raw.slice(last));
            td.text = html;
            Render();
            try { await updateDoc(doc(db, 'tasks', g.taskId), { todos: tt.todos }); }
            catch (e) { console.warn('保存 Todo 文本失败:', e); }
        }
        Actions.closeGanttQuickEdit();
    },
    setGanttItemPriority: async (kind, id, priority) => {
        const g = state.ui.ganttModal;
        const { db, doc, updateDoc } = window.fb;
        const norm = ['high', 'medium', 'low', 'none'].includes(priority) ? priority : 'none';
        if (kind === 'task') {
            const t = state.tasks.find(x => x.id === id);
            if (!t) return;
            t.priority = norm;
            Render();
            try { await updateDoc(doc(db, 'tasks', id), { priority: norm }); }
            catch (e) { console.warn('保存任务优先级失败:', e); }
        } else if (kind === 'todo' && g.taskId) {
            const tt = state.tasks.find(x => x.id === g.taskId);
            const td = tt?.todos?.find(x => x.id === id);
            if (!td) return;
            td.priority = norm;
            Render();
            try { await updateDoc(doc(db, 'tasks', g.taskId), { todos: tt.todos }); }
            catch (e) { console.warn('保存 Todo 优先级失败:', e); }
        }
    },

    // 编辑选中条的开始/结束日期（日期字符串 YYYY-MM-DD）
    updateGanttItemDate: async (kind, id, which, value) => {
        const t = state.tasks.find(x =>
            kind === 'task' ? x.id === id : (x.todos || []).some(td => td.id === id)
        );
        if (!t) return;
        const item = kind === 'task' ? t : t.todos.find(td => td.id === id);
        if (!item) return;
        if (!value) return;
        const newMs = Actions._ganttStartOfDay(new Date(value + 'T00:00:00').getTime());
        let startMs = item.startMs;
        let endMs = item.endMs;
        if (which === 'start') {
            startMs = newMs;
            if (!endMs || endMs < startMs) endMs = startMs;
        } else {
            endMs = newMs;
            if (!startMs || startMs > endMs) startMs = endMs;
        }
        if (kind === 'task') {
            await Actions.setTaskSchedule(id, startMs, endMs);
        } else {
            await Actions.setTodoSchedule(t.id, id, startMs, endMs);
        }
    },
    closeMentionPicker: () => {
        if (state.ui.mentionPickerTimer) {
            clearTimeout(state.ui.mentionPickerTimer);
            state.ui.mentionPickerTimer = null;
        }
        state.ui.mentionPicker = {
            visible: false,
            taskId: null,
            query: '',
            selectedIndex: -1,
            candidateUids: [],
            x: 12,
            y: 12
        };
    },
    setMentionComposing: (isComposing) => {
        state.ui.mentionComposing = !!isComposing;
        if (isComposing) {
            Actions.closeMentionPicker();
        }
    },
    handleMentionCompositionEnd: (event, tid) => {
        state.ui.mentionComposing = false;
        const editor = document.getElementById('todo-editor');
        if (editor) {
            Actions.updateEditorDraft(tid, editor.innerHTML);
        }
    },
    getMentionToneClass: (uid) => {
        return (uid && state.currentUser?.uid && uid === state.currentUser.uid)
            ? 'todo-mention-me'
            : 'todo-mention-other';
    },
    buildMentionSpan: (user) => {
        const span = document.createElement('span');
        span.className = `todo-mention ${Actions.getMentionToneClass(user.uid)}`;
        span.setAttribute('contenteditable', 'false');
        span.setAttribute('data-mention-uid', user.uid);
        span.textContent = `@${user.name || '成员'}`;
        return span;
    },
    insertMentionTrigger: (tid) => {
        const editor = document.getElementById('todo-editor');
        if (!editor) return;
        editor.focus();
        const candidates = Actions.getTodoMentionCandidates(tid, '');
        if (!candidates.length) {
            Actions.closeMentionPicker();
            Render();
            return;
        }
        const sel = window.getSelection();
        let x = 12, y = 12;
        if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            const caretRect = range.getBoundingClientRect();
            const editorRect = editor.getBoundingClientRect();
            const localX = caretRect.left - editorRect.left;
            const localY = caretRect.top - editorRect.top;
            x = Math.max(8, Math.min(localX, Math.max(8, editorRect.width - 220)));
            y = Math.max(12, localY);
        }
        state.ui.mentionPicker = {
            visible: true,
            taskId: tid,
            query: '',
            selectedIndex: -1,
            candidateUids: candidates.map(c => c.uid),
            x,
            y
        };
        Render();
    },
    getTodoMentionCandidates: (tid, query = '') => {
        const t = state.tasks.find(x => x.id === tid);
        if (!t) return [];
        const p = state.projects.find(x => x.id === t.projectId);
        const memberIds = (p?.memberIds || p?.members || []);
        const q = (query || '').trim().toLowerCase();
        return state.users
            .filter(u => memberIds.includes(u.uid))
            .filter(u => !q || (u.name || '').toLowerCase().includes(q))
            .slice(0, 6);
    },
    getActiveMentionQuery: (editor) => {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return null;
        const container = range.startContainer;
        if (!container) return null;

        // Caret may sit on element nodes right after typing '@'; normalize to a text context.
        let text = '';
        let offset = 0;
        if (container.nodeType === Node.TEXT_NODE) {
            text = container.textContent || '';
            offset = range.startOffset;
        } else if (container.nodeType === Node.ELEMENT_NODE) {
            const el = container;
            const idx = range.startOffset;
            const prev = idx > 0 ? el.childNodes[idx - 1] : null;
            if (prev && prev.nodeType === Node.TEXT_NODE) {
                text = prev.textContent || '';
                offset = text.length;
            } else {
                return null;
            }
        } else {
            return null;
        }

        const before = text.slice(0, offset);
        const atIndex = before.lastIndexOf('@');
        if (atIndex < 0) return null;
        if (atIndex > 0 && !/\s/.test(before[atIndex - 1])) return null;
        const query = before.slice(atIndex + 1);
        if (/\s/.test(query)) return null;
        return { query };
    },
    refreshMentionPicker: (tid) => {
        if (state.ui.mentionComposing) return;
        const editor = document.getElementById('todo-editor');
        if (!editor) return;
        const prev = state.ui.mentionPicker || {};
        const active = Actions.getActiveMentionQuery(editor);
        if (!active) {
            if (prev.visible) {
                Actions.closeMentionPicker();
                Render();
            }
            return;
        }
        const candidates = Actions.getTodoMentionCandidates(tid, active.query);
        const sel = window.getSelection();
        let x = 12, y = 12;
        if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            const caretRect = range.getBoundingClientRect();
            const editorRect = editor.getBoundingClientRect();
            const localX = caretRect.left - editorRect.left;
            const localY = caretRect.top - editorRect.top;
            x = Math.max(8, Math.min(localX, Math.max(8, editorRect.width - 220)));
            y = Math.max(12, localY);
        }
        const next = {
            visible: candidates.length > 0,
            taskId: tid,
            query: active.query,
            selectedIndex: -1,
            candidateUids: candidates.map(c => c.uid),
            x,
            y
        };
        const same =
            prev.visible === next.visible &&
            prev.taskId === next.taskId &&
            prev.query === next.query &&
            prev.selectedIndex === next.selectedIndex &&
            prev.x === next.x &&
            prev.y === next.y &&
            JSON.stringify(prev.candidateUids || []) === JSON.stringify(next.candidateUids || []);
        if (same) return;
        state.ui.mentionPicker = next;
        Render();
    },
    scheduleMentionPickerRefresh: (tid) => {
        if (state.ui.mentionComposing) return;
        if (state.ui.mentionPickerTimer) clearTimeout(state.ui.mentionPickerTimer);
        state.ui.mentionPickerTimer = setTimeout(() => {
            state.ui.mentionPickerTimer = null;
            Actions.refreshMentionPicker(tid);
        }, 90);
    },
    pickMentionFromPicker: (event, tid, uid) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        Actions.pickMention(tid, uid);
    },
    handleTodoEditorKeyUp: (event, tid) => {
        if (event?.isComposing || state.ui.mentionComposing) return;
        const k = event.key;
        const picker = state.ui.mentionPicker;
        if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta') return;
        if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'Escape') return;
        if (k === '@') {
            // 手动输入 @ 时，等同于点击一次工具栏 @ 按钮。
            if (state.ui.mentionPickerTimer) {
                clearTimeout(state.ui.mentionPickerTimer);
                state.ui.mentionPickerTimer = null;
            }
            Actions.insertMentionTrigger(tid);
            return;
        }
        // Enter was already consumed by mention picker on keydown (only when picker is open by @按钮).
        if (k === 'Enter' && picker?.visible && picker.taskId === tid) return;
        if (k === 'Enter' && state.ui.skipMentionNormalizeOnce) {
            state.ui.skipMentionNormalizeOnce = false;
            return;
        }
        if (k === ' ' || k === 'Enter') {
            if (state.ui.mentionPickerTimer) {
                clearTimeout(state.ui.mentionPickerTimer);
                state.ui.mentionPickerTimer = null;
            }
            const editor = document.getElementById('todo-editor');
            if (editor) {
                const shouldProcessMention = !!Actions.getActiveMentionQuery(editor) || !!(picker?.visible && picker.taskId === tid);
                setTimeout(() => {
                    if (!shouldProcessMention) {
                        Actions.updateEditorDraft(tid, editor.innerHTML);
                        return;
                    }
                    Actions.normalizeMentionsInEditor(tid, editor);
                    Actions.updateEditorDraft(tid, editor.innerHTML);
                    Actions.closeMentionPicker();
                    Render();
                }, 0);
            }
            return;
        }
        // 手动输入 @ 也支持联想，但通过节流刷新降低卡顿。
        Actions.scheduleMentionPickerRefresh(tid);
    },
    handleTodoEditorKeyDown: (event, tid) => {
        if (event?.isComposing || state.ui.mentionComposing) return;
        const picker = state.ui.mentionPicker;
        if (!picker?.visible || picker.taskId !== tid || !picker.candidateUids.length) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (picker.selectedIndex < 0) picker.selectedIndex = 0;
            else picker.selectedIndex = (picker.selectedIndex + 1) % picker.candidateUids.length;
            Render();
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (picker.selectedIndex < 0) picker.selectedIndex = picker.candidateUids.length - 1;
            else picker.selectedIndex = (picker.selectedIndex - 1 + picker.candidateUids.length) % picker.candidateUids.length;
            Render();
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            if (picker.selectedIndex < 0) return;
            const uid = picker.candidateUids[picker.selectedIndex];
            if (uid) Actions.pickMention(tid, uid);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            Actions.closeMentionPicker();
            Render();
        }
    },
    handleTodoMentionBackspace: (event, tid) => {
        if (!(event.key === 'Backspace' || event.key === 'Delete')) return;
        const editor = document.getElementById('todo-editor');
        const sel = window.getSelection();
        if (!editor || !sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return;

        const getSiblingMention = (node, direction) => {
            if (!node) return null;
            let cur = node;
            while (cur && cur !== editor) {
                const sib = direction === 'prev' ? cur.previousSibling : cur.nextSibling;
                if (!sib) {
                    cur = cur.parentNode;
                    continue;
                }
                if (sib.nodeType === Node.TEXT_NODE && !(sib.textContent || '').trim()) {
                    cur = sib;
                    continue;
                }
                if (sib.nodeType === Node.ELEMENT_NODE && sib.classList?.contains('todo-mention')) return sib;
                return null;
            }
            return null;
        };

        let targetMention = null;
        if (event.key === 'Backspace') {
            if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) return;
            targetMention = getSiblingMention(range.startContainer, 'prev');
        } else if (event.key === 'Delete') {
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                const text = range.startContainer.textContent || '';
                if (range.startOffset < text.length) return;
            }
            targetMention = getSiblingMention(range.startContainer, 'next');
        }

        if (!targetMention) return;
        event.preventDefault();
        const raw = targetMention.textContent || '';
        const textNode = document.createTextNode(raw);
        targetMention.parentNode.replaceChild(textNode, targetMention);

        const next = document.createRange();
        if (event.key === 'Backspace') {
            next.setStart(textNode, raw.length);
        } else {
            next.setStart(textNode, 0);
        }
        next.collapse(true);
        sel.removeAllRanges();
        sel.addRange(next);
        Actions.updateEditorDraft(tid, editor.innerHTML);
    },
    pickMention: (tid, uid) => {
        const user = state.users.find(u => u.uid === uid);
        const editor = document.getElementById('todo-editor');
        if (!user || !editor) return;

        const sel = window.getSelection();
        if (!sel) return;
        let range;
        const selectionInsideEditor = sel.rangeCount && editor.contains(sel.anchorNode);
        if (selectionInsideEditor) {
            range = sel.getRangeAt(0).cloneRange();
        } else {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        // Remove current "@query" before caret when possible.
        const resolveTextContext = () => {
            const c = range.startContainer;
            const o = range.startOffset;
            if (c && c.nodeType === Node.TEXT_NODE) return { node: c, offset: o };
            if (c && c.nodeType === Node.ELEMENT_NODE && o > 0) {
                const prev = c.childNodes[o - 1];
                if (prev && prev.nodeType === Node.TEXT_NODE) {
                    return { node: prev, offset: (prev.textContent || '').length };
                }
            }
            return null;
        };
        const ctx = resolveTextContext();
        if (ctx) {
            const text = ctx.node.textContent || '';
            const before = text.slice(0, ctx.offset);
            const after = text.slice(ctx.offset);
            const atIndex = before.lastIndexOf('@');
            const valid = atIndex >= 0;
            if (valid) {
                ctx.node.textContent = before.slice(0, atIndex) + after;
                range = document.createRange();
                range.setStart(ctx.node, Math.min(atIndex, (ctx.node.textContent || '').length));
                range.collapse(true);
            }
        }

        const span = Actions.buildMentionSpan(user);

        const space = document.createTextNode(' ');
        range.insertNode(space);
        range.insertNode(span);
        const nextRange = document.createRange();
        nextRange.setStartAfter(space);
        nextRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nextRange);

        state.ui.skipMentionNormalizeOnce = true;
        Actions.closeMentionPicker();
        Actions.normalizeMentionsInEditor(tid, editor);
        Actions.updateEditorDraft(tid, editor.innerHTML);
        Render();
    },
    normalizeMentionsInEditor: (tid, editor) => {
        if (!editor) return;
        const t = state.tasks.find(x => x.id === tid);
        if (!t) return;
        const p = state.projects.find(x => x.id === t.projectId);
        const members = state.users.filter(u => (p?.memberIds || p?.members || []).includes(u.uid));
        if (!members.length) return;

        const byName = new Map(members.map(m => [(m.name || '').toLowerCase(), m]));
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        const targets = [];
        let node;
        while ((node = walker.nextNode())) {
            if (!node.parentElement) continue;
            if (node.parentElement.closest('.todo-mention')) continue;
            const text = node.textContent || '';
            if (!text.includes('@')) continue;
            targets.push(node);
        }

        const mentionRe = /(^|\s)@([^\s@]+)/g;
        targets.forEach(textNode => {
            const text = textNode.textContent || '';
            let m;
            let last = 0;
            const frag = document.createDocumentFragment();
            let replaced = false;
            while ((m = mentionRe.exec(text)) !== null) {
                const prefix = m[1] || '';
                const rawName = m[2] || '';
                const user = byName.get(rawName.toLowerCase());
                if (!user) continue;
                const start = m.index;
                const atPos = start + prefix.length;
                if (atPos > last) {
                    frag.appendChild(document.createTextNode(text.slice(last, atPos)));
                }
                const span = Actions.buildMentionSpan(user);
                frag.appendChild(span);
                last = atPos + 1 + rawName.length;
                replaced = true;
            }
            if (!replaced) return;
            if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
            textNode.parentNode.replaceChild(frag, textNode);
        });
    },
    execCmd: (cmd, val = null) => {
        document.execCommand(cmd, false, val);
        const editor = document.getElementById('todo-editor');
        if (editor) editor.focus();
    },
    removeEditorImage: (imageId) => {
        const list = state.ui.editorImages || [];
        const removed = list.find(x => (typeof x === 'object' && x.id === imageId));
        if (removed?.previewUrl && String(removed.previewUrl).startsWith('blob:')) {
            URL.revokeObjectURL(removed.previewUrl);
        }
        state.ui.editorImages = list.filter(x => (typeof x === 'object' ? x.id !== imageId : x !== imageId));
        Render();
    },
    clearEditorImages: () => {
        (state.ui.editorImages || []).forEach(x => {
            if (typeof x === 'object' && x.previewUrl && String(x.previewUrl).startsWith('blob:')) {
                URL.revokeObjectURL(x.previewUrl);
            }
        });
        state.ui.editorImages = [];
    },
    toEditorImageObject: (x, idx = 0) => {
        if (typeof x === 'object' && x) return x;
        const url = String(x || '');
        return {
            id: `remote:${idx}:${Date.now()}`,
            name: `图片${idx + 1}`,
            url,
            previewUrl: url,
            file: null
        };
    },
    compressTodoImage: async (file) => {
        if (!file || !(file.type || '').startsWith('image/')) return file;
        const img = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = () => reject(new Error('图片解码失败'));
                el.src = reader.result;
            };
            reader.onerror = () => reject(new Error('读取图片失败'));
            reader.readAsDataURL(file);
        });

        const maxW = 1600;
        const maxH = 1600;
        const ratio = Math.min(1, maxW / img.width, maxH / img.height);
        const targetW = Math.max(1, Math.round(img.width * ratio));
        const targetH = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const mime = 'image/jpeg';
        const quality = 0.82;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
        if (!blob) return file;
        return new File([blob], (file.name || 'image').replace(/\.\w+$/, '') + '.jpg', { type: mime });
    },
    uploadTodoImage: async (tid, file) => {
        const { storage, ref, uploadBytes, getDownloadURL } = window.fb;
        if (!state.currentUser?.uid) throw new Error('当前用户未登录');
        const compressedFile = await Actions.compressTodoImage(file);
        const mime = (compressedFile?.type || 'image/jpeg').toLowerCase();
        const extRaw = (mime.split('/')[1] || 'png').split('+')[0];
        const ext = extRaw.replace(/[^a-z0-9]/g, '') || 'png';
        const key = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const fileRef = ref(storage, `todo-images/${state.currentUser.uid}/${tid}/${key}.${ext}`);
        await uploadBytes(fileRef, compressedFile, { contentType: mime });
        return getDownloadURL(fileRef);
    },
    extractStoragePathFromUrl: (url) => {
        try {
            const u = new URL(url);
            if (!u.pathname.includes('/o/')) return null;
            const encoded = u.pathname.split('/o/')[1] || '';
            const decoded = decodeURIComponent(encoded);
            return decoded || null;
        } catch (e) {
            return null;
        }
    },
    deleteStorageTargets: async (targets = []) => {
        const { storage, ref, deleteObject } = window.fb;
        const uniq = Array.from(new Set((targets || []).filter(Boolean)));
        await Promise.all(uniq.map(async (target) => {
            const maybePath = String(target || '');
            const path = /^https?:\/\//.test(maybePath)
                ? (Actions.extractStoragePathFromUrl(maybePath) || maybePath)
                : maybePath;
            try {
                await deleteObject(ref(storage, path));
            } catch (e) {
                console.warn('删除 Storage 文件失败（忽略）:', path, e);
            }
        }));
    },
    collectTodoImageTargets: (todos = []) => {
        const out = [];
        (todos || []).forEach(td => {
            (td.images || []).forEach(img => {
                if (!img) return;
                if (typeof img === 'string') out.push(img);
                else if (img.url) out.push(img.url);
                else if (img.previewUrl && /^https?:\/\//.test(img.previewUrl)) out.push(img.previewUrl);
            });
        });
        return out;
    },
    resolveEditorImageUrls: async (tid) => {
        const images = (state.ui.editorImages || []).map((x, idx) => Actions.toEditorImageObject(x, idx));
        const out = [];
        for (const img of images) {
            if (img.file) {
                const url = await Actions.uploadTodoImage(tid, img.file);
                out.push(url);
            } else if (img.url) {
                out.push(img.url);
            } else if (img.previewUrl && /^https?:\/\//.test(img.previewUrl)) {
                out.push(img.previewUrl);
            }
        }
        return out;
    },
    handleTodoImageFiles: async (fileLike, tid, editor) => {
        const files = Array.from(fileLike || []).filter(f => f && (f.type || '').startsWith('image/'));
        if (!files.length || !editor) return false;
        const existingCount = (state.ui.editorImages || []).length;
        const MAX_TODO_IMAGES = 6;
        if (existingCount >= MAX_TODO_IMAGES) {
            alert('一条待办最多上传 6 张图片。');
            return false;
        }
        const slots = MAX_TODO_IMAGES - existingCount;
        const acceptedFiles = files.slice(0, slots);
        if (files.length > slots) {
            alert('一条待办最多上传 6 张图片。');
        }

        for (const file of acceptedFiles) {
            const id = `local:${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const previewUrl = URL.createObjectURL(file);
            state.ui.editorImages = [
                ...(state.ui.editorImages || []),
                { id, name: file.name || '图片', previewUrl, file, url: null }
            ];
        }
        Render();
        return true;
    },
    handleTodoDragOver: (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    },
    handleTodoDrop: async (event, tid) => {
        event.preventDefault();
        event.stopPropagation();
        const editor = document.getElementById('todo-editor');
        if (!editor) return;
        await Actions.handleTodoImageFiles(event.dataTransfer?.files, tid, editor);
    },
    handleTodoPaste: async (event, tid) => {
        const items = Array.from(event.clipboardData?.items || []);
        const files = items
            .filter(it => (it.type || '').startsWith('image/'))
            .map(it => it.getAsFile())
            .filter(Boolean);
        if (!files.length) return;
        event.preventDefault();
        event.stopPropagation();
        const editor = document.getElementById('todo-editor');
        if (!editor) return;
        await Actions.handleTodoImageFiles(files, tid, editor);
    },
    triggerTodoImageInput: (tid) => {
        document.getElementById(`todo-image-input-${tid}`)?.click();
    },
    handleTodoImageInputChange: async (tid, inputEl) => {
        const editor = document.getElementById('todo-editor');
        if (!editor || !inputEl?.files?.length) return;
        await Actions.handleTodoImageFiles(inputEl.files, tid, editor);
        inputEl.value = '';
    },
    updateEditorDraft: (tid, html) => {
        state.ui.editorTaskId = tid;
        state.ui.editorContent = html || '';
    },
    closeTodoPriorityMenu: () => {
        state.ui.todoPriorityMenuOpen = false;
        state.ui.todoPriorityMenuTarget = { mode: null, taskId: null, todoId: null };
        Render();
    },
    toggleTodoPriorityMenu: (mode = 'editor', taskId = null, todoId = null) => {
        const sameTarget = state.ui.todoPriorityMenuOpen
            && state.ui.todoPriorityMenuTarget?.mode === mode
            && state.ui.todoPriorityMenuTarget?.taskId === taskId
            && state.ui.todoPriorityMenuTarget?.todoId === todoId;
        state.ui.todoPriorityMenuOpen = !sameTarget;
        state.ui.todoPriorityMenuTarget = state.ui.todoPriorityMenuOpen
            ? { mode, taskId, todoId }
            : { mode: null, taskId: null, todoId: null };
        Render();
    },
    setTodoEditorPriority: async (priority, taskId = null, todoId = null) => {
        const nextPriority = ['high', 'medium', 'low', 'none'].includes(priority) ? priority : 'none';
        const target = state.ui.todoPriorityMenuTarget || {};
        const mode = target.mode || 'editor';
        const resolvedTaskId = taskId || target.taskId || null;
        const resolvedTodoId = todoId || target.todoId || null;

        if (mode === 'todo' && resolvedTaskId && resolvedTodoId) {
            const { db, doc, updateDoc } = window.fb;
            const task = state.tasks.find(t => t.id === resolvedTaskId);
            const todo = task?.todos?.find(td => td.id === resolvedTodoId);
            if (!task || !todo) return;
            todo.priority = nextPriority;
            state.ui.todoPriorityMenuOpen = false;
            state.ui.todoPriorityMenuTarget = { mode: null, taskId: null, todoId: null };
            Render();
            try {
                await updateDoc(doc(db, 'tasks', resolvedTaskId), { todos: task.todos });
            } catch (err) {
                console.warn('更新待办优先级失败:', err);
            }
            return;
        }

        state.ui.editorPriority = nextPriority;
        state.ui.todoPriorityMenuOpen = false;
        state.ui.todoPriorityMenuTarget = { mode: null, taskId: null, todoId: null };
        Render();
    },
    toggleCompletedTodoCollapse: (tid) => {
        const prev = !!state.ui.collapsedCompletedByTaskId?.[tid];
        state.ui.collapsedCompletedByTaskId = {
            ...(state.ui.collapsedCompletedByTaskId || {}),
            [tid]: !prev
        };
        Render();
    },
    handleTodoSubmitShortcut: (event, tid) => {
        if (!event) return;
        if (!(event.key === 'Enter' && (event.ctrlKey || event.metaKey))) return;
        if (event.isComposing || state.ui.mentionComposing) return;
        if (state.ui.todoSubmitUploading) return;
        event.preventDefault();
        event.stopPropagation();
        if (state.ui.editingTodoId) {
            Actions.saveTodo(tid);
        } else {
            Actions.addTodo(tid);
        }
    },
    setEditingTodo: (tid, todoId) => {
        const t = state.tasks.find(t => t.id === tid);
        const todo = t.todos.find(td => td.id === todoId);
        state.ui.editingTodoId = todoId;
        state.ui.editorTaskId = tid;
        state.ui.editorContent = todo.text;
        state.ui.editorImages = Array.isArray(todo.images) ? todo.images.map((img, idx) => Actions.toEditorImageObject(img, idx)) : [];
        state.ui.editorPriority = todo.priority || 'none';
        state.ui.todoPriorityMenuOpen = false;
        state.ui.todoPriorityMenuTarget = { mode: null, taskId: null, todoId: null };
        state.ui.todoScrollTarget = { type: 'editor', taskId: tid };
        Actions.closeMentionPicker();
        Render();
    },
    cancelEditingTodo: () => {
        state.ui.editingTodoId = null;
        state.ui.editorTaskId = null;
        state.ui.editorContent = '';
        Actions.clearEditorImages();
        state.ui.editorPriority = 'none';
        state.ui.todoPriorityMenuOpen = false;
        state.ui.todoPriorityMenuTarget = { mode: null, taskId: null, todoId: null };
        state.ui.todoScrollTarget = null;
        Actions.closeMentionPicker();
        Render();
    },
    saveTodo: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const editor = document.getElementById('todo-editor');
        if (!editor) return;
        Actions.normalizeMentionsInEditor(tid, editor);
        const normalizedHtml = Actions.trimTrailingTodoBreaks(editor.innerHTML);
        const hasImages = (state.ui.editorImages || []).length > 0;
        if (!normalizedHtml.trim() && !hasImages) return;
        const t = state.tasks.find(t => t.id === tid);
        const editedTodoId = state.ui.editingTodoId;
        const todo = t.todos.find(td => td.id === editedTodoId);
        const hasPendingUpload = (state.ui.editorImages || []).some(img => typeof img === 'object' && img?.file);
        Actions.savePendingTodoDraft(tid, { html: normalizedHtml, priority: state.ui.editorPriority || 'none' });
        let nextImages = [];
        try {
            if (hasPendingUpload) {
                state.ui.todoSubmitUploading = true;
                Render();
            }
            nextImages = await Actions.resolveEditorImageUrls(tid);
        } catch (err) {
            alert('图片上传失败，请稍后重试。');
            console.warn('保存待办时上传图片失败:', err);
            return;
        } finally {
            if (hasPendingUpload) {
                state.ui.todoSubmitUploading = false;
                Render();
            }
        }
        if (todo) { todo.text = normalizedHtml; todo.images = nextImages; todo.priority = state.ui.editorPriority || 'none'; }
        if (todo && window.queueTodoAnimation) window.queueTodoAnimation(tid, todo.id);
        if (todo) state.ui.todoScrollTarget = { type: 'todo', taskId: tid, todoId: todo.id };
        state.ui.editingTodoId = null; state.ui.editorTaskId = null; state.ui.editorContent = ''; state.ui.editorPriority = 'none'; state.ui.todoPriorityMenuOpen = false; state.ui.todoPriorityMenuTarget = { mode: null, taskId: null, todoId: null }; Actions.clearEditorImages();
        Actions.closeMentionPicker();
        try {
            await updateDoc(doc(db, 'tasks', tid), { todos: t.todos });
        } catch (err) {
            console.warn('保存待办到 Firestore 失败（本地仍已更新）:', err);
        }
        Actions.clearPendingTodoDraft(tid);
        Render();
    },
    reAddTodo: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const editor = document.getElementById('todo-editor');
        if (!editor) return;
        Actions.normalizeMentionsInEditor(tid, editor);
        const html = Actions.trimTrailingTodoBreaks(editor.innerHTML);
        const hasImages = (state.ui.editorImages || []).length > 0;
        if (!html.trim() && !hasImages) return;
        const t = state.tasks.find(t => t.id === tid);
        const hasPendingUpload = (state.ui.editorImages || []).some(img => typeof img === 'object' && img?.file);
        Actions.savePendingTodoDraft(tid, { html, priority: state.ui.editorPriority || 'none' });
        let nextImages = [];
        try {
            if (hasPendingUpload) {
                state.ui.todoSubmitUploading = true;
                Render();
            }
            nextImages = await Actions.resolveEditorImageUrls(tid);
        } catch (err) {
            alert('图片上传失败，请稍后重试。');
            console.warn('重新添加待办时上传图片失败:', err);
            return;
        } finally {
            if (hasPendingUpload) {
                state.ui.todoSubmitUploading = false;
                Render();
            }
        }
        t.todos = t.todos.filter(td => td.id !== state.ui.editingTodoId);
        const newTodoId = `td${Date.now()}`;
        t.todos.push({
            id: newTodoId,
            text: html,
            images: nextImages,
            priority: state.ui.editorPriority || 'none',
            completed: false,
            createdAt: Date.now(),
            createdBy: state.currentUser?.uid || null
        });
        if (window.queueTodoAnimation) window.queueTodoAnimation(tid, newTodoId);
        state.ui.todoScrollTarget = { type: 'todo', taskId: tid, todoId: newTodoId };
        state.ui.editingTodoId = null; state.ui.editorTaskId = null; state.ui.editorContent = ''; state.ui.editorPriority = 'none'; state.ui.todoPriorityMenuOpen = false; state.ui.todoPriorityMenuTarget = { mode: null, taskId: null, todoId: null }; Actions.clearEditorImages();
        Actions.closeMentionPicker();
        try {
            await updateDoc(doc(db, 'tasks', tid), { todos: t.todos });
        } catch (err) {
            console.warn('重新添加待办到 Firestore 失败（本地仍已更新）:', err);
        }
        Actions.clearPendingTodoDraft(tid);
        Render();
    },
    addTodo: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const editor = document.getElementById('todo-editor');
        if (!editor) return;
        Actions.normalizeMentionsInEditor(tid, editor);
        const html = Actions.trimTrailingTodoBreaks(editor.innerHTML);
        const hasImages = (state.ui.editorImages || []).length > 0;
        if (!html.trim() && !hasImages) return;
        const t = state.tasks.find(t => t.id === tid);
        const hasPendingUpload = (state.ui.editorImages || []).some(img => typeof img === 'object' && img?.file);
        // 提交开始时记录"待办草稿快照"，以便用户上传图片时关闭网页后下次提示恢复
        Actions.savePendingTodoDraft(tid, { html, priority: state.ui.editorPriority || 'none' });
        let nextImages = [];
        try {
            if (hasPendingUpload) {
                state.ui.todoSubmitUploading = true;
                Render();
            }
            nextImages = await Actions.resolveEditorImageUrls(tid);
        } catch (err) {
            alert('图片上传失败，请稍后重试。');
            console.warn('新增待办时上传图片失败:', err);
            return;
        } finally {
            if (hasPendingUpload) {
                state.ui.todoSubmitUploading = false;
                Render();
            }
        }
        const newTodoId = `td${Date.now()}`;
        t.todos.push({
            id: newTodoId,
            text: html,
            images: nextImages,
            priority: state.ui.editorPriority || 'none',
            completed: false,
            createdAt: Date.now(),
            createdBy: state.currentUser?.uid || null
        });
        if (window.queueTodoAnimation) window.queueTodoAnimation(tid, newTodoId);
        editor.innerHTML = ''; state.ui.editorTaskId = null; state.ui.editorContent = ''; state.ui.editorPriority = 'none'; state.ui.todoPriorityMenuOpen = false; state.ui.todoPriorityMenuTarget = { mode: null, taskId: null, todoId: null }; Actions.clearEditorImages();
        Actions.closeMentionPicker();
        try {
            await updateDoc(doc(db, 'tasks', tid), { todos: t.todos });
        } catch (err) {
            console.warn('新增待办到 Firestore 失败（本地仍已更新）:', err);
        }
        Actions.clearPendingTodoDraft(tid);
        Render();
    },
    copyTodoForAi: async (tid, tdid) => {
        const t = state.tasks.find(x => x.id === tid);
        const todo = t?.todos?.find(x => x.id === tdid);
        if (!todo) return;

        const html = String(todo.text || '');
        const textBox = document.createElement('div');
        textBox.innerHTML = html;
        const plainText = (textBox.textContent || textBox.innerText || '').trim();
        const imageUrls = (todo.images || []).filter(Boolean);
        const textWithImages = imageUrls.length
            ? `${plainText}\n${imageUrls.join('\n')}`.trim()
            : plainText;

        if (!navigator.clipboard) {
            alert('当前浏览器不支持系统剪贴板。');
            return;
        }

        const imageFetchFailures = [];
        const fetchedBlobs = [];

        try {
            const hasWriteApi = !!(window.ClipboardItem && navigator.clipboard.write);
            if (!hasWriteApi) {
                await navigator.clipboard.writeText(textWithImages);
                alert('已复制待办文字内容。当前环境不支持图片一起复制。');
                return;
            }

            const htmlWithImages = imageUrls.length
                ? `${html}<div>${imageUrls.map(u => `<img src="${u}" alt="todo-image" />`).join('')}</div>`
                : html;

            for (const url of imageUrls) {
                try {
                    const resp = await fetch(url, { mode: 'cors' });
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const blob = await resp.blob();
                    if (!(blob.type || '').startsWith('image/')) throw new Error(`非图片类型: ${blob.type || 'unknown'}`);
                    fetchedBlobs.push(blob);
                } catch (e) {
                    imageFetchFailures.push({
                        url,
                        reason: e?.message || String(e || 'unknown')
                    });
                }
            }

            if (!imageUrls.length) {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/plain': new Blob([textWithImages], { type: 'text/plain' }),
                        'text/html': new Blob([htmlWithImages], { type: 'text/html' })
                    })
                ]);
                alert('已复制待办内容。');
                return;
            }

            if (!fetchedBlobs.length) {
                console.warn('图片全部抓取失败，可能是跨域/CORS限制：', imageFetchFailures);
                await navigator.clipboard.writeText(textWithImages);
                alert('已复制待办文字内容。图片抓取失败，可能是跨域(CORS)限制。');
                return;
            }

            const firstBlob = fetchedBlobs[0];
            const firstMime = firstBlob.type || 'image/png';

            // 兼容优先：大多数聊天框对“首张图片+文字”或“仅首张图片”支持最好。
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/plain': new Blob([textWithImages], { type: 'text/plain' }),
                        'text/html': new Blob([htmlWithImages], { type: 'text/html' }),
                        [firstMime]: firstBlob
                    })
                ]);
                if (fetchedBlobs.length < imageUrls.length) {
                    console.warn('部分图片抓取失败（仅复制首张图片到剪贴板）:', imageFetchFailures);
                }
                alert(`已复制待办文字和首张图片（共抓取 ${fetchedBlobs.length}/${imageUrls.length} 张）。`);
                return;
            } catch (eCombined) {
                console.warn('组合复制失败，降级为仅图片复制:', eCombined);
            }

            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ [firstMime]: firstBlob })
                ]);
                alert(`已复制首张图片（共抓取 ${fetchedBlobs.length}/${imageUrls.length} 张）。若需文字请再复制一次。`);
                return;
            } catch (eImageOnly) {
                console.warn('仅图片复制也失败，降级为文字复制:', eImageOnly);
            }

            await navigator.clipboard.writeText(textWithImages);
            alert('已复制待办文字内容。当前浏览器/页面不支持图片写入剪贴板。');
        } catch (err) {
            console.warn('复制待办失败，降级为纯文本复制:', err);
            try {
                await navigator.clipboard.writeText(textWithImages);
                const reason = (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError'))
                    ? '剪贴板权限被浏览器拦截'
                    : '剪贴板写入失败';
                console.warn(`图片/富文本复制失败原因：${reason}`, err);
                if (imageFetchFailures.length) {
                    console.warn('图片抓取失败详情（可能跨域/CORS）:', imageFetchFailures);
                }
                alert(`已复制待办文字内容。图片复制失败：${reason}，或图片链接跨域(CORS)受限。`);
            } catch (e2) {
                console.error('复制待办彻底失败:', e2);
                alert('复制失败，请检查浏览器剪贴板权限。');
            }
        }
    },
    deleteTodo: async (tid, tdid) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(t => t.id === tid);
        if (!t) return;
        const targetTodo = (t?.todos || []).find(td => td.id === tdid);
        const todoImageTargets = Actions.collectTodoImageTargets(targetTodo ? [targetTodo] : []);
        t.todos = t.todos.filter(td => td.id !== tdid);
        if (state.ui.editingTodoId === tdid) { state.ui.editingTodoId = null; state.ui.editorTaskId = null; state.ui.editorContent = ''; }
        if (todoImageTargets.length) {
            await Actions.deleteStorageTargets(todoImageTargets);
        }
        try {
            await updateDoc(doc(db, 'tasks', tid), { todos: t.todos });
        } catch (err) {
            console.warn('删除待办到 Firestore 失败（本地仍已更新）:', err);
        }
        Render();
    },
    toggleTodo: async (tid, tdid) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(t => t.id === tid);
        const todo = t.todos.find(td => td.id === tdid);
        todo.completed = !todo.completed; todo.completedAt = todo.completed ? Date.now() : undefined;
        try {
            await updateDoc(doc(db, 'tasks', tid), { todos: t.todos });
        } catch (err) {
            console.warn('更新待办完成状态到 Firestore 失败（本地仍已更新）:', err);
        }
        Render();
    },

    // Task Drag & Drop for Reordering
    taskDragStart: (event, tid) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', tid);
        // 隐藏原位置的元素，拖动图像会自动生成
        setTimeout(() => {
            event.target.style.opacity = '0';
        }, 0);
        state.ui.draggedTaskId = tid;
    },
    taskDragOver: (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';

        const overElement = event.target.closest('[data-task-id]');
        if (!overElement || !state.ui.draggedTaskId) return;

        const overTaskId = overElement.getAttribute('data-task-id');
        const draggedTaskId = state.ui.draggedTaskId;

        if (draggedTaskId === overTaskId) return;

        // 获取项目ID
        const projectElement = overElement.closest('[data-project-id]');
        if (!projectElement) return;
        const projectId = projectElement.getAttribute('data-project-id');

        // 获取该项目的所有未完成任务元素
        const taskElements = Array.from(projectElement.querySelectorAll('[data-task-id]'));
        const draggedElement = taskElements.find(el => el.getAttribute('data-task-id') === draggedTaskId);
        if (!draggedElement) return;

        const draggedIndex = taskElements.indexOf(draggedElement);
        const overIndex = taskElements.indexOf(overElement);

        if (draggedIndex === -1 || overIndex === -1) return;

        // 计算移动方向和距离
        const draggedRect = draggedElement.getBoundingClientRect();
        const itemHeight = draggedRect.height + 4; // 4px gap

        // 重置所有 transform
        taskElements.forEach(el => {
            if (el !== draggedElement) {
                el.style.transform = '';
            }
        });

        // 应用位移
        if (draggedIndex < overIndex) {
            // 向下拖：拖动元素和目标之间的元素向上移
            for (let i = draggedIndex + 1; i <= overIndex; i++) {
                taskElements[i].style.transform = `translateY(-${itemHeight}px)`;
            }
        } else {
            // 向上拖：目标和拖动元素之间的元素向下移
            for (let i = overIndex; i < draggedIndex; i++) {
                taskElements[i].style.transform = `translateY(${itemHeight}px)`;
            }
        }
    },
    taskDrop: async (event, projectId, targetTaskId) => {
        event.preventDefault();
        event.stopPropagation();
        const draggedTaskId = event.dataTransfer.getData('text/plain');

        console.log('taskDrop 被调用:', { draggedTaskId, targetTaskId, projectId });

        // 重置所有 transform
        const projectElement = event.target.closest('[data-project-id]');
        if (projectElement) {
            projectElement.querySelectorAll('[data-task-id]').forEach(el => {
                el.style.transform = '';
            });
        }

        const { db, doc, updateDoc } = window.fb;
        const projectTasks = state.tasks.filter(t => t.projectId === projectId && !t.completed);
        const draggedTask = projectTasks.find(t => t.id === draggedTaskId);
        const targetTask = projectTasks.find(t => t.id === targetTaskId);

        console.log('找到的任务:', { draggedTask: draggedTask?.name, targetTask: targetTask?.name });

        if (!draggedTask || !targetTask) {
            console.warn('未找到任务，取消拖拽');
            state.ui.draggedTaskId = null;
            return;
        }

        // 如果拖到自己身上，也不处理
        if (draggedTaskId === targetTaskId) {
            console.log('拖到自己身上，取消');
            state.ui.draggedTaskId = null;
            return;
        }

        // 重新计算所有任务的 order
        // 按当前显示顺序排序（降序）
        projectTasks.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (b.order || 0) - (a.order || 0);
        });

        // 找到拖动任务和目标任务的索引
        const draggedIndex = projectTasks.findIndex(t => t.id === draggedTaskId);
        const targetIndex = projectTasks.findIndex(t => t.id === targetTaskId);

        console.log('排序前索引:', { draggedIndex, targetIndex });

        // 移除拖动任务，插入到目标位置
        projectTasks.splice(draggedIndex, 1);
        projectTasks.splice(targetIndex, 0, draggedTask);

        // 重新分配 order（从大到小）
        const maxOrder = projectTasks.length;
        projectTasks.forEach((task, index) => {
            task.order = maxOrder - index;
        });

        // 批量更新到 Firestore
        try {
            await Promise.all(projectTasks.map(task =>
                updateDoc(doc(db, 'tasks', task.id), { order: task.order })
            ));
            console.log('✅ 任务排序已更新', projectTasks.map(t => ({ id: t.id, name: t.name, order: t.order })));

            // 确保本地 state 也更新了
            projectTasks.forEach(task => {
                const localTask = state.tasks.find(t => t.id === task.id);
                if (localTask) {
                    localTask.order = task.order;
                }
            });
        } catch (err) {
            console.error('❌ 更新任务排序失败:', err);
            alert('更新任务排序失败，请重试');
        }

        state.ui.draggedTaskId = null;
        Render();
    },
    // Task container drag handlers (for dropping between tasks or in empty space)
    taskContainerDragOver: (event, projectId) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
    },
    taskContainerDrop: async (event, projectId) => {
        event.preventDefault();
        event.stopPropagation();

        const draggedTaskId = event.dataTransfer.getData('text/plain');
        if (!draggedTaskId) return;

        console.log('🎯 taskContainerDrop 被调用');

        // 找到鼠标位置应该插入的目标任务
        const projectElement = event.currentTarget;
        const taskElements = Array.from(projectElement.querySelectorAll('[data-task-id]'));

        if (taskElements.length === 0) return;

        const mouseY = event.clientY;

        // 重置所有 transform
        taskElements.forEach(el => {
            el.style.transform = '';
        });

        const { db, doc, updateDoc } = window.fb;
        const projectTasks = state.tasks.filter(t => t.projectId === projectId && !t.completed);
        const draggedTask = projectTasks.find(t => t.id === draggedTaskId);

        if (!draggedTask) {
            console.warn('未找到拖动的任务');
            state.ui.draggedTaskId = null;
            return;
        }

        // 按当前显示顺序排序
        projectTasks.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (b.order || 0) - (a.order || 0);
        });

        // 找到应该插入的位置（索引）
        let insertIndex = projectTasks.length; // 默认插入到最后

        for (let i = 0; i < taskElements.length; i++) {
            const el = taskElements[i];
            const taskId = el.getAttribute('data-task-id');
            const rect = el.getBoundingClientRect();
            const taskMiddle = rect.top + rect.height / 2;

            // 如果鼠标在这个任务的上半部分，插入到这个任务之前
            if (mouseY < taskMiddle) {
                // 找到这个任务在 projectTasks 中的索引
                insertIndex = projectTasks.findIndex(t => t.id === taskId);
                console.log(`📍 鼠标在任务 ${taskId} 上半部分，插入索引: ${insertIndex}`);
                break;
            }
        }

        // 如果循环结束还没找到，说明鼠标在所有任务下方，插入到最后
        if (insertIndex === projectTasks.length) {
            console.log('📍 鼠标在所有任务下方，插入到最后');
        }

        const draggedIndex = projectTasks.findIndex(t => t.id === draggedTaskId);

        console.log('当前位置:', draggedIndex, '目标位置:', insertIndex);

        // 如果位置没变，不处理
        if (draggedIndex === insertIndex || draggedIndex === insertIndex - 1) {
            console.log('位置没有改变，取消');
            state.ui.draggedTaskId = null;
            return;
        }

        // 移除拖动的任务
        projectTasks.splice(draggedIndex, 1);

        // 调整插入索引（因为移除了一个元素）
        const finalInsertIndex = insertIndex > draggedIndex ? insertIndex - 1 : insertIndex;

        // 插入到新位置
        projectTasks.splice(finalInsertIndex, 0, draggedTask);

        console.log('重新排序后:', projectTasks.map(t => t.name));

        // 重新分配 order（从大到小）
        const maxOrder = projectTasks.length;
        projectTasks.forEach((task, index) => {
            task.order = maxOrder - index;
        });

        // 批量更新到 Firestore
        try {
            await Promise.all(projectTasks.map(task =>
                updateDoc(doc(db, 'tasks', task.id), { order: task.order })
            ));
            console.log('✅ 任务排序已更新');

            // 更新本地 state
            projectTasks.forEach(task => {
                const localTask = state.tasks.find(t => t.id === task.id);
                if (localTask) {
                    localTask.order = task.order;
                }
            });
        } catch (err) {
            console.error('❌ 更新任务排序失败:', err);
            alert('更新任务排序失败，请重试');
        }

        state.ui.draggedTaskId = null;
        Render();
    },
    taskDragEnd: (event) => {
        event.target.style.opacity = '1';
        state.ui.draggedTaskId = null;
        // 清除所有 transform
        document.querySelectorAll('[data-task-id]').forEach(el => {
            el.style.transform = '';
        });
    },

    // Project Pin/Unpin (Personal)
    pinProject: async (pid) => {
        const { db, doc, updateDoc, arrayUnion } = window.fb;
        const uid = state.currentUser.uid;

        // 更新本地状态
        if (!state.currentUser.pinnedProjects) {
            state.currentUser.pinnedProjects = [];
        }
        if (!state.currentUser.pinnedProjects.includes(pid)) {
            state.currentUser.pinnedProjects.push(pid);
        }

        // 持久化到 Firestore
        try {
            await updateDoc(doc(db, 'users', uid), {
                pinnedProjects: arrayUnion(pid)
            });
            console.log('项目已置顶:', pid);
        } catch (err) {
            console.error('置顶项目失败:', err);
            alert('置顶项目失败，请重试');
        }

        Actions.closeContextMenu();
        Render();
    },
    unpinProject: async (pid) => {
        const { db, doc, updateDoc, arrayRemove } = window.fb;
        const uid = state.currentUser.uid;

        // 更新本地状态
        if (state.currentUser.pinnedProjects) {
            state.currentUser.pinnedProjects = state.currentUser.pinnedProjects.filter(id => id !== pid);
        }

        // 持久化到 Firestore
        try {
            await updateDoc(doc(db, 'users', uid), {
                pinnedProjects: arrayRemove(pid)
            });
            console.log('项目已取消置顶:', pid);
        } catch (err) {
            console.error('取消置顶项目失败:', err);
            alert('取消置顶项目失败，请重试');
        }

        Actions.closeContextMenu();
        Render();
    },

    // Task Pin/Unpin (Global - Shared)
    pinTask: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(task => task.id === tid);
        if (!t) return;

        t.pinned = true;

        try {
            await updateDoc(doc(db, 'tasks', tid), { pinned: true });
            console.log('任务已置顶:', tid);
        } catch (err) {
            console.error('置顶任务失败:', err);
            alert('置顶任务失败，请重试');
        }

        Actions.closeContextMenu();
        Render();
    },
    unpinTask: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(task => task.id === tid);
        if (!t) return;

        t.pinned = false;

        try {
            await updateDoc(doc(db, 'tasks', tid), { pinned: false });
            console.log('任务已取消置顶:', tid);
        } catch (err) {
            console.error('取消置顶任务失败:', err);
            alert('取消置顶任务失败，请重试');
        }

        Actions.closeContextMenu();
        Render();
    },

    // Project Drag & Drop for Reordering (Personal)
    projectDragStart: (event, pid) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', pid);
        // 隐藏原位置的元素，拖动图像会自动生成
        setTimeout(() => {
            event.target.style.opacity = '0';
        }, 0);
        state.ui.draggedProjectId = pid;
    },
    // Project container drag handlers
    projectContainerDragOver: (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
    },
    projectContainerDrop: async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const draggedProjectId = event.dataTransfer.getData('text/plain');
        if (!draggedProjectId) return;

        console.log('🎯 projectContainerDrop 被调用');

        const container = event.currentTarget;
        const projectElements = Array.from(container.querySelectorAll('[data-project-id]'));

        if (projectElements.length === 0) return;

        const mouseY = event.clientY;

        // 重置所有 transform
        projectElements.forEach(el => {
            el.style.transform = '';
        });

        const { db, doc, updateDoc } = window.fb;
        const uid = state.currentUser.uid;

        // 获取用户参与的所有项目
        const myProjects = state.projects.filter(p =>
            (p.memberIds || []).includes(uid)
        );

        // 按当前显示顺序排序
        const pinnedProjects = state.currentUser.pinnedProjects || [];
        const projectOrder = state.currentUser.projectOrder || [];

        myProjects.sort((a, b) => {
            const aPin = pinnedProjects.includes(a.id);
            const bPin = pinnedProjects.includes(b.id);
            if (aPin && !bPin) return -1;
            if (!aPin && bPin) return 1;

            const aOrder = projectOrder.indexOf(a.id);
            const bOrder = projectOrder.indexOf(b.id);
            if (aOrder !== -1 && bOrder !== -1) return aOrder - bOrder;
            if (aOrder !== -1) return -1;
            if (bOrder !== -1) return 1;
            return 0;
        });

        const draggedProject = myProjects.find(p => p.id === draggedProjectId);
        if (!draggedProject) {
            console.warn('未找到拖动的项目');
            state.ui.draggedProjectId = null;
            return;
        }

        // 找到应该插入的位置
        let insertIndex = myProjects.length; // 默认插入到最后

        for (let i = 0; i < projectElements.length; i++) {
            const el = projectElements[i];
            const projectId = el.getAttribute('data-project-id');
            const rect = el.getBoundingClientRect();
            const projectMiddle = rect.top + rect.height / 2;

            // 如果鼠标在这个项目的上半部分，插入到这个项目之前
            if (mouseY < projectMiddle) {
                insertIndex = myProjects.findIndex(p => p.id === projectId);
                console.log(`📍 鼠标在项目 ${projectId} 上半部分，插入索引: ${insertIndex}`);
                break;
            }
        }

        if (insertIndex === myProjects.length) {
            console.log('📍 鼠标在所有项目下方，插入到最后');
        }

        const draggedIndex = myProjects.findIndex(p => p.id === draggedProjectId);

        console.log('当前位置:', draggedIndex, '目标位置:', insertIndex);

        // 如果位置没变，不处理
        if (draggedIndex === insertIndex || draggedIndex === insertIndex - 1) {
            console.log('位置没有改变，取消');
            state.ui.draggedProjectId = null;
            return;
        }

        // 移除拖动的项目
        myProjects.splice(draggedIndex, 1);

        // 调整插入索引
        const finalInsertIndex = insertIndex > draggedIndex ? insertIndex - 1 : insertIndex;

        // 插入到新位置
        myProjects.splice(finalInsertIndex, 0, draggedProject);

        console.log('重新排序后:', myProjects.map(p => p.name));

        // 生成新的 projectOrder
        const newProjectOrder = myProjects.map(p => p.id);

        // 持久化到 Firestore
        try {
            await updateDoc(doc(db, 'users', uid), {
                projectOrder: newProjectOrder
            });
            console.log('✅ 项目排序已更新到 Firestore');

            // 更新本地状态
            state.currentUser.projectOrder = newProjectOrder;
        } catch (err) {
            console.error('❌ 更新项目排序失败:', err);
            alert('更新项目排序失败，请重试');
        }

        state.ui.draggedProjectId = null;
        Render();
    },
    projectDragOver: (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';

        const overElement = event.target.closest('[data-project-id]');
        if (!overElement || !state.ui.draggedProjectId) return;

        const overProjectId = overElement.getAttribute('data-project-id');
        const draggedProjectId = state.ui.draggedProjectId;

        if (draggedProjectId === overProjectId) return;

        // 获取所有项目元素
        const sidebar = document.querySelector('#sidebar-scroll');
        if (!sidebar) return;

        const projectElements = Array.from(sidebar.querySelectorAll('[data-project-id]'));
        const draggedElement = projectElements.find(el => el.getAttribute('data-project-id') === draggedProjectId);
        if (!draggedElement) return;

        const draggedIndex = projectElements.indexOf(draggedElement);
        const overIndex = projectElements.indexOf(overElement);

        if (draggedIndex === -1 || overIndex === -1) return;

        // 计算移动方向和距离
        const draggedRect = draggedElement.getBoundingClientRect();
        const itemHeight = draggedRect.height + 4; // 4px gap

        // 重置所有 transform
        projectElements.forEach(el => {
            if (el !== draggedElement) {
                el.style.transform = '';
            }
        });

        // 应用位移
        if (draggedIndex < overIndex) {
            // 向下拖：拖动元素和目标之间的元素向上移
            for (let i = draggedIndex + 1; i <= overIndex; i++) {
                projectElements[i].style.transform = `translateY(-${itemHeight}px)`;
            }
        } else {
            // 向上拖：目标和拖动元素之间的元素向下移
            for (let i = overIndex; i < draggedIndex; i++) {
                projectElements[i].style.transform = `translateY(${itemHeight}px)`;
            }
        }
    },
    projectDrop: async (event, targetProjectId) => {
        event.preventDefault();
        event.stopPropagation();
        const draggedProjectId = event.dataTransfer.getData('text/plain');

        // 重置所有 transform
        document.querySelectorAll('[data-project-id]').forEach(el => {
            el.style.transform = '';
        });

        if (draggedProjectId === targetProjectId) {
            state.ui.draggedProjectId = null;
            return;
        }

        const { db, doc, updateDoc } = window.fb;
        const uid = state.currentUser.uid;

        // 获取用户参与的所有项目
        const myProjects = state.projects.filter(p =>
            (p.memberIds || []).includes(uid)
        );

        // 按当前显示顺序排序（考虑置顶和个人排序）
        const pinnedProjects = state.currentUser.pinnedProjects || [];
        const projectOrder = state.currentUser.projectOrder || [];

        myProjects.sort((a, b) => {
            const aPin = pinnedProjects.includes(a.id);
            const bPin = pinnedProjects.includes(b.id);
            if (aPin && !bPin) return -1;
            if (!aPin && bPin) return 1;

            const aOrder = projectOrder.indexOf(a.id);
            const bOrder = projectOrder.indexOf(b.id);
            if (aOrder !== -1 && bOrder !== -1) return aOrder - bOrder;
            if (aOrder !== -1) return -1;
            if (bOrder !== -1) return 1;
            return 0;
        });

        // 找到拖动项目和目标项目的索引
        const draggedIndex = myProjects.findIndex(p => p.id === draggedProjectId);
        const targetIndex = myProjects.findIndex(p => p.id === targetProjectId);

        if (draggedIndex === -1 || targetIndex === -1) {
            state.ui.draggedProjectId = null;
            return;
        }

        // 移除拖动项目，插入到目标位置
        myProjects.splice(draggedIndex, 1);
        myProjects.splice(targetIndex, 0, state.projects.find(p => p.id === draggedProjectId));

        // 生成新的 projectOrder
        const newProjectOrder = myProjects.map(p => p.id);

        console.log('项目拖拽前顺序:', state.currentUser.projectOrder);
        console.log('项目拖拽后顺序:', newProjectOrder);

        // 持久化到 Firestore
        try {
            await updateDoc(doc(db, 'users', uid), {
                projectOrder: newProjectOrder
            });
            console.log('项目排序已更新到 Firestore');

            // 更新本地状态
            state.currentUser.projectOrder = newProjectOrder;
        } catch (err) {
            console.error('更新项目排序失败:', err);
            alert('更新项目排序失败，请重试');
        }

        state.ui.draggedProjectId = null;
        Render();
    },
    projectDragEnd: (event) => {
        event.target.style.opacity = '1';
        state.ui.draggedProjectId = null;
        // 清除所有 transform
        document.querySelectorAll('[data-project-id]').forEach(el => {
            el.style.transform = '';
        });
    },

    askAI: async (tid) => {
        state.ui.aiLoading = true; Render();
        const t = state.tasks.find(t => t.id === tid);
        const suggestions = await AIService.generateTodoSuggestions(t.name, t.description);
        suggestions.forEach(s => t.todos.push({ id: `ai${Math.random()}`, text: s, completed: false, createdAt: Date.now() }));
        state.ui.aiLoading = false; Render();
    },
    fetchSummary: async (pid) => {
        const p = state.projects.find(p => p.id === pid);
        const active = state.tasks.filter(t => t.projectId === pid && t.isLocked);
        const summary = await AIService.summarizeProjectStatus(p.name, active.length, active.map(t => t.name));
        state.ui.projectSummary = summary;
        const el = document.getElementById('ai-summary-text'); if (el) el.textContent = summary;
    }
};
