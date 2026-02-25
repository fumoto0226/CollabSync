// --- Actions ---

// 工具函数：检查当前用户是否已激活（且未过期）
function isUserActivated() {
    const u = state.currentUser;
    if (!u) return false;
    // 管理员始终视为已激活
    if (u.uid === '0gKyPFlHBGg6jdljKDZ02gP8zGl1') return true;
    if (!u.activationExpiresAt) return false;
    const expiresMs = u.activationExpiresAt.seconds
        ? u.activationExpiresAt.seconds * 1000
        : u.activationExpiresAt;
    return Date.now() < expiresMs;
}

const Actions = {
    login: async () => {
        const { auth, googleProvider, signInWithPopup } = window.fb;
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            console.error("Login failed:", err);
            alert("登录失败，请重试");
        }
    },
    logout: async () => {
        const { auth, signOut } = window.fb;
        await signOut(auth);
        state.activeView = { type: 'welcome' };
        try {
            localStorage.removeItem('cs_last_view');
        } catch (e) { }
        state.ui.profileModalOpen = false;
        Render();
    },
    setView: (view) => {
        if (state.authStatus !== 'authenticated') return;
        state.activeView = view;
        if (view.type === 'project_dashboard') Actions.fetchSummary(view.projectId);
        try {
            localStorage.setItem('cs_last_view', JSON.stringify(view));
        } catch (e) { }
        Render();
    },
    toggleProject: (pid) => {
        state.expandedProjects[pid] = !state.expandedProjects[pid];
        try {
            localStorage.setItem('cs_expanded_projects', JSON.stringify(state.expandedProjects));
        } catch (e) { }
        Render();
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
            await updateDoc(doc(db, 'projects', pid), {
                completed: true,
                completedAt: now
            });
            const p = state.projects.find(p => p.id === pid);
            if (p) {
                p.completed = true;
                p.completedAt = now;
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
        // 切换到文件任务时检查激活状态
        if (key === 'kind' && value === 'file' && !isUserActivated()) {
            alert('该功能需要激活账号后才能使用。请在个人设置中输入激活码进行激活。');
            return;
        }
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
        Render();
    },
    closeProfileModal: () => {
        state.ui.profileModalOpen = false;
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
        const { db, doc, deleteDoc, collection, query, where, getDocs, updateDoc, arrayRemove, getDoc, storage, ref, deleteObject } = window.fb;
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
                await Promise.all(paths.map(async p => {
                    try {
                        await deleteObject(ref(storage, p));
                    } catch (e) {
                        console.warn('删除 Storage 文件失败（忽略）:', p, e);
                    }
                }));
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
        const { db, doc, deleteDoc, storage, ref, deleteObject } = window.fb;
        const t = state.tasks.find(x => x.id === tid);
        if (!t) return;

        try {
            // 先删除 Storage 中的所有版本文件
            const paths = [];
            if (t.file?.path) paths.push(t.file.path);
            (t.activities || []).forEach(act => {
                if (act.type === 'upload' && act.path) paths.push(act.path);
            });
            await Promise.all(paths.map(async p => {
                try {
                    await deleteObject(ref(storage, p));
                } catch (e) {
                    console.warn('删除 Storage 文件失败（忽略）:', p, e);
                }
            }));

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
    openEditHistoryModal: (tid) => { state.ui.editHistoryModalTaskId = tid; Render(); },
    closeEditHistoryModal: () => { state.ui.editHistoryModalTaskId = null; Render(); },

    // Locking & Uploading
    startTask: async (tid, version) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(t => t.id === tid);
        if (!t) return;
        // 文件任务需要激活
        if (t.kind === 'file' && !isUserActivated()) {
            alert('该功能需要激活账号后才能使用。请在个人设置中输入激活码进行激活。');
            return;
        }
        const now = Date.now();
        t.isLocked = true;
        t.lockedBy = state.currentUser.uid;
        t.lockedAt = now;
        state.ui.historyModalTaskId = null;
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
        const t = state.tasks.find(t => t.id === tid);
        if (t && t.kind === 'file' && !isUserActivated()) {
            alert('该功能需要激活账号后才能使用。请在个人设置中输入激活码进行激活。');
            return;
        }
        Actions.downloadVersion(tid, ver);
        Actions.startTask(tid, ver);
    },
    downloadVersion: async (tid, ver) => {
        const t = state.tasks.find(t => t.id === tid);
        // 文件任务下载需要激活
        if (t && t.kind === 'file' && !isUserActivated()) {
            alert('该功能需要激活账号后才能使用。请在个人设置中输入激活码进行激活。');
            return;
        }
        if (!t || !t.file) {
            alert('当前任务没有可下载的文件');
            return;
        }

        // 版本号统一转成数字比较，避免 '1' 和 1 不相等
        const targetVer = Number(ver);

        let downloadURL = null;
        let storagePath = null;

        if (Number(t.file.version) === targetVer) {
            downloadURL = t.file.downloadURL;
            storagePath = t.file.path;
        } else if (t.activities && t.activities.length) {
            const act = t.activities.find(a =>
                a.type === 'upload' &&
                Number(a.version) === targetVer
            );
            if (act) {
                downloadURL = act.downloadURL;
                storagePath = act.path;
            }
        }

        if (!downloadURL && !storagePath) {
            alert('当前版本没有可下载的文件（可能是旧数据未记录下载地址）');
            return;
        }

        const fileName = (t.file && t.file.name) ? t.file.name : `task_${tid}_v${targetVer}`;

        try {
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
    triggerUploadInModal: (tid) => { document.getElementById(`modal-file-upload-${tid}`)?.click(); },
    triggerInitialUpload: (tid) => {
        const t = state.tasks.find(t => t.id === tid);
        if (t && t.kind === 'file' && !isUserActivated()) {
            alert('该功能需要激活账号后才能使用。请在个人设置中输入激活码进行激活。');
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

        // 先读取进度备注，再触发重新渲染
        let note = '';
        const noteInput = document.getElementById(`progress-note-${tid}`);
        if (noteInput) {
            note = noteInput.value.trim();
        }

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
            version: nextVer,
            note
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
            const createdMs = codeData.createdAt ? (codeData.createdAt.seconds ? codeData.createdAt.seconds * 1000 : codeData.createdAt) : 0;
            const expiryMs = createdMs + (codeData.durationDays || 90) * 86400000;
            if (Date.now() < expiryMs) {
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
            alert('🎉 激活成功！您现在可以使用文件任务功能了。');
            Render();
        } catch (err) {
            console.error('❌ 激活失败:', err);
            const msg = err.message || '未知错误';
            alert('激活失败: ' + msg);
        }
    },

    // Editor Actions
    execCmd: (cmd, val = null) => {
        document.execCommand(cmd, false, val);
        const editor = document.getElementById('todo-editor');
        if (editor) editor.focus();
    },
    updateEditorDraft: (tid, html) => {
        state.ui.editorTaskId = tid;
        state.ui.editorContent = html || '';
    },
    setEditingTodo: (tid, todoId) => {
        const t = state.tasks.find(t => t.id === tid);
        const todo = t.todos.find(td => td.id === todoId);
        state.ui.editingTodoId = todoId;
        state.ui.editorTaskId = tid;
        state.ui.editorContent = todo.text;
        Render();
    },
    cancelEditingTodo: () => {
        state.ui.editingTodoId = null;
        state.ui.editorTaskId = null;
        state.ui.editorContent = '';
        Render();
    },
    saveTodo: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const editor = document.getElementById('todo-editor');
        if (!editor || !editor.innerHTML.trim()) return;
        const t = state.tasks.find(t => t.id === tid);
        const editedTodoId = state.ui.editingTodoId;
        const todo = t.todos.find(td => td.id === editedTodoId);
        if (todo) { todo.text = editor.innerHTML; }
        if (todo && window.queueTodoAnimation) window.queueTodoAnimation(tid, todo.id);
        state.ui.editingTodoId = null; state.ui.editorTaskId = null; state.ui.editorContent = '';
        try {
            await updateDoc(doc(db, 'tasks', tid), { todos: t.todos });
        } catch (err) {
            console.warn('保存待办到 Firestore 失败（本地仍已更新）:', err);
        }
        Render();
    },
    reAddTodo: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const editor = document.getElementById('todo-editor');
        if (!editor || !editor.innerHTML.trim()) return;
        const html = editor.innerHTML;
        const t = state.tasks.find(t => t.id === tid);
        t.todos = t.todos.filter(td => td.id !== state.ui.editingTodoId);
        const newTodoId = `td${Date.now()}`;
        t.todos.push({ id: newTodoId, text: html, completed: false, createdAt: Date.now() });
        if (window.queueTodoAnimation) window.queueTodoAnimation(tid, newTodoId);
        state.ui.editingTodoId = null; state.ui.editorTaskId = null; state.ui.editorContent = '';
        try {
            await updateDoc(doc(db, 'tasks', tid), { todos: t.todos });
        } catch (err) {
            console.warn('重新添加待办到 Firestore 失败（本地仍已更新）:', err);
        }
        Render();
    },
    addTodo: async (tid) => {
        const { db, doc, updateDoc } = window.fb;
        const editor = document.getElementById('todo-editor');
        if (!editor || !editor.innerHTML.trim()) return;
        const html = editor.innerHTML;
        const t = state.tasks.find(t => t.id === tid);
        const newTodoId = `td${Date.now()}`;
        t.todos.push({ id: newTodoId, text: html, completed: false, createdAt: Date.now() });
        if (window.queueTodoAnimation) window.queueTodoAnimation(tid, newTodoId);
        editor.innerHTML = ''; state.ui.editorTaskId = null; state.ui.editorContent = '';
        try {
            await updateDoc(doc(db, 'tasks', tid), { todos: t.todos });
        } catch (err) {
            console.warn('新增待办到 Firestore 失败（本地仍已更新）:', err);
        }
        Render();
    },
    deleteTodo: async (tid, tdid) => {
        const { db, doc, updateDoc } = window.fb;
        const t = state.tasks.find(t => t.id === tid);
        t.todos = t.todos.filter(td => td.id !== tdid);
        if (state.ui.editingTodoId === tdid) { state.ui.editingTodoId = null; state.ui.editorTaskId = null; state.ui.editorContent = ''; }
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
