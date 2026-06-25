function RenderModals() {
    // 首次访问：弹出语言选择，必选一个才能用
    if (state.localePickerRequired) {
        return `
            <div class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div class="px-6 py-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">${Icon('languages', '', 20)}</div>
                        <h3 class="text-lg font-bold text-gray-800">${L('firstLang.title')}</h3>
                    </div>
                    <div class="p-4 space-y-2">
                        <button onclick="window.dispatch('setLocale', 'zh')" class="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center gap-3">
                            <span class="text-2xl">🇨🇳</span>
                            <span class="font-semibold text-gray-800">简体中文</span>
                        </button>
                        <button onclick="window.dispatch('setLocale', 'ja')" class="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center gap-3">
                            <span class="text-2xl">🇯🇵</span>
                            <span class="font-semibold text-gray-800">日本語</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Pending Todo Recovery (interrupted send)
    if (state.ui.pendingTodoRecovery) {
        const rec = state.ui.pendingTodoRecovery;
        const tempBox = document.createElement('div');
        tempBox.innerHTML = rec.html || '';
        const previewText = (tempBox.textContent || '').trim();
        const totalImg = (rec.images || []).length;
        const pendingImg = (rec.images || []).filter(i => i && i.pending).length;
        const uploadedImg = totalImg - pendingImg;
        return `
            <div class="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div class="px-6 py-5 border-b bg-amber-50 flex items-center gap-2">
                        <div class="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">${Icon('alert-triangle', '', 18)}</div>
                        <div>
                            <h3 class="text-lg font-bold text-gray-800">上次有未发送的待办</h3>
                            <p class="text-xs text-gray-500 mt-0.5">检测到一条没有发出去的待办，是否恢复？</p>
                        </div>
                    </div>
                    <div class="p-6 space-y-3 text-sm">
                        ${rec.projectName || rec.taskName ? `
                            <div class="text-xs text-gray-500">
                                ${rec.projectName ? `项目：<span class="text-gray-700 font-medium">${rec.projectName}</span>` : ''}
                                ${rec.projectName && rec.taskName ? ' · ' : ''}
                                ${rec.taskName ? `任务：<span class="text-gray-700 font-medium">${rec.taskName}</span>` : ''}
                            </div>
                        ` : ''}
                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-800 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                            ${previewText ? previewText.replace(/</g, '&lt;') : '<span class="text-gray-400 italic">（无文字内容）</span>'}
                        </div>
                        ${totalImg > 0 ? `
                            <div class="text-xs text-gray-500 flex items-center gap-1">
                                ${Icon('image', '', 14)} 共 ${totalImg} 张图片（已上传 ${uploadedImg}${pendingImg > 0 ? `，<span class="text-amber-600 font-medium">${pendingImg} 张未上传完成将丢失</span>` : ''}）
                            </div>
                        ` : ''}
                    </div>
                    <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
                        <button onclick="window.dispatch('dismissPendingTodoRecovery')" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg">放弃</button>
                        <button onclick="window.dispatch('restorePendingTodoDraft')" class="px-5 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm">恢复到编辑器</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Image Preview Modal (for todo inline images)
    if (state.ui.imagePreviewUrl) {
        const imageUrl = state.ui.imagePreviewUrl;
        return `
            <div class="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeImagePreview')">
                <div class="relative max-w-[90vw] max-h-[90vh]">
                    <button onclick="window.dispatch('closeImagePreview')" class="absolute -top-10 right-0 text-white/90 hover:text-white">${Icon('x', '', 26)}</button>
                    <img src="${imageUrl}" class="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl border border-white/20 bg-black/20" />
                </div>
            </div>
        `;
    }

    // Confirmation Modal (for delete project/task)
    if (state.confirmModal?.visible) {
        const confirmType = state.confirmModal.type;
        const confirmLabel = confirmType === 'leave_project'
            ? '确认退出'
            : (confirmType === 'discard_changes' ? '确认放弃' : '确认删除');
        return `
            <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeConfirmModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div class="px-6 py-5 border-b bg-gray-50">
                        <h3 class="text-lg font-bold text-gray-800">${state.confirmModal.title || '确认操作'}</h3>
                    </div>
                    <div class="p-6">
                        <p class="text-sm text-gray-600 leading-relaxed">${state.confirmModal.message || '确定要执行此操作吗？'}</p>
                    </div>
                    <div class="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
                        <button onclick="window.dispatch('closeConfirmModal')" class="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-200 transition-colors">取消</button>
                        <button onclick="window.dispatch('handleConfirm')" class="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition-colors">${confirmLabel}</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Project Context Menu (Sidebar - Project)
    if (state.contextMenu?.visible && state.contextMenu.projectId && !state.contextMenu.taskId) {
        const pid = state.contextMenu.projectId;
        const p = state.projects.find(proj => proj.id === pid);
        const isPinned = (state.currentUser?.pinnedProjects || []).includes(pid);
        const isOwner = p?.ownerId === state.currentUser?.uid;
        const isCompleted = !!p?.completed;

        const menuW = 180;
        const menuH = isPinned ? 128 : 128; // 3 items
        const x = Math.min(state.contextMenu.x, window.innerWidth - menuW - 8);
        const y = Math.min(state.contextMenu.y, window.innerHeight - menuH - 8);

        return `
            <div class="fixed inset-0 z-[80]" onclick="window.dispatch('closeContextMenu')">
                <div class="absolute bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden w-44" 
                     style="left:${x}px; top:${y}px" onclick="event.stopPropagation()">
                    <button onclick="window.dispatch('${isPinned ? 'unpinProject' : 'pinProject'}', '${pid}')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center text-gray-700">
                        ${Icon(isPinned ? 'pin-off' : 'pin', 'mr-2', 16)} ${isPinned ? '取消置顶' : '置顶项目'}
                    </button>
                    <button onclick="window.dispatch('markProjectCompleted', '${pid}')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center text-gray-700 border-t border-gray-100">
                        ${Icon(isCompleted ? 'rotate-ccw' : 'check-circle-2', 'mr-2', 16)} ${isCompleted ? '取消完成' : '项目完成'}
                    </button>
                    <button onclick="window.dispatch('openConfirmModal', '${isOwner ? 'delete_project' : 'leave_project'}', '${pid}', '${isOwner ? '删除项目' : '退出项目'}', '${isOwner ? '确定要删除这个项目吗？项目下所有任务也会被删除，此操作不可撤销。' : '确定要退出这个项目吗？你将不再是该项目成员。'}'); window.dispatch('closeContextMenu')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center text-red-600 border-t border-gray-100">
                        ${Icon(isOwner ? 'trash-2' : 'log-out', 'mr-2', 16)} ${isOwner ? '删除项目' : '退出项目'}
                    </button>
                </div>
            </div>
        `;
    }

    // Task Context Menu (Sidebar - Task)
    if (state.contextMenu?.visible && state.contextMenu.taskId) {
        const tid = state.contextMenu.taskId;
        const t = state.tasks.find(x => x.id === tid);
        const isCompleted = !!t?.completed;
        const isPinned = !!t?.pinned;

        // Keep menu inside viewport
        const menuW = 176; // ~w-44
        const menuH = 128;  // three items
        const x = Math.min(state.contextMenu.x, window.innerWidth - menuW - 8);
        const y = Math.min(state.contextMenu.y, window.innerHeight - menuH - 8);

        return `
            <div class="fixed inset-0 z-[80]" onclick="window.dispatch('closeContextMenu')">
                <div class="absolute bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden w-44" 
                     style="left:${x}px; top:${y}px" onclick="event.stopPropagation()">
                    <button onclick="window.dispatch('${isPinned ? 'unpinTask' : 'pinTask'}', '${tid}')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center text-gray-700">
                        ${Icon(isPinned ? 'pin-off' : 'pin', 'mr-2', 16)} ${isPinned ? '取消置顶' : '置顶任务'}
                    </button>
                    ${isCompleted ? `
                        <button onclick="window.dispatch('toggleTaskCompleted', '${tid}', false)" class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center text-gray-700">
                            ${Icon('rotate-ccw', 'mr-2', 16)} 继续任务
                        </button>
                    ` : `
                        <button onclick="window.dispatch('toggleTaskCompleted', '${tid}', true)" class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center text-gray-700">
                            ${Icon('check', 'mr-2', 16)} 任务完成
                        </button>
                    `}
                    <button onclick="window.dispatch('openConfirmModal', 'delete_task', '${tid}', '删除任务', '确定要删除这个任务吗？此操作不可撤销。'); window.dispatch('closeContextMenu')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center text-red-600 border-t border-gray-100">
                        ${Icon('trash-2', 'mr-2', 16)} 删除任务
                    </button>
                </div>
            </div>
        `;
    }

    // My Work Popover (Current user's active tasks across all projects)
    if (state.ui.myWorkPopoverOpen) {
        const myActiveTasks = state.tasks.filter(t => t.isLocked && t.lockedBy === state.currentUser.uid);
        const tasksByProjectId = myActiveTasks.reduce((acc, t) => {
            (acc[t.projectId] ||= []).push(t);
            return acc;
        }, {});

        const orderedProjectIds = Object.keys(tasksByProjectId).sort((a, b) => {
            const pa = state.projects.find(p => p.id === a)?.name || '';
            const pb = state.projects.find(p => p.id === b)?.name || '';
            return pa.localeCompare(pb);
        });

        return `
            <div class="fixed inset-0 z-[70]" onclick="window.dispatch('closeMyWorkPopover')">
                <div class="absolute bottom-20 left-4 w-64 bg-white rounded-xl border border-gray-100 overflow-hidden fade-in" onclick="event.stopPropagation()">
                    <div class="px-4 py-2.5 border-b bg-gray-50 flex justify-between items-center">
                        <h3 class="text-xs font-bold text-gray-800">正在进行中的任务</h3>
                        <button onclick="window.dispatch('closeMyWorkPopover')" class="text-gray-400 hover:text-gray-600">${Icon('x', '', 14)}</button>
                    </div>
                    <div class="p-2 max-h-72 overflow-y-auto custom-scrollbar">
                        ${myActiveTasks.length === 0 ? `
                            <div class="py-6 text-center">
                                <div class="text-gray-300 mb-2">${Icon('coffee', 'mx-auto', 28)}</div>
                                <p class="text-xs text-gray-400">目前没有正在处理的任务</p>
                            </div>
                        ` : orderedProjectIds.map(pid => {
            const proj = state.projects.find(p => p.id === pid);
            const list = tasksByProjectId[pid] || [];
            return `
                                <div class="mb-2">
                                    <div class="px-2 pt-2 pb-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                                        ${proj?.name || '未知项目'}
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        ${list.map(t => `
                                            <div onclick="window.dispatch('setView', {type:'task_detail', projectId:'${t.projectId}', taskId:'${t.id}'}); window.dispatch('closeMyWorkPopover')"
                                                 class="inline-flex items-center justify-between text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100 cursor-pointer">
                                                <div class="flex items-center min-w-0">
                                                    ${Icon('pen-tool', 'mr-1', 10, 'none', '#10b981')}
                                                    <span class="truncate max-w-[150px] font-medium">${t.name}</span>
                                                </div>
                                                <span class="text-[10px] font-mono text-emerald-600/70 timer-display ml-2" data-ts="${t.lockedAt}">00:00</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Member Modal
    if (state.ui.memberModalProjectId) {
        const pid = state.ui.memberModalProjectId;
        const p = state.projects.find(x => x.id === pid);
        const pMembers = state.users.filter(u => (p.memberIds || p.members || []).includes(u.uid));

        return `
            <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeMemberModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div class="px-6 py-5 border-b flex justify-between items-center bg-white">
                        <h3 class="text-lg font-bold text-gray-800">${L('memberModal.title')} <span class="ml-2 align-middle text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200">${p?.name || ''}</span></h3>
                        <button onclick="window.dispatch('closeMemberModal')" class="text-gray-400 hover:text-gray-600">${Icon('x', '', 24)}</button>
                    </div>
                    <div class="p-6 border-b">
                        <div class="flex gap-3 mb-3">
                            <div class="relative flex-1">
                                ${Icon('search', 'absolute left-3.5 top-3 text-gray-400', 18)}
                                <input type="text" placeholder="${L('memberModal.inputEmail')}" value="${state.ui.inviteInput}"
                                    oninput="state.ui.inviteInput = this.value" onkeydown="if(event.key==='Enter') window.dispatch('inviteSearchMember')"
                                    class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <button onclick="window.dispatch('inviteSearchMember')" class="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 shadow-sm">${L('newProject.searchBtn')}</button>
                        </div>
                        ${state.ui.inviteSearchResult ? (state.ui.inviteSearchResult.found ? `
                            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                                <div class="flex items-center">
                                    ${AvatarEmoji(state.ui.inviteSearchResult.user.emoji, 'w-8 h-8 rounded-full mr-3', 'text-xl')}
                                    <div>
                                        <p class="text-sm font-semibold text-gray-800">${state.ui.inviteSearchResult.user.name}</p>
                                        <p class="text-xs text-gray-500">${state.ui.inviteSearchResult.user.email}</p>
                                    </div>
                                </div>
                                <button onclick="window.dispatch('inviteMember')" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">${L('common.add')}</button>
                            </div>
                        ` : `
                            <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                ${Icon('alert-circle', 'inline mr-2', 16)} ${L('newProject.notFoundHint')}
                            </div>
                        `) : ''}
                    </div>
                    <div class="px-2 py-2 max-h-[400px] overflow-y-auto">
                        <p class="px-4 py-3 text-sm font-medium text-gray-400">${L('memberModal.existingMembers')}</p>
                        ${pMembers.map(m => {
            const isOwner = p.ownerId === m.uid;
            const isMe = m.uid === state.currentUser.uid;

            // 仅找到该成员在【当前项目】中正在进行的任务
            const projectActiveTasks = state.tasks.filter(t => t.projectId === pid && t.isLocked && t.lockedBy === m.uid);

            const bgClass = isMe ? 'bg-emerald-50' : 'bg-purple-50';
            const borderClass = isMe ? 'border-emerald-100' : 'border-purple-100';
            const textClass = isMe ? 'text-emerald-600' : 'text-purple-600';
            const iconColor = isMe ? '#10b981' : '#9333ea';

            return `
                                <div class="flex items-start px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors relative justify-between">
                                    <div class="flex items-start flex-1 cursor-pointer" onclick="window.dispatch('closeMemberModal')">
                                        ${AvatarEmoji(m.emoji, 'w-10 h-10 rounded-full border border-gray-100 mr-4 mt-0.5 bg-white', 'text-2xl')}

                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2">
                                                <p class="text-sm font-bold text-gray-800">${m.name}</p>
                                                ${isOwner ? `<span class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded font-medium">${L('memberModal.owner')}</span>` : ''}
                                            </div>

                                            <div class="mt-2 flex flex-wrap gap-1.5">
                                                ${projectActiveTasks.length === 0 ? `<p class="text-xs text-gray-400">${L('memberModal.currentlyIdle')}</p>` : projectActiveTasks.map(task => `
                                                    <div onclick="window.dispatch('setView', {type:'task_detail', projectId:'${pid}', taskId:'${task.id}'}); window.dispatch('closeMemberModal')"
                                                         class="inline-flex items-center text-[11px] ${textClass} ${bgClass} px-2 py-0.5 rounded-full border ${borderClass} cursor-pointer transition-all">
                                                        ${Icon('pen-tool', 'mr-1', 10, 'none', iconColor)}
                                                        <span class="truncate max-w-[140px] font-medium">${task.name}</span>
                                                        <span class="mx-1 opacity-40">|</span>
                                                        <span class="font-mono timer-display" data-ts="${task.lockedAt}">00:00</span>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Action Modal (Upload / Discard)
    if (state.ui.actionModalTaskId) {
        const tid = state.ui.actionModalTaskId;
        const t = state.tasks.find(x => x.id === tid);
        const isTextTask = t.kind === 'text';
        const githubLinked = !!t.github?.enabled;
        const primaryActionLabel = githubLinked ? '从 GitHub 记录版本并解锁' : '上传新版本并解锁';
        const primaryActionIcon = githubLinked ? 'github' : 'upload';

        return `
            <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeActionModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div class="px-6 py-5 border-b bg-gray-50">
                        <h3 class="text-lg font-bold text-gray-800 text-center">完成编辑</h3>
                        <p class="text-xs text-gray-500 text-center mt-1">请选择操作</p>
                    </div>
                    <div class="p-6 space-y-3">
                        ${isTextTask ? `
                        <!-- 无文件任务：结束占用（不支持备注） -->
                        <button onclick="window.dispatch('submitProgress', '${t.id}')" 
                            class="w-full flex items-center justify-center px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-md transition-all active:scale-95">
                            ${Icon('check', 'mr-2', 18)} 结束占用
                        </button>
                        ` : `
                        <!-- 有文件任务：上传文件 -->
                        <button onclick="window.dispatch('triggerUploadInModal', '${t.id}')" 
                            class="w-full flex items-center justify-center px-4 py-3 ${githubLinked ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95">
                            ${state.ui.isUploading ? Icon('loader-2', 'mr-2 animate-spin', 18) : Icon(primaryActionIcon, 'mr-2', 18)} ${primaryActionLabel}
                        </button>
                        <input type="file" id="modal-file-upload-${t.id}" class="hidden" onchange="window.dispatch('uploadFile', '${t.id}', this)">

                        <div>
                            <label class="block text-xs font-semibold text-gray-600 mb-1">版本备注（可选）</label>
                            <textarea id="upload-comment-${t.id}" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none" placeholder="这一版主要修改了哪些内容，方便成员快速了解"></textarea>
                        </div>
                        `}

                        <button onclick="window.dispatch('openConfirmModal', 'discard_changes', '${t.id}', '放弃修改', '确定要放弃所做的修改并解锁任务吗？这不会删除之前已上传的版本，只会放弃当前编辑周期内的修改。')" 
                            class="w-full flex items-center justify-center px-4 py-3 bg-white border-2 border-red-100 text-red-500 rounded-xl text-sm font-bold hover:bg-red-50 hover:border-red-200 transition-all active:scale-95">
                            ${Icon('x-circle', 'mr-2', 18)} 放弃修改 (不保存)
                        </button>
                        <button onclick="window.dispatch('closeActionModal')" class="w-full py-2 text-xs text-gray-400 hover:text-gray-600">取消</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Start Occupy Modal (separate from history modal)
    if (state.ui.startModalTaskId) {
        const tid = state.ui.startModalTaskId;
        const t = state.tasks.find(x => x.id === tid);
        const locker = state.users.find(u => u.uid === t?.lockedBy);

        const versions = [];
        if (t?.file && t.file.version > 0) {
            versions.push({
                version: t.file.version,
                size: t.file.size,
                ts: t.file.lastUpdated,
                note: t.file.note || '',
                isLatest: true,
                source: t.file.source || 'storage',
                branch: t.file.branch || '',
                commitSha: t.file.commitSha || ''
            });
        }
        (t?.activities || []).forEach(act => {
            if (act.type === 'upload' && !versions.find(v => v.version === act.version)) {
                versions.push({
                    version: act.version,
                    size: act.size || 'Unknown',
                    ts: act.timestamp,
                    note: act.note || '',
                    isLatest: false,
                    source: act.source || 'storage',
                    branch: act.branch || '',
                    commitSha: act.commitSha || ''
                });
            }
        });
        versions.sort((a, b) => b.version - a.version);
        const displayVersions = versions.slice(0, 3);

        return `
            <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeStartModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                    <div class="px-6 py-5 border-b flex justify-between items-center bg-white">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">${L('task.startWork')}</h3>
                            <p class="text-sm text-gray-500 mt-1 font-mono">${t?.file?.source === 'github' ? L('file.githubSnapshot') : (t?.file?.name || 'File')}</p>
                        </div>
                        <button onclick="window.dispatch('closeStartModal')" class="text-gray-400 hover:text-gray-600 transition-colors">${Icon('x', '', 24)}</button>
                    </div>

                    <div class="flex-1 overflow-y-auto p-6 bg-emerald-50/30 space-y-4">
                        ${t?.isLocked ? `
                            <div class="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-700 flex items-center justify-between">
                                <span>${Icon('lock', 'inline-block mr-2', 14)}${L('history.someoneOccupying', { name: locker?.name || '...' })}</span>
                            </div>
                        ` : `
                            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <h4 class="text-sm font-bold text-gray-800">${L('history.directStart')}</h4>
                                    <p class="text-xs text-gray-500 mt-0.5">${L('history.directStartHint')}</p>
                                </div>
                                <button onclick="window.dispatch('startTask', '${t.id}')" class="flex items-center px-4 py-2 text-sm text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm whitespace-nowrap">
                                    ${Icon('play', 'mr-2', 14)} ${L('task.startWork')}
                                </button>
                            </div>
                        `}

                        <div class="space-y-3">
                            ${displayVersions.map(v => `
                                <div class="bg-white border ${v.isLatest ? 'border-emerald-200 shadow-sm' : 'border-gray-200'} rounded-xl p-4 flex items-center justify-between hover:border-emerald-300 transition-colors group">
                                    <div class="flex items-center gap-4">
                                        <div class="bg-gray-100 p-3 rounded-lg text-gray-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                            ${Icon('file-clock', '', 24)}
                                        </div>
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <h4 class="text-lg font-bold text-gray-800">v${v.version}</h4>
                                                ${v.source === 'github' ? '<span class="text-[11px] font-semibold text-blue-600">GitHub</span>' : ''}
                                                ${v.isLatest ? `<span class="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded font-bold">${L('history.latest')}</span>` : ''}
                                            </div>
                                            <p class="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                                ${v.source === 'github'
                    ? `<span>commit ${String(v.commitSha || '').slice(0, 7)}</span> • <span>${formatDate(v.ts)}</span>`
                    : `<span>${formatDate(v.ts)}</span> • <span>${translateLegacyLabel(v.size)}</span>`}
                                            </p>
                                            ${v.note ? `<p class="mt-1 text-xs text-gray-500 line-clamp-2">${L('file.note', { note: v.note })}</p>` : ''}
                                        </div>
                                    </div>
                                    ${t?.isLocked
                ? `<button onclick="window.dispatch('downloadVersion', '${t.id}', '${v.version}')" class="flex items-center px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                                            ${Icon('download', 'mr-2', 14)} ${v.source === 'github' ? L('history.downloadFromGithub') : L('history.downloadOnly')}
                                        </button>`
                : `<button onclick="window.dispatch('startTaskWithDownload', '${t.id}', '${v.version}')" class="flex items-center px-4 py-2 text-sm text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm whitespace-nowrap">
                                            ${Icon('download', 'mr-2', 14)} ${L('history.downloadAndStart')}
                                        </button>`
            }
                                </div>
                            `).join('')}

                            ${displayVersions.length === 0 ? `<div class="text-center text-gray-400 py-4">${L('history.noVersionsForUse')}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Version History Modal
    if (state.ui.historyModalTaskId) {
        const tid = state.ui.historyModalTaskId;
        const t = state.tasks.find(x => x.id === tid);
        const locker = state.users.find(u => u.uid === t.lockedBy);

        // Build history list（带备注）
        const versions = [];
        if (t.file && t.file.version > 0) {
            versions.push({
                version: t.file.version,
                size: t.file.size,
                ts: t.file.lastUpdated,
                note: t.file.note || '',
                isLatest: true,
                source: t.file.source || 'storage',
                branch: t.file.branch || '',
                commitSha: t.file.commitSha || ''
            });
        }
        (t.activities || []).forEach(act => {
            if (act.type === 'upload') {
                if (!versions.find(v => v.version === act.version)) {
                    versions.push({
                        version: act.version,
                        size: act.size || 'Unknown',
                        ts: act.timestamp,
                        note: act.note || '',
                        isLatest: false,
                        source: act.source || 'storage',
                        branch: act.branch || '',
                        commitSha: act.commitSha || ''
                    });
                }
            }
        });
        versions.sort((a, b) => b.version - a.version);

        // LIMIT TO 3
        const displayVersions = versions.slice(0, 3);
        const nextVersion = (t.file?.version || 0) + 1;

        return `
            <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeHistoryModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                    <div class="px-6 py-5 border-b flex justify-between items-center bg-white">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">${L('history.title')}</h3>
                            <p class="text-sm text-gray-500 mt-1 font-mono">${t.file?.source === 'github' ? L('file.githubSnapshot') : (t.file?.name || 'File History')}</p>
                        </div>
                        <button onclick="window.dispatch('closeHistoryModal')" class="text-gray-400 hover:text-gray-600 transition-colors">${Icon('x', '', 24)}</button>
                    </div>

                    <div class="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">

                        ${t.isLocked ? `
                            <div class="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden">
                                <div class="flex items-center gap-4 z-10">
                                    <div class="bg-purple-100 p-3 rounded-lg text-purple-600">
                                        ${Icon('pen-tool', '', 24)}
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h4 class="text-lg font-bold text-gray-800">v${nextVersion} (${L('history.editing')})</h4>
                                            <span class="bg-purple-200 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                ${Icon('lock', '', 10)} ${locker?.name || 'Unknown'}
                                            </span>
                                        </div>
                                        <p class="text-sm text-purple-600 font-mono mt-1 timer-display" data-ts="${t.lockedAt}">00:00</p>
                                    </div>
                                </div>
                                <button disabled class="bg-white text-gray-400 border border-gray-200 px-4 py-2 rounded-lg text-sm cursor-not-allowed opacity-70 z-10 whitespace-nowrap">
                                    ${L('history.cannotDownload')}
                                </button>
                                <div class="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-purple-100 to-transparent opacity-50"></div>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="h-px bg-gray-200 flex-1"></div>
                                <span class="text-xs text-gray-400 font-medium uppercase tracking-wider">${L('history.availableVersions')}</span>
                                <div class="h-px bg-gray-200 flex-1"></div>
                            </div>
                        ` : ''}

                        <div class="space-y-3">
                            ${displayVersions.map(v => `
                                <div class="bg-white border ${v.isLatest ? 'border-blue-200 shadow-sm' : 'border-gray-200'} rounded-xl p-4 flex items-center justify-between hover:border-blue-300 transition-colors group">
                                    <div class="flex items-center gap-4">
                                        <div class="bg-gray-100 p-3 rounded-lg text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                            ${Icon('file-clock', '', 24)}
                                        </div>
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <h4 class="text-lg font-bold text-gray-800">v${v.version}</h4>
                                                ${v.source === 'github' ? '<span class="text-[11px] font-semibold text-blue-600">GitHub</span>' : ''}
                                                ${v.isLatest ? `<span class="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded font-bold">${L('history.latest')}</span>` : ''}
                                            </div>
                                            <p class="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                                ${v.source === 'github'
                    ? `<span>commit ${String(v.commitSha || '').slice(0, 7)}</span> • <span>${formatDate(v.ts)}</span>`
                    : `<span>${formatDate(v.ts)}</span> • <span>${translateLegacyLabel(v.size)}</span>`}
                                            </p>
                                            ${v.note ? `<p class="mt-1 text-xs text-gray-500 line-clamp-2">${L('file.note', { note: v.note })}</p>` : ''}
                                        </div>
                                    </div>

                                    <button onclick="window.dispatch('downloadVersion', '${t.id}', '${v.version}')" class="flex items-center px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                                        ${Icon('download', 'mr-2', 14)} ${L('history.downloadOnly')}
                                    </button>
                                </div>
                            `).join('')}

                            ${displayVersions.length === 0 ? `<div class="text-center text-gray-400 py-4">${L('history.noVersionsForHistory')}</div>` : ''}
                        </div>

                        <p class="text-center text-xs text-gray-300 mt-4">${L('history.autoCleaned')}</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Edit Project Modal
    if (state.ui.editProjectId) {
        const pid = state.ui.editProjectId;
        const p = state.projects.find(x => x.id === pid);
        return `
            <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeEditProjectModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onclick="event.stopPropagation()">
                    <div class="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                        <h3 class="text-lg font-bold text-gray-800">编辑项目</h3>
                        <button onclick="window.dispatch('closeEditProjectModal')" class="text-gray-400 hover:text-gray-600">${Icon('x', '', 20)}</button>
                    </div>
                    <div class="p-6 space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">项目名称</label>
                            <input id="edit-project-name" type="text" value="${p.name || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">项目简介</label>
                            <textarea id="edit-project-desc" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none">${p.description || ''}</textarea>
                        </div>
                    </div>
                    <div class="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                        <button onclick="window.dispatch('closeEditProjectModal')" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">取消</button>
                        <button onclick="window.dispatch('saveProjectEdit')" class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">保存</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Edit Task Modal
    if (state.ui.editTaskId) {
        const tid = state.ui.editTaskId;
        const t = state.tasks.find(x => x.id === tid);
        return `
            <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeEditTaskModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onclick="event.stopPropagation()">
                    <div class="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                        <h3 class="text-lg font-bold text-gray-800">编辑任务</h3>
                        <button onclick="window.dispatch('closeEditTaskModal')" class="text-gray-400 hover:text-gray-600">${Icon('x', '', 20)}</button>
                    </div>
                    <div class="p-6 space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">任务名称</label>
                            <input id="edit-task-name" type="text" value="${t.name || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">任务简介</label>
                            <textarea id="edit-task-desc" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none">${t.description || ''}</textarea>
                        </div>
                    </div>
                    <div class="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                        <button onclick="window.dispatch('closeEditTaskModal')" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">取消</button>
                        <button onclick="window.dispatch('saveTaskEdit')" class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">保存</button>
                    </div>
                </div>
            </div>
        `;
    }

    if (state.ui.githubLinkTaskId) {
        const tid = state.ui.githubLinkTaskId;
        const t = state.tasks.find(x => x.id === tid);
        const githubLink = t?.github?.enabled ? t.github : null;
        if (!t) return '';
        return `
            <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeGithubLinkModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onclick="event.stopPropagation()">
                    <div class="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                        <div>
                            <h3 class="text-lg font-bold text-gray-800">${L('github.linkTitle')}</h3>
                            <p class="text-xs text-gray-500 mt-1">${L('github.publicOnly')}</p>
                        </div>
                        <button onclick="window.dispatch('closeGithubLinkModal')" class="text-gray-400 hover:text-gray-600">${Icon('x', '', 20)}</button>
                    </div>
                    <div class="p-6 space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">${L('github.repoUrlLabel')}</label>
                            <input id="github-repo-url" type="text" value="${githubLink?.repoUrl || ''}" placeholder="https://github.com/owner/repo" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                            <p class="text-xs text-gray-400 mt-2">${L('github.repoUrlHint')}</p>
                        </div>
                        ${githubLink ? `
                            <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                <div class="text-sm font-semibold text-emerald-700">${githubLink.owner}/${githubLink.repo}</div>
                                <div class="text-xs text-emerald-600 mt-1">${L('github.defaultBranch')}${githubLink.branch || 'main'}</div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="px-6 py-4 bg-gray-50 border-t flex justify-between gap-3">
                        <div>
                            ${githubLink ? `
                                <button onclick="window.dispatch('disconnectGithubLink', '${tid}')" class="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">${L('github.disconnect')}</button>
                            ` : '<span></span>'}
                        </div>
                        <div class="flex gap-3">
                            <button onclick="window.dispatch('closeGithubLinkModal')" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">${L('common.cancel')}</button>
                            <button onclick="window.dispatch('saveGithubLink')" class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">${L('github.save')}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Profile / Username Modal
    if (state.ui.profileModalOpen) {
        const u = state.currentUser;

        let activationBtnHtml = '';
        if (u) {
            const isAdmin = u.uid === '0gKyPFlHBGg6jdljKDZ02gP8zGl1';
            const isInfinite = !!u.activationInfinite;
            const expiresMs = u.activationExpiresAt ? (u.activationExpiresAt.seconds ? u.activationExpiresAt.seconds * 1000 : u.activationExpiresAt) : 0;
            const remainDays = Math.max(0, Math.ceil((expiresMs - Date.now()) / 86400000));
            const isActivated = isAdmin || isInfinite || (remainDays > 0);

            if (isAdmin) {
                activationBtnHtml = `
                    <div class="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-200 flex items-center shadow-sm">
                        ${Icon('shield-check', 'mr-1', 14)} ${L('profile.admin')}
                    </div>
                `;
            } else if (isInfinite) {
                activationBtnHtml = `
                    <div class="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs border border-purple-200 flex items-center shadow-sm">
                        <span class="font-bold flex items-center gap-1">${Icon('infinity', '', 12)} ${L('profile.lifetimeActivated')}</span>
                    </div>
                `;
            } else if (isActivated) {
                activationBtnHtml = `
                    <div class="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs border border-green-200 flex flex-col items-center justify-center shadow-sm">
                        <span class="font-bold flex items-center gap-1">${Icon('check-circle-2', '', 12)} ${L('profile.activated')}</span>
                        <span class="text-[9px] font-medium opacity-80 -mt-0.5">${L('profile.daysLeft', { n: remainDays })}</span>
                    </div>
                `;
            } else {
                activationBtnHtml = `
                    <button onclick="window.dispatch('closeProfileModal'); window.dispatch('openActivationModal')" class="px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 flex items-center">
                        ${Icon('key', 'mr-1', 14)} ${L('profile.activate')}
                    </button>
                `;
            }
        }

        return `
            <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeProfileModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onclick="event.stopPropagation()">
                    <div class="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                        <h3 class="text-lg font-bold text-gray-800">${L('profile.title')}</h3>
                        <button onclick="window.dispatch('closeProfileModal')" class="text-gray-400 hover:text-gray-600">${Icon('x', '', 20)}</button>
                    </div>
                    <div class="p-6 space-y-4">
                        <div class="flex items-center gap-3 mb-2">
                            ${AvatarEmoji(u.emoji, 'w-12 h-12 rounded-full border-2 border-white shadow-sm bg-gray-50 flex-shrink-0', 'text-2xl')}
                            <div class="flex-1 min-w-0">
                                <p class="text-xs text-gray-400 mb-0.5">${L('profile.currentAccount')}</p>
                                <p class="text-sm font-medium text-gray-800 truncate" title="${u.email || ''}">${u.email || ''}</p>
                            </div>
                            <div class="flex-shrink-0 ml-1">
                                ${activationBtnHtml}
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">${L('profile.username')}</label>
                            <input id="edit-profile-name" type="text" value="${u.name || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                            <p class="mt-1 text-[11px] text-gray-400">${L('profile.usernameHint')}</p>
                        </div>
                    </div>
                    ${u.uid === '0gKyPFlHBGg6jdljKDZ02gP8zGl1' ? `
                    <div class="px-6 py-3 border-t border-gray-100">
                        <button onclick="window.dispatch('closeProfileModal'); window.dispatch('openActivationCodesModal')"
                            class="w-full flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold hover:from-amber-600 hover:to-orange-600 shadow-md transition-all active:scale-95">
                            ${Icon('key-round', 'mr-2', 16)} ${L('profile.codesAdmin')}
                        </button>
                    </div>
                    ` : ''}
                    <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-between gap-3">
                        <button onclick="window.dispatch('logout')" class="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50">${L('profile.logout')}</button>
                        <div class="flex gap-3">
                            <button onclick="window.dispatch('closeProfileModal')" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">${L('common.cancel')}</button>
                            <button onclick="window.dispatch('saveProfile')" class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">${L('common.save')}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Edit History Modal
    if (state.ui.editHistoryModalTaskId) {
        const tid = state.ui.editHistoryModalTaskId;
        const t = state.tasks.find(x => x.id === tid);
        const activities = t.activities || [];
        const isTextTask = t.kind === 'text';

        return `
            <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeEditHistoryModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                    <div class="px-6 py-5 border-b flex justify-between items-center bg-white">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">${isTextTask ? L('history.progressTitle') : L('history.editTitle')}</h3>
                            <p class="text-sm text-gray-500 mt-1 font-mono">${t.name}</p>
                        </div>
                        <button onclick="window.dispatch('closeEditHistoryModal')" class="text-gray-400 hover:text-gray-600 transition-colors">${Icon('x', '', 24)}</button>
                    </div>

                    <div class="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
                        ${activities.length === 0 ? `<div class="text-center text-gray-400 py-10">${isTextTask ? L('history.progressTitle') : L('history.editTitle')}</div>` : ''}
                        ${activities.map(act => {
            const user = state.users.find(u => u.uid === act.userId);
            const isUpload = act.type === 'upload';
            const isProgress = act.type === 'progress';
            const isAutoDiscard = act.type === 'auto_discard';
            const isMeAct = act.userId === state.currentUser?.uid;

            let icon, iconBg, title;
            if (isProgress) {
                icon = Icon('check-circle-2', '', 20);
                iconBg = isMeAct ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-700';
                title = L('history.submitProgress', { ver: act.version });
            } else if (isUpload) {
                icon = Icon('check-circle-2', '', 20);
                iconBg = isMeAct ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-700';
                title = L('history.commitVersion', { ver: act.version }) + (act.source === 'github' ? ' · GitHub' : '');
            } else if (isAutoDiscard) {
                icon = Icon('clock', '', 20);
                iconBg = 'bg-orange-100 text-orange-600';
                title = L('history.autoDiscard');
            } else {
                icon = Icon('x-circle', '', 20);
                iconBg = 'bg-red-100 text-red-600';
                title = L('history.discarded');
            }

            return `
                                <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                                    ${AvatarEmoji(user?.emoji, 'w-10 h-10 rounded-full border border-gray-100 flex-shrink-0 bg-white', 'text-2xl')}
                                    <div class="flex-1 min-w-0">
                                        <div class="flex justify-between items-start">
                                            <div>
                                                <h4 class="text-sm font-bold text-gray-800">${user?.name}</h4>
                                                <div class="flex items-center gap-2 mt-1">
                                                    <div class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${iconBg}">
                                                        ${icon} ${title}
                                                    </div>
                                                </div>
                                                ${act.note ? `<p class="mt-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100">${act.note}</p>` : ''}
                                            </div>
                                            <span class="text-xs text-gray-400 whitespace-nowrap">${formatDate(act.timestamp)}</span>
                                        </div>
                                        <div class="mt-3 flex items-center gap-4 text-xs text-gray-500 border-t border-gray-50 pt-3">
                                            <span class="flex items-center gap-1">${Icon('timer', '', 14)} ${L('history.duration')}: ${getFriendlyDuration(act.duration)}</span>
                                            ${isUpload ? `<span class="flex items-center gap-1">${Icon('hard-drive', '', 14)} ${L('history.fileSize')}: ${translateLegacyLabel(act.size)}</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Activation Codes Modal (Admin Only)
    if (state.ui.activationCodesModalOpen) {
        const codes = state.activationCodes || [];
        const usedCount = codes.filter(c => c.usedCount >= c.maxUses).length;
        const unusedCount = codes.filter(c => c.usedCount < c.maxUses).length;

        return `
            <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onclick="event.stopPropagation()">
                    <div class="px-6 py-5 border-b flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800 flex items-center">${Icon('key-round', 'mr-2 text-amber-500', 22)} 激活码管理</h3>
                            <p class="text-sm text-gray-500 mt-1">生成和管理用户激活码 · 激活后有效期 90 天 · 每码限用 1 次</p>
                        </div>
                        <button onclick="window.dispatch('closeActivationCodesModal')" class="text-gray-400 hover:text-gray-600 transition-colors">${Icon('x', '', 24)}</button>
                    </div>

                    <div class="px-6 py-4 border-b bg-white flex items-center justify-between">
                        <div class="flex gap-4">
                            <div class="flex items-center text-sm">
                                <span class="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                <span class="text-gray-600">可用 <strong class="text-gray-800">${unusedCount}</strong></span>
                            </div>
                            <div class="flex items-center text-sm">
                                <span class="w-2 h-2 rounded-full bg-gray-400 mr-2"></span>
                                <span class="text-gray-600">已用 <strong class="text-gray-800">${usedCount}</strong></span>
                            </div>
                            <div class="flex items-center text-sm">
                                <span class="text-gray-500">总计 <strong class="text-gray-800">${codes.length}</strong></span>
                            </div>
                        </div>
                        <button onclick="window.dispatch('generateActivationCode')" 
                            class="flex items-center px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 shadow-sm transition-all active:scale-95 ${state.ui.activationCodesLoading ? 'opacity-60 pointer-events-none' : ''}">
                            ${state.ui.activationCodesLoading ? Icon('loader-2', 'mr-2 animate-spin', 16) : Icon('plus', 'mr-2', 16)} 生成激活码
                        </button>
                    </div>

                    <div class="flex-1 overflow-y-auto p-4 bg-gray-50 custom-scrollbar">
                        ${codes.length === 0 ? `
                            <div class="py-16 text-center">
                                <div class="text-gray-300 mb-3">${Icon('key-round', 'mx-auto', 48)}</div>
                                <p class="text-gray-400 text-sm">暂无激活码</p>
                                <p class="text-gray-400 text-xs mt-1">点击上方按钮生成新的激活码</p>
                            </div>
                        ` : `
                            <div class="space-y-2">
                                ${codes.map(c => {
            const isUsed = c.usedCount >= c.maxUses;
            const createdMs = c.createdAt ? (c.createdAt.seconds ? c.createdAt.seconds * 1000 : c.createdAt) : 0;
            const createdDate = createdMs ? new Date(createdMs).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未知';
            const isInfinite = !!c.userActivationInfinite;
            // 用户激活到期时间（优先使用记录在码上的字段，旧数据回退到 usedAt/createdAt + duration）
            let userExpiryMs = 0;
            if (c.userActivationExpiresAt) {
                userExpiryMs = c.userActivationExpiresAt.seconds ? c.userActivationExpiresAt.seconds * 1000 : c.userActivationExpiresAt;
            } else if (isUsed && c.usedAt) {
                const baseMs = c.usedAt.seconds ? c.usedAt.seconds * 1000 : c.usedAt;
                userExpiryMs = baseMs + (c.durationDays || 90) * 86400000;
            }
            const isExpired = isUsed && !isInfinite && userExpiryMs && Date.now() > userExpiryMs;
            const remainDays = userExpiryMs ? Math.max(0, Math.ceil((userExpiryMs - Date.now()) / 86400000)) : 0;
            const expiryDate = userExpiryMs ? new Date(userExpiryMs).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
            const usedByUser = c.usedByEmail || c.usedByUid || '';
            const isEditing = state.ui.expiryEditorCode === c.code;
            // 编辑器默认日期（YYYY-MM-DD）
            const defaultDate = (() => {
                const ms = userExpiryMs || (Date.now() + 90 * 86400000);
                const d = new Date(ms);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            })();

            let statusBadge;
            if (!isUsed) {
                statusBadge = '<span class="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded font-medium">可用</span>';
            } else if (isInfinite) {
                statusBadge = '<span class="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded font-medium">永久</span>';
            } else if (isExpired) {
                statusBadge = '<span class="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded font-medium">已过期</span>';
            } else {
                statusBadge = '<span class="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">已激活</span>';
            }

            let iconCircle;
            if (!isUsed) {
                iconCircle = `<div class="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500">${Icon('key-round', '', 16)}</div>`;
            } else if (isInfinite) {
                iconCircle = `<div class="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">${Icon('infinity', '', 16)}</div>`;
            } else if (isExpired) {
                iconCircle = `<div class="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400">${Icon('clock', '', 16)}</div>`;
            } else {
                iconCircle = `<div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">${Icon('check', '', 16)}</div>`;
            }

            // 到期信息文案
            let expiryInfo;
            if (!isUsed) {
                expiryInfo = '未使用 · 激活后开始倒计时';
            } else if (isInfinite) {
                expiryInfo = '<span class="text-purple-500 font-medium">永久激活</span>';
            } else if (userExpiryMs) {
                expiryInfo = `到期: ${expiryDate}${!isExpired ? ` · <span class="text-amber-500 font-medium">剩余 ${remainDays} 天</span>` : ''}`;
            } else {
                expiryInfo = '到期信息缺失';
            }

            return `
                                        <div class="bg-white rounded-xl border ${isExpired ? 'border-red-200 opacity-70' : 'border-gray-200'} p-4 hover:shadow-sm transition-all">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-4 flex-1 min-w-0">
                                                    <div class="flex-shrink-0">${iconCircle}</div>
                                                    <div class="flex-1 min-w-0">
                                                        <div class="flex items-center gap-2">
                                                            <code class="text-sm font-mono font-bold ${isExpired ? 'text-red-500' : 'text-gray-800'} tracking-wider">${c.code}</code>
                                                            ${statusBadge}
                                                        </div>
                                                        <p class="text-[11px] text-gray-400 mt-1">创建: ${createdDate} · ${expiryInfo}</p>
                                                        ${isUsed && usedByUser ? `<p class="text-[11px] text-blue-400 mt-0.5">${Icon('user', 'inline-block mr-1 align-middle', 12)} 使用者: ${usedByUser}</p>` : ''}
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-1 ml-3">
                                                    ${isUsed ? `
                                                        <button onclick="window.dispatch('${isEditing ? 'closeExpiryEditor' : 'openExpiryEditor'}', '${c.code}')"
                                                            class="p-2 hover:bg-amber-50 text-gray-400 hover:text-amber-500 rounded-lg transition-colors" title="调整到期时间">
                                                            ${Icon('calendar-clock', '', 16)}
                                                        </button>
                                                    ` : `
                                                        <button onclick="window.dispatch('copyActivationCode', '${c.code}')"
                                                            class="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-500 rounded-lg transition-colors relative" title="复制">
                                                            <span id="copy-text-${c.code}" class="absolute -left-10 text-[10px] text-green-500 opacity-0 transition-opacity whitespace-nowrap">已复制</span>
                                                            ${Icon('copy', '', 16)}
                                                        </button>
                                                    `}
                                                    <button onclick="window.dispatch('openConfirmModal', 'delete_activation', '${c.code}', '删除激活码', '确定要删除激活码 ${c.code} 吗？')"
                                                        class="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors" title="删除">
                                                        ${Icon('trash-2', '', 16)}
                                                    </button>
                                                </div>
                                            </div>
                                            ${isEditing ? `
                                                <div class="mt-3 pt-3 border-t border-gray-100 bg-amber-50/40 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
                                                    <p class="text-[11px] font-semibold text-gray-600 mb-2">调整用户激活到期时间</p>
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <input id="expiry-date-input-${c.code}" type="date" value="${defaultDate}"
                                                            class="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none" />
                                                        <button onclick="window.dispatch('saveUserExpiry', '${c.code}', 'date')"
                                                            class="px-3 py-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm">
                                                            保存
                                                        </button>
                                                        <button onclick="window.dispatch('saveUserExpiry', '${c.code}', 'infinite')"
                                                            class="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg flex items-center gap-1">
                                                            ${Icon('infinity', '', 12)} 设为永久
                                                        </button>
                                                        <button onclick="window.dispatch('closeExpiryEditor')"
                                                            class="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                                                            取消
                                                        </button>
                                                    </div>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
        }).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }
    if (state.ui.activationModalOpen) {
        return `
            <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeActivationModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onclick="event.stopPropagation()">
                    <div class="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                        <h3 class="text-lg font-bold text-gray-800 flex items-center">
                            <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2">
                                ${Icon('key', '', 16)}
                            </div>
                            ${L('activation.title')}
                        </h3>
                        <button onclick="window.dispatch('closeActivationModal')" class="text-gray-400 hover:text-gray-600 transition-colors">${Icon('x', '', 20)}</button>
                    </div>
                    
                    <div class="p-6 space-y-5">
                        <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800">
                            <div class="flex-shrink-0 mt-0.5">
                                ${Icon('info', '', 18)}
                            </div>
                            <div class="text-sm">
                                <p class="font-bold mb-1">${L('activation.notice')}</p>
                                <p class="text-xs text-blue-700 opacity-90 leading-relaxed">${L('activation.detail')}</p>
                            </div>
                        </div>
                        
                        <div>
                            <label for="activation-code-input" class="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">${L('activation.codeLabel')}</label>
                            <input id="activation-code-input" type="text" placeholder="${L('activation.codePlaceholder')}"
                                class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono text-center tracking-widest text-lg font-bold uppercase"
                                onkeyup="if(event.key === 'Enter') window.dispatch('submitActivationCode')"
                            />
                        </div>
                    </div>
                    
                    <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
                        <button onclick="window.dispatch('closeActivationModal')" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors">${L('common.cancel')}</button>
                        <button onclick="window.dispatch('submitActivationCode')" class="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center">
                            ${Icon('zap', 'mr-1.5', 16)} ${L('activation.submit')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    if (state.ui.ganttModal?.mode) {
        return renderGanttModal();
    }

    return '';
}

function renderGanttLeftChip(it, isScheduled, myUid, g) {
    let chipDot;
    if (it.completed) chipDot = 'bg-gray-400';
    else if (!it.owners || it.owners.length === 0) chipDot = 'bg-white border border-gray-300';
    else if (myUid && it.owners.includes(myUid)) chipDot = 'bg-emerald-400';
    else chipDot = 'bg-purple-400';
    const isSel = g.selectedItemId === it.id;
    const pMeta = getTodoPriorityMeta(it.priority);
    const flag = (it.priority && it.priority !== 'none')
        ? `<span class="flex-shrink-0" title="${pMeta.label}">${Icon('flag', '', 11, 'none', pMeta.stroke)}</span>`
        : '';
    // 已排期与未排期都可拖：未排期 mode=new；已排期 mode=move（保持时长）
    const dragHandler = isScheduled
        ? `ondragstart="window.dispatch('onGanttBarDragStart', event, '${it.kind}', '${it.id}', ${Math.max(1, Math.round((it.endMs - it.startMs) / 86400000) + 1)})"`
        : `ondragstart="window.dispatch('onGanttChipDragStart', event, '${it.kind}', '${it.id}')"`;
    const baseCls = isScheduled
        ? 'bg-gray-50 border-gray-200 text-gray-500'
        : 'bg-white border-gray-200 text-gray-700';
    const selCls = isSel
        ? 'border-indigo-400 ring-1 ring-indigo-300 bg-indigo-50 text-gray-700'
        : `${baseCls} hover:border-indigo-300 hover:shadow`;
    return `
        <div draggable="true"
            ${dragHandler}
            onclick="window.dispatch('selectGanttItem', '${it.id}')"
            class="${selCls} border rounded-lg px-2 py-1.5 text-xs shadow-sm cursor-pointer flex items-center gap-1.5">
            <span class="inline-block w-1.5 h-1.5 rounded-full ${chipDot} flex-shrink-0"></span>
            ${flag}
            <span class="truncate flex-1" title="${(it.label || '').replace(/"/g, '&quot;')}">${(it.label || '').replace(/</g, '&lt;')}</span>
            ${isScheduled ? `<button onclick="event.stopPropagation(); window.dispatch('ganttJumpToItem', '${it.id}')"
                class="text-gray-400 hover:text-indigo-500 flex-shrink-0 p-0.5 rounded hover:bg-white" title="${L('gantt.jumpToItem')}">${Icon('calendar-check', '', 11)}</button>` : ''}
        </div>
    `;
}

function renderGanttModal() {
    const g = state.ui.ganttModal;
    const DAY = 86400000;
    const CELL_W = 34;
    const ROW_H = 34;
    const NAME_W = 130;
    const UNSCHED_W = 180;
    // 根据视口自适应：弹窗 min(96vw, 1500px)，扣掉左侧未排期面板，剩下的能塞几天就塞几天
    const vw = (typeof window !== 'undefined') ? window.innerWidth : 1500;
    const vh = (typeof window !== 'undefined') ? window.innerHeight : 900;
    const modalW = Math.min(vw * 0.96, 1500);
    const modalH = vh * 0.84;
    const timelineUsableW = Math.max(300, modalW - UNSCHED_W - 4);
    const ADAPTIVE_DAYS = Math.max(7, Math.floor(timelineUsableW / CELL_W));
    // 顶部头部 ~64 + 日期表头 ~48 + （选中时底部编辑面板 ~50）
    const reservedH = 64 + 48 + (g.selectedItemId ? 56 : 0);
    const usableH = Math.max(200, modalH - reservedH);
    const ADAPTIVE_ROWS = Math.max(5, Math.floor(usableH / ROW_H));
    const headerLabel = g.mode === 'project'
        ? (state.projects.find(p => p.id === g.projectId)?.name || '项目')
        : (state.tasks.find(t => t.id === g.taskId)?.name || '任务');

    // 解析 todo 文本中的 @mention uid
    const parseMentionUids = (html) => {
        if (!html) return [];
        const box = document.createElement('div');
        box.innerHTML = html;
        return Array.from(box.querySelectorAll('.todo-mention'))
            .map(el => el.getAttribute('data-mention-uid'))
            .filter(Boolean);
    };

    // 收集本弹窗管理的"项目"——任务项或 todo 项
    let items;
    if (g.mode === 'project') {
        const tasks = state.tasks.filter(t => t.projectId === g.projectId);
        items = tasks.map(t => ({
            kind: 'task',
            id: t.id,
            label: t.name,
            startMs: t.startMs || null,
            endMs: t.endMs || null,
            completed: !!t.completed,
            priority: getTodoPriorityValue({ priority: t.priority }),
            owners: Array.from(new Set(Array.isArray(t.ganttOwners) ? t.ganttOwners : []))
        }));
    } else {
        const task = state.tasks.find(t => t.id === g.taskId);
        const tempBox = document.createElement('div');
        items = (task?.todos || []).map(td => {
            tempBox.innerHTML = td.text || '';
            const plain = (tempBox.textContent || '').trim() || '（空待办）';
            const mentions = parseMentionUids(td.text || '');
            const explicit = Array.isArray(td.ganttOwners) ? td.ganttOwners : [];
            return {
                kind: 'todo',
                id: td.id,
                label: plain.length > 40 ? plain.slice(0, 40) + '…' : plain,
                startMs: td.startMs || null,
                endMs: td.endMs || null,
                completed: !!td.completed,
                priority: getTodoPriorityValue(td),
                owners: Array.from(new Set([...mentions, ...explicit]))
            };
        });
    }
    const myUid = state.currentUser?.uid;
    // 把 ganttOrder 也带回来用于排序
    items.forEach(it => {
        const src = g.mode === 'project'
            ? state.tasks.find(t => t.id === it.id)
            : (state.tasks.find(t => t.id === g.taskId)?.todos || []).find(td => td.id === it.id);
        if (src) it.ganttOrder = src.ganttOrder;
    });
    // 把 ganttRow 也带回来（用户手动指定的行号）
    items.forEach(it => {
        const src = g.mode === 'project'
            ? state.tasks.find(t => t.id === it.id)
            : (state.tasks.find(t => t.id === g.taskId)?.todos || []).find(td => td.id === it.id);
        if (src && Number.isFinite(src.ganttRow)) it.ganttRow = src.ganttRow;
    });
    const scheduled = items
        .filter(it => it.startMs && it.endMs)
        .sort((a, b) => (a.startMs - b.startMs) || (a.endMs - b.endMs));
    // 行分配：优先尊重用户手动设定的 ganttRow；剩下的自动 bin-packing 找最低非冲突行
    const itemRowIdx = new Map();
    const rowIntervals = {}; // rowIdx -> [{start,end}]
    const placeAtRow = (it, r) => {
        if (!rowIntervals[r]) rowIntervals[r] = [];
        rowIntervals[r].push({ start: it.startMs, end: it.endMs });
        itemRowIdx.set(it.id, r);
    };
    // 1) 先把显式 ganttRow 的条放到它们指定的行（即使可能与同行其它条重叠，也保留）
    scheduled.filter(it => Number.isFinite(it.ganttRow)).forEach(it => {
        placeAtRow(it, Math.max(0, it.ganttRow | 0));
    });
    // 2) 再把没有 ganttRow 的条自动放到最低非冲突行
    scheduled.filter(it => !Number.isFinite(it.ganttRow)).forEach(it => {
        for (let r = 0; r < 500; r++) {
            const arr = rowIntervals[r] || [];
            const conflict = arr.some(iv => !(it.endMs < iv.start || it.startMs > iv.end));
            if (!conflict) { placeAtRow(it, r); break; }
        }
    });

    // 左侧列表：与外面 todo 列表完全一致 —— 未完成（按优先级+时间）→ 近期已完成 → 默认显示的旧已完成 → (超 10 条时隐藏更早的)
    const sourceItemsForLeft = g.mode === 'project'
        ? state.tasks.filter(t => t.projectId === g.projectId)
        : (state.tasks.find(t => t.id === g.taskId)?.todos || []);
    const activeSrc = sortTodosByPriorityAndTime(sourceItemsForLeft.filter(x => !x.completed));
    const completedSrc = [...sourceItemsForLeft.filter(x => x.completed)]
        .sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));
    const collapseThresholdMs = 2 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const oldDone = completedSrc.filter(td => {
        const doneAt = td.completedAt || td.createdAt || 0;
        return doneAt > 0 && (nowMs - doneAt) >= collapseThresholdMs;
    });
    const recentDone = completedSrc.filter(td => !oldDone.includes(td));
    const totalCount = sourceItemsForLeft.length;
    const shouldAutoCollapseOld = totalCount > 10;
    let visibleOldDone = oldDone;
    let hiddenOldDone = [];
    if (shouldAutoCollapseOld) {
        const maxHidden = Math.max(0, totalCount - 10);
        const hiddenCount = Math.min(oldDone.length, maxHidden);
        visibleOldDone = oldDone.slice(0, oldDone.length - hiddenCount);
        hiddenOldDone = oldDone.slice(oldDone.length - hiddenCount);
    }
    const expandedHidden = !!state.ui.ganttModal.showHiddenOld;
    const orderedSrc = [...activeSrc, ...recentDone, ...visibleOldDone, ...(expandedHidden ? hiddenOldDone : [])];
    // 用 id 映射到我们已经构造好的 items 上
    const itemById = new Map(items.map(it => [it.id, it]));
    const leftItems = orderedSrc.map(s => itemById.get(s.id)).filter(Boolean);

    // 时间轴日期列（用自适应天数）
    const days = [];
    for (let i = 0; i < ADAPTIVE_DAYS; i++) {
        days.push(g.viewStartMs + i * DAY);
    }
    const today = Date.now();
    const todayStart = (() => { const d = new Date(today); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

    // 头部日期格子
    const headerCells = days.map(ms => {
        const d = new Date(ms);
        const isToday = ms === todayStart;
        const wd = weekdayLabels[d.getDay()];
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        return `
            <div class="flex-shrink-0 text-center border-r border-gray-100 ${isToday ? 'bg-amber-50' : (isWeekend ? 'bg-gray-50' : 'bg-white')}" style="width:${CELL_W}px; height:48px;">
                <div class="text-[10px] ${isToday ? 'text-amber-600 font-bold' : 'text-gray-400'} pt-1">${d.getMonth() + 1}/${d.getDate()}</div>
                <div class="text-[10px] ${isToday ? 'text-amber-600 font-bold' : 'text-gray-400'}">${wd}</div>
            </div>
        `;
    }).join('');

    // 渲染所有"打包"后的条：根据 itemRowIdx 决定 top
    // 总行数：用户已用行的最大值 + 1 与 自适应行数 取较大，保证填满屏幕
    const maxUsedRow = Array.from(itemRowIdx.values()).reduce((m, r) => Math.max(m, r), -1);
    const totalRows = Math.max(maxUsedRow + 1, ADAPTIVE_ROWS);
    const barsHtml = scheduled.map(it => {
        const rowIdx = itemRowIdx.get(it.id) || 0;
        const startMs = it.startMs;
        const endMs = it.endMs;
        const durDays = Math.max(1, Math.round((endMs - startMs) / DAY) + 1);
        const leftOffset = (startMs - g.viewStartMs) / DAY;
        const widthDays = durDays;
        const viewRight = ADAPTIVE_DAYS;
        const visible = leftOffset + widthDays > 0 && leftOffset < viewRight;
        if (!visible) return '';
        const isSel = g.selectedItemId === it.id;
        // 颜色：完成→灰；无负责人→白；含我→绿；只含其他→紫
        let barColor;
        if (it.completed) {
            barColor = 'bg-gray-300 text-gray-600';
        } else if (!it.owners || it.owners.length === 0) {
            barColor = 'bg-white text-gray-700 border border-gray-300';
        } else if (myUid && it.owners.includes(myUid)) {
            barColor = 'bg-emerald-400 text-white';
        } else {
            barColor = 'bg-purple-400 text-white';
        }

        const barLeft = Math.max(0, leftOffset) * CELL_W;
        const barClippedDays = Math.min(viewRight - Math.max(0, leftOffset), widthDays - Math.max(0, -leftOffset));
        const barWidth = Math.max(CELL_W - 8, barClippedDays * CELL_W - 6);
        const leftClipped = leftOffset < 0;
        const rightClipped = leftOffset + widthDays > viewRight;
        const topPx = rowIdx * ROW_H + 4;
        return `
            <div class="absolute ${barColor} rounded-md flex items-stretch overflow-hidden ${isSel ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}"
                style="left:${barLeft + 3}px; top:${topPx}px; width:${barWidth}px; height:${ROW_H - 8}px; z-index:5;">
                ${!leftClipped ? `<div
                    onmousedown="window.dispatch('onGanttResizeStart', event, '${it.kind}', '${it.id}', 'start')"
                    ondragstart="event.preventDefault()"
                    class="w-1.5 cursor-ew-resize bg-black/15 hover:bg-black/30 flex-shrink-0"
                    title="拖动调整开始日期"></div>` : ''}
                <div
                    onmousedown="window.dispatch('onGanttBarMouseDown', event, '${it.kind}', '${it.id}')"
                    ondragstart="event.preventDefault()"
                    class="flex-1 min-w-0 px-1.5 text-xs font-medium flex items-center gap-1 cursor-grab hover:brightness-95 select-none"
                    title="${(it.label || '').replace(/"/g, '&quot;')}">
                    ${(it.priority && it.priority !== 'none') ? `<span class="flex-shrink-0 opacity-90">${Icon('flag', '', 11, 'none', getTodoPriorityMeta(it.priority).stroke)}</span>` : ''}
                    <span class="truncate">${(it.label || '').replace(/</g, '&lt;')}</span>
                </div>
                ${!rightClipped ? `<div
                    onmousedown="window.dispatch('onGanttResizeStart', event, '${it.kind}', '${it.id}', 'end')"
                    ondragstart="event.preventDefault()"
                    class="w-1.5 cursor-ew-resize bg-black/15 hover:bg-black/30 flex-shrink-0"
                    title="拖动调整结束日期"></div>` : ''}
            </div>
        `;
    }).join('');

    // 背景网格：totalRows 行 × dayCount 列，每个格子是 drop target
    const gridRowsHtml = Array.from({ length: totalRows }).map(() => {
        const cells = days.map(ms => {
            const isToday = ms === todayStart;
            const isWeekend = new Date(ms).getDay() === 0 || new Date(ms).getDay() === 6;
            return `<div class="flex-shrink-0 border-r border-b border-gray-100 ${isToday ? 'bg-amber-50/30' : (isWeekend ? 'bg-gray-50/40' : '')}"
                style="width:${CELL_W}px; height:${ROW_H}px;"
                ondragover="window.dispatch('onGanttCellDragOver', event)"
                ondrop="window.dispatch('onGanttCellDrop', event, ${ms})"></div>`;
        }).join('');
        return `<div class="flex" style="height:${ROW_H}px;">${cells}</div>`;
    }).join('');

    const fmtDate = (ms) => {
        if (!ms) return '';
        const d = new Date(ms);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const selected = g.selectedItemId ? items.find(it => it.id === g.selectedItemId) : null;
    const selectedIsScheduled = !!(selected && selected.startMs && selected.endMs);

    return `
        <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style="width:min(96vw, 1500px); height:84vh;">
                <div class="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">${Icon('bar-chart-3', '', 18)}</div>
                        <div>
                            <h3 class="text-lg font-bold text-gray-800">${L('gantt.title')} · ${headerLabel.replace(/</g, '&lt;')}</h3>
                            <p class="text-xs text-gray-500">${L('gantt.hint')}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick="window.dispatch('ganttScroll', -30)" class="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-100 flex items-center" title="${L('gantt.prevMonth')}">${Icon('chevrons-left', '', 14)}</button>
                        <button onclick="window.dispatch('ganttScroll', -7)" class="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-100 flex items-center" title="${L('gantt.prevWeek')}">${Icon('chevron-left', '', 14)}</button>
                        <button onclick="window.dispatch('ganttJumpToday')" class="px-2 py-1 text-xs rounded ${(todayStart >= g.viewStartMs && todayStart < g.viewStartMs + ADAPTIVE_DAYS * DAY) ? 'bg-blue-500 text-white font-semibold hover:bg-blue-600' : 'border border-gray-200 hover:bg-gray-100'}">${L('common.today')}</button>
                        <button onclick="window.dispatch('ganttScroll', 7)" class="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-100 flex items-center" title="${L('gantt.nextWeek')}">${Icon('chevron-right', '', 14)}</button>
                        <button onclick="window.dispatch('ganttScroll', 30)" class="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-100 flex items-center" title="${L('gantt.nextMonth')}">${Icon('chevrons-right', '', 14)}</button>
                        <button onclick="window.dispatch('closeGantt')" class="ml-2 text-gray-400 hover:text-gray-600">${Icon('x', '', 22)}</button>
                    </div>
                </div>
                <div class="flex-1 flex overflow-hidden">
                    <!-- 左侧列表（顺序与外面 todo 完全一致） -->
                    <div class="flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50" style="width:${UNSCHED_W}px;"
                        ondragover="window.dispatch('onGanttUnscheduleDragOver', event)"
                        ondrop="window.dispatch('onGanttUnscheduleDrop', event)">
                        <div class="px-3 py-2 border-b border-gray-200 bg-white text-xs font-semibold text-gray-600 flex items-center justify-between">
                            <span>${g.mode === 'project' ? L('gantt.tasks') : L('gantt.todos')} · ${leftItems.length}${hiddenOldDone.length ? ` · ${L('gantt.hiddenCount', { n: hiddenOldDone.length })}` : ''}</span>
                            ${g.mode === 'task' ? `<button onclick="window.dispatch('openGanttQuickAdd')" class="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-600" title="${L('gantt.addTodo')}">${Icon('plus', '', 14)}</button>` : ''}
                        </div>
                        <div class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                            ${leftItems.length === 0
                                ? `<div class="text-[11px] text-gray-400 text-center mt-6 px-2">${L('gantt.empty')}</div>`
                                : leftItems.map(it => renderGanttLeftChip(it, !!(it.startMs && it.endMs), myUid, g)).join('')
                            }
                            ${hiddenOldDone.length ? `
                                <button onclick="window.dispatch('toggleGanttHiddenOld')"
                                    class="w-full mt-2 text-[11px] text-gray-500 hover:text-gray-700 py-1 rounded hover:bg-gray-100 border border-dashed border-gray-300">
                                    ${expandedHidden ? L('gantt.collapseOld') : L('gantt.expandOld', { n: hiddenOldDone.length })}
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <!-- 时间轴主体（自由摆放：bin-packing） -->
                    <div class="flex-1 overflow-auto custom-scrollbar">
                        <div class="inline-flex flex-col min-w-full">
                            <!-- 时间轴表头 -->
                            <div class="flex sticky top-0 z-10 bg-white border-b border-gray-200">
                                <div class="flex">${headerCells}</div>
                            </div>
                            <!-- 自由摆放区域：网格做背景 + 条绝对定位覆盖 -->
                            <div class="relative" style="height:${totalRows * ROW_H}px;">
                                <div>${gridRowsHtml}</div>
                                ${barsHtml}
                                ${scheduled.length === 0 ? `
                                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div class="text-center text-sm text-gray-400">
                                            ${L('gantt.noScheduled')}<br><span class="text-xs">${L('gantt.noScheduledHint')}</span>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                ${selected ? (() => {
                    // 项目成员列表用于负责人选择
                    const projectId = g.mode === 'project' ? g.projectId
                        : state.tasks.find(t => t.id === g.taskId)?.projectId;
                    const proj = state.projects.find(pp => pp.id === projectId);
                    const memberIds = (proj?.memberIds || proj?.members || []);
                    const members = state.users.filter(u => memberIds.includes(u.uid));
                    // 从 selected.owners 计算哪些是显式可移除的（todo 的 mention 来源不能取消）
                    let mentionUids = new Set();
                    if (selected.kind === 'todo') {
                        const tt = state.tasks.find(t => t.id === g.taskId);
                        const td = tt?.todos?.find(x => x.id === selected.id);
                        mentionUids = new Set(parseMentionUids(td?.text || ''));
                    }
                    return `
                    <div class="border-t bg-amber-50/60 px-6 py-3 flex flex-wrap items-center gap-3 text-xs">
                        <span class="font-semibold text-gray-700 truncate max-w-[260px] flex items-center gap-1" title="${(selected.label || '').replace(/"/g, '&quot;')}">
                            <span>${L('gantt.contentLabel')}</span><span class="truncate">${(selected.label || '').replace(/</g, '&lt;')}</span>
                            <button onclick="window.dispatch('openGanttQuickEdit')" class="ml-1 p-0.5 hover:bg-amber-100 rounded text-gray-500 hover:text-indigo-600 flex-shrink-0" title="${L('common.edit')}">${Icon('edit-3', '', 12)}</button>
                        </span>
                        ${selectedIsScheduled ? `
                            <label class="text-gray-500">${L('gantt.start')}</label>
                            <input type="date" value="${fmtDate(selected.startMs)}"
                                onchange="window.dispatch('updateGanttItemDate', '${selected.kind}', '${selected.id}', 'start', this.value)"
                                class="border border-gray-300 rounded px-2 py-1 text-xs" />
                            <label class="text-gray-500">${L('gantt.end')}</label>
                            <input type="date" value="${fmtDate(selected.endMs)}"
                                onchange="window.dispatch('updateGanttItemDate', '${selected.kind}', '${selected.id}', 'end', this.value)"
                                class="border border-gray-300 rounded px-2 py-1 text-xs" />
                        ` : ''}
                        <div class="flex items-center gap-1 flex-wrap relative">
                            <span class="text-gray-500">${L('gantt.ownerLabel')}</span>
                            ${selected.owners.length === 0
                                ? `<span class="text-gray-400">${L('gantt.ownerNone')}</span>`
                                : selected.owners.map(uid => {
                                    const u = state.users.find(x => x.uid === uid);
                                    if (!u) return '';
                                    const isMe = myUid === uid;
                                    const cls = isMe ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-purple-100 text-purple-700 border-purple-300';
                                    return `<span class="px-1.5 py-0.5 rounded border text-[11px] flex items-center gap-1 ${cls}" title="${(u.name || '').replace(/"/g, '&quot;')}">
                                        <span class="emoji-glyph text-[13px] leading-none">${u.emoji || '👤'}</span>
                                        <span>${(u.name || '').replace(/</g, '&lt;')}</span>
                                        <button onclick="window.dispatch('toggleGanttOwner', '${selected.kind}', '${selected.id}', '${uid}')" class="ml-0.5 hover:opacity-70 leading-none" title="${L('common.delete')}">×</button>
                                    </span>`;
                                }).join('')
                            }
                            <button onclick="window.dispatch('toggleGanttOwnerPicker')"
                                class="px-1.5 py-0.5 rounded border border-dashed border-gray-300 text-gray-500 text-[11px] hover:bg-gray-100 flex items-center gap-1">
                                ${Icon('plus', '', 10)} ${L('gantt.pickOwner')}
                            </button>
                            ${state.ui.ganttModal.ownerPickerOpen ? `
                                <div class="absolute bottom-full left-0 mb-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 max-h-60 overflow-y-auto custom-scrollbar w-56">
                                    ${members.length === 0
                                        ? `<div class="text-[11px] text-gray-400 px-2 py-1">${L('gantt.noMembersInProject')}</div>`
                                        : members.map(m => {
                                            const isOwner = selected.owners.includes(m.uid);
                                            const isMe = myUid === m.uid;
                                            return `<button onclick="window.dispatch('toggleGanttOwner', '${selected.kind}', '${selected.id}', '${m.uid}')"
                                                class="w-full text-left px-2 py-1 rounded text-[12px] flex items-center gap-2 hover:bg-gray-50">
                                                <span class="emoji-glyph text-[16px] leading-none">${m.emoji || '👤'}</span>
                                                <span class="flex-1 truncate ${isMe ? 'text-emerald-700 font-medium' : 'text-gray-700'}">${(m.name || '').replace(/</g, '&lt;')}${isMe ? L('gantt.iAm') : ''}</span>
                                                ${isOwner ? `<span class="text-emerald-500">${Icon('check', '', 14)}</span>` : ''}
                                            </button>`;
                                        }).join('')
                                    }
                                </div>
                            ` : ''}
                        </div>
                        <div class="flex items-center gap-1 relative">
                            <span class="text-gray-500">${L('gantt.priorityLabel')}</span>
                            ${(() => {
                                const cur = (selected.priority || 'none');
                                const curMeta = getTodoPriorityMeta(cur);
                                const curLabel = L('todo.priority' + cur.charAt(0).toUpperCase() + cur.slice(1));
                                const styleStr = cur === 'none'
                                    ? 'background:white; border-color:#e5e7eb; color:#6b7280;'
                                    : `background:${curMeta.bg}; border-color:${curMeta.stroke}; color:${curMeta.text};`;
                                return `<button onclick="window.dispatch('toggleGanttPriorityPicker')"
                                    class="px-1.5 py-0.5 rounded border text-[11px] flex items-center gap-1 ${cur !== 'none' ? 'font-semibold' : ''}"
                                    style="${styleStr}" title="${curLabel}">
                                    ${cur === 'none' ? Icon('minus', '', 11) : Icon('flag', '', 11, 'none', curMeta.stroke)}
                                    <span>${curLabel}</span>
                                    ${Icon('chevron-down', '', 10)}
                                </button>`;
                            })()}
                            ${state.ui.ganttModal.priorityPickerOpen ? `
                                <div class="absolute bottom-full left-0 mb-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-1 w-32">
                                    ${['high', 'medium', 'low', 'none'].map(opt => {
                                        const meta = getTodoPriorityMeta(opt);
                                        const optLabel = L('todo.priority' + opt.charAt(0).toUpperCase() + opt.slice(1));
                                        const active = (selected.priority || 'none') === opt;
                                        return `<button onclick="window.dispatch('setGanttItemPriority', '${selected.kind}', '${selected.id}', '${opt}'); window.dispatch('toggleGanttPriorityPicker')"
                                            class="w-full text-left px-2 py-1 rounded text-[12px] flex items-center gap-2 hover:bg-gray-50 ${active ? 'bg-gray-50 font-semibold' : ''}"
                                            style="color:${meta.text};">
                                            ${opt === 'none' ? Icon('minus', '', 12) : Icon('flag', '', 12, 'none', meta.stroke)}
                                            <span class="flex-1">${optLabel}</span>
                                            ${active ? Icon('check', '', 12) : ''}
                                        </button>`;
                                    }).join('')}
                                </div>
                            ` : ''}
                        </div>
                        ${selectedIsScheduled ? `
                            <button onclick="window.dispatch('${selected.kind === 'task' ? 'clearTaskSchedule' : 'clearTodoSchedule'}', ${selected.kind === 'task' ? `'${selected.id}'` : `'${g.taskId}', '${selected.id}'`})"
                                class="ml-auto px-2 py-1 text-xs rounded bg-white border border-red-200 text-red-500 hover:bg-red-50">${L('gantt.removeSchedule')}</button>
                        ` : '<div class="ml-auto"></div>'}
                        <button onclick="window.dispatch('selectGanttItem', null)" class="px-2 py-1 text-xs text-gray-500 hover:text-gray-800">${L('common.close')}</button>
                    </div>
                `;
                })() : ''}
                ${g.quickAddOpen ? `
                    <div class="absolute inset-0 z-40 flex items-center justify-center bg-black/30"
                        onclick="if(event.target===this) window.dispatch('closeGanttQuickAdd')">
                        <div class="bg-white rounded-xl shadow-2xl w-[480px] max-w-[90%] overflow-hidden">
                            <div class="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                                <h4 class="text-sm font-bold text-gray-800 flex items-center gap-2">${Icon('plus', '', 16)} ${L('gantt.addTodo')}</h4>
                                <button onclick="window.dispatch('closeGanttQuickAdd')" class="text-gray-400 hover:text-gray-600">${Icon('x', '', 18)}</button>
                            </div>
                            <div class="p-4">
                                <textarea id="gantt-quickadd-input" rows="3"
                                    oninput="window.dispatch('setGanttQuickAddText', this.value)"
                                    onkeydown="if(event.key==='Enter' && (event.ctrlKey||event.metaKey)) { event.preventDefault(); window.dispatch('submitGanttQuickAdd'); }"
                                    placeholder="${L('gantt.addTodoPlaceholder')}"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm">${(g.quickAddText || '').replace(/</g, '&lt;')}</textarea>
                            </div>
                            <div class="px-4 py-3 bg-gray-50 border-t flex justify-end gap-2">
                                <button onclick="window.dispatch('closeGanttQuickAdd')" class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded">${L('common.cancel')}</button>
                                <button onclick="window.dispatch('submitGanttQuickAdd')" class="px-4 py-1.5 text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded shadow-sm">${L('gantt.add')}</button>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${g.quickEditOpen ? `
                    <div class="absolute inset-0 z-40 flex items-center justify-center bg-black/30"
                        onclick="if(event.target===this) window.dispatch('closeGanttQuickEdit')">
                        <div class="bg-white rounded-xl shadow-2xl w-[480px] max-w-[90%] overflow-hidden">
                            <div class="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                                <h4 class="text-sm font-bold text-gray-800 flex items-center gap-2">${Icon('edit-3', '', 16)} ${L('gantt.editContent')}</h4>
                                <button onclick="window.dispatch('closeGanttQuickEdit')" class="text-gray-400 hover:text-gray-600">${Icon('x', '', 18)}</button>
                            </div>
                            <div class="p-4">
                                <textarea id="gantt-quickedit-input" rows="3"
                                    oninput="window.dispatch('setGanttQuickEditText', this.value)"
                                    onkeydown="if(event.key==='Enter' && (event.ctrlKey||event.metaKey)) { event.preventDefault(); window.dispatch('submitGanttQuickEdit'); }"
                                    placeholder="${g.mode === 'project' ? L('gantt.editContentPlaceholderTask') : L('gantt.editContentPlaceholderTodo')}"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm">${(g.quickEditText || '').replace(/</g, '&lt;')}</textarea>
                                ${g.mode === 'task' ? `<p class="text-[11px] text-gray-400 mt-1.5">${L('gantt.editContentHint')}</p>` : ''}
                            </div>
                            <div class="px-4 py-3 bg-gray-50 border-t flex justify-end gap-2">
                                <button onclick="window.dispatch('closeGanttQuickEdit')" class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded">${L('common.cancel')}</button>
                                <button onclick="window.dispatch('submitGanttQuickEdit')" class="px-4 py-1.5 text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded shadow-sm">${L('common.save')}</button>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}
