function RenderModals() {
    // Confirmation Modal (for delete project/task)
    if (state.confirmModal?.visible) {
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
                        <button onclick="window.dispatch('handleConfirm')" class="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition-colors">确认删除</button>
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
                        ${Icon('check-circle-2', 'mr-2', 16)} 项目完成
                    </button>
                    <button onclick="window.dispatch('openConfirmModal', 'delete_project', '${pid}', '删除项目', '确定要删除这个项目吗？项目下所有任务也会被删除，此操作不可撤销。'); window.dispatch('closeContextMenu')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center text-red-600 border-t border-gray-100">
                        ${Icon('trash-2', 'mr-2', 16)} 删除项目
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
                        <h3 class="text-lg font-bold text-gray-800">项目成员管理 <span class="ml-2 align-middle text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200">${p?.name || ''}</span></h3>
                        <button onclick="window.dispatch('closeMemberModal')" class="text-gray-400 hover:text-gray-600">${Icon('x', '', 24)}</button>
                    </div>
                    <div class="p-6 border-b">
                        <div class="flex gap-3 mb-3">
                            <div class="relative flex-1">
                                ${Icon('search', 'absolute left-3.5 top-3 text-gray-400', 18)}
                                <input type="text" placeholder="输入用户邮箱" value="${state.ui.inviteInput}"
                                    oninput="state.ui.inviteInput = this.value" onkeydown="if(event.key==='Enter') window.dispatch('inviteSearchMember')"
                                    class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <button onclick="window.dispatch('inviteSearchMember')" class="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 shadow-sm">搜索</button>
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
                                <button onclick="window.dispatch('inviteMember')" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">添加</button>
                            </div>
                        ` : `
                            <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                ${Icon('alert-circle', 'inline mr-2', 16)} 未找到此用户，请检查邮箱是否正确
                            </div>
                        `) : ''}
                    </div>
                    <div class="px-2 py-2 max-h-[400px] overflow-y-auto">
                        <p class="px-4 py-3 text-sm font-medium text-gray-400">现有成员</p>
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
                                                ${isOwner ? '<span class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded font-medium">Owner</span>' : ''}
                                            </div>

                                            <div class="mt-2 flex flex-wrap gap-1.5">
                                                ${projectActiveTasks.length === 0 ? '<p class="text-xs text-gray-400">目前空闲</p>' : projectActiveTasks.map(task => `
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

        return `
            <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeActionModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div class="px-6 py-5 border-b bg-gray-50">
                        <h3 class="text-lg font-bold text-gray-800 text-center">完成编辑</h3>
                        <p class="text-xs text-gray-500 text-center mt-1">请选择操作</p>
                    </div>
                    <div class="p-6 space-y-3">
                        ${isTextTask ? `
                        <!-- 无文件任务：提交进度 -->
                        <div>
                            <label class="block text-xs font-semibold text-gray-600 mb-1">进度备注（可选）</label>
                            <textarea id="progress-note-${t.id}" rows="3" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none" placeholder="记录本次进展情况，方便团队成员了解"></textarea>
                        </div>
                        <button onclick="window.dispatch('submitProgress', '${t.id}')" 
                            class="w-full flex items-center justify-center px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-md transition-all active:scale-95">
                            ${Icon('check', 'mr-2', 18)} 提交进度并解锁
                        </button>
                        ` : `
                        <!-- 有文件任务：上传文件 -->
                        <button onclick="window.dispatch('triggerUploadInModal', '${t.id}')" 
                            class="w-full flex items-center justify-center px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-md transition-all active:scale-95">
                            ${state.ui.isUploading ? Icon('loader-2', 'mr-2 animate-spin', 18) : Icon('upload', 'mr-2', 18)} 上传新版本并解锁
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
                isLatest: true
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
                        isLatest: false
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
                            <h3 class="text-xl font-bold text-gray-800">版本选择</h3>
                            <p class="text-sm text-gray-500 mt-1 font-mono">${t.file?.name || 'File History'}</p>
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
                                            <h4 class="text-lg font-bold text-gray-800">v${nextVersion} (正在编辑)</h4>
                                            <span class="bg-purple-200 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                ${Icon('lock', '', 10)} ${locker?.name || 'Unknown'}
                                            </span>
                                        </div>
                                        <p class="text-sm text-purple-600 font-mono mt-1 timer-display" data-ts="${t.lockedAt}">00:00</p>
                                    </div>
                                </div>
                                <button disabled class="bg-white text-gray-400 border border-gray-200 px-4 py-2 rounded-lg text-sm cursor-not-allowed opacity-70 z-10">
                                    无法下载
                                </button>
                                <div class="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-purple-100 to-transparent opacity-50"></div>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="h-px bg-gray-200 flex-1"></div>
                                <span class="text-xs text-gray-400 font-medium uppercase tracking-wider">可用版本</span>
                                <div class="h-px bg-gray-200 flex-1"></div>
                            </div>
                        ` : ''}

                        <div class="space-y-3">
                            ${(!t.isLocked && !t.completed) ? `
                                <div class="bg-white border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <h4 class="text-sm font-bold text-gray-800">直接开始占用</h4>
                                        <p class="text-xs text-gray-500 mt-0.5">不下载任何版本，直接进入占用状态</p>
                                    </div>
                                    <button onclick="window.dispatch('startTask', '${t.id}')" class="flex items-center px-4 py-2 text-sm text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm">
                                        ${Icon('play', 'mr-2', 14)} 开始占用
                                    </button>
                                </div>
                            ` : ''}

                            ${displayVersions.map(v => `
                                <div class="bg-white border ${v.isLatest ? 'border-blue-200 shadow-sm' : 'border-gray-200'} rounded-xl p-4 flex items-center justify-between hover:border-blue-300 transition-colors group">
                                    <div class="flex items-center gap-4">
                                        <div class="bg-gray-100 p-3 rounded-lg text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                            ${Icon('file-clock', '', 24)}
                                        </div>
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <h4 class="text-lg font-bold text-gray-800">v${v.version}</h4>
                                                ${v.isLatest ? '<span class="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded font-bold">Latest</span>' : ''}
                                            </div>
                                            <p class="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                                <span>${formatDate(v.ts)}</span> • <span>${v.size}</span>
                                            </p>
                                            ${v.note ? `<p class="mt-1 text-xs text-gray-500 line-clamp-2">备注：${v.note}</p>` : ''}
                                        </div>
                                    </div>

                                    ${t.isLocked
                ? `<button onclick="window.dispatch('downloadVersion', '${t.id}', '${v.version}')" class="flex items-center px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                            ${Icon('download', 'mr-2', 14)} 仅下载
                                        </button>`
                : `<button onclick="window.dispatch('startTaskWithDownload', '${t.id}', '${v.version}')" class="flex items-center px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-800 hover:text-white hover:border-transparent transition-colors shadow-sm">
                                            ${Icon('download', 'mr-2', 14)} 下载并占用
                                        </button>`
            }
                                </div>
                            `).join('')}

                            ${displayVersions.length === 0 ? '<div class="text-center text-gray-400 py-4">暂无历史版本</div>' : ''}
                        </div>

                        <p class="text-center text-xs text-gray-300 mt-4">早期版本已自动清理，仅保留最近 3 个版本</p>
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

    // Profile / Username Modal
    if (state.ui.profileModalOpen) {
        const u = state.currentUser;

        let activationBtnHtml = '';
        if (u) {
            const isAdmin = u.uid === '0gKyPFlHBGg6jdljKDZ02gP8zGl1';
            const expiresMs = u.activationExpiresAt ? (u.activationExpiresAt.seconds ? u.activationExpiresAt.seconds * 1000 : u.activationExpiresAt) : 0;
            const remainDays = Math.max(0, Math.ceil((expiresMs - Date.now()) / 86400000));
            const isActivated = isAdmin || (remainDays > 0);

            if (isAdmin) {
                activationBtnHtml = `
                    <div class="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-200 flex items-center shadow-sm" title="管理员无需激活">
                        ${Icon('shield-check', 'mr-1', 14)} 管理员
                    </div>
                `;
            } else if (isActivated) {
                activationBtnHtml = `
                    <div class="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs border border-green-200 flex flex-col items-center justify-center shadow-sm">
                        <span class="font-bold flex items-center gap-1">${Icon('check-circle-2', '', 12)} 已激活</span>
                        <span class="text-[9px] font-medium opacity-80 -mt-0.5">剩 ${remainDays} 天</span>
                    </div>
                `;
            } else {
                activationBtnHtml = `
                    <button onclick="window.dispatch('closeProfileModal'); window.dispatch('openActivationModal')" class="px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 flex items-center">
                        ${Icon('key', 'mr-1', 14)} 激活账号
                    </button>
                `;
            }
        }

        return `
            <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeProfileModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onclick="event.stopPropagation()">
                    <div class="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                        <h3 class="text-lg font-bold text-gray-800">个人设置</h3>
                        <button onclick="window.dispatch('closeProfileModal')" class="text-gray-400 hover:text-gray-600">${Icon('x', '', 20)}</button>
                    </div>
                    <div class="p-6 space-y-4">
                        <div class="flex items-center gap-3 mb-2">
                            ${AvatarEmoji(u.emoji, 'w-12 h-12 rounded-full border-2 border-white shadow-sm bg-gray-50 flex-shrink-0', 'text-2xl')}
                            <div class="flex-1 min-w-0">
                                <p class="text-xs text-gray-400 mb-0.5">当前账号</p>
                                <p class="text-sm font-medium text-gray-800 truncate" title="${u.email || ''}">${u.email || ''}</p>
                            </div>
                            <div class="flex-shrink-0 ml-1">
                                ${activationBtnHtml}
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">用户名</label>
                            <input id="edit-profile-name" type="text" value="${u.name || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                            <p class="mt-1 text-[11px] text-gray-400">修改后会在项目成员列表、任务占用等地方同步显示。</p>
                        </div>
                    </div>
                    ${u.uid === '0gKyPFlHBGg6jdljKDZ02gP8zGl1' ? `
                    <div class="px-6 py-3 border-t border-gray-100">
                        <button onclick="window.dispatch('closeProfileModal'); window.dispatch('openActivationCodesModal')" 
                            class="w-full flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold hover:from-amber-600 hover:to-orange-600 shadow-md transition-all active:scale-95">
                            ${Icon('key-round', 'mr-2', 16)} 激活码管理
                        </button>
                    </div>
                    ` : ''}
                    <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-between gap-3">
                        <button onclick="window.dispatch('logout')" class="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50">退出登录</button>
                        <div class="flex gap-3">
                            <button onclick="window.dispatch('closeProfileModal')" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">取消</button>
                            <button onclick="window.dispatch('saveProfile')" class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">保存</button>
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
                            <h3 class="text-xl font-bold text-gray-800">${isTextTask ? '进度记录' : '编辑记录'}</h3>
                            <p class="text-sm text-gray-500 mt-1 font-mono">${t.name}</p>
                        </div>
                        <button onclick="window.dispatch('closeEditHistoryModal')" class="text-gray-400 hover:text-gray-600 transition-colors">${Icon('x', '', 24)}</button>
                    </div>

                    <div class="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
                        ${activities.length === 0 ? `<div class="text-center text-gray-400 py-10">暂无${isTextTask ? '进度' : '编辑'}记录</div>` : ''}
                        ${activities.map(act => {
            const user = state.users.find(u => u.uid === act.userId);
            const isUpload = act.type === 'upload';
            const isProgress = act.type === 'progress';
            const isAutoDiscard = act.type === 'auto_discard';

            let icon, iconBg, title;
            if (isProgress) {
                icon = Icon('check-circle-2', '', 20);
                iconBg = 'bg-blue-100 text-blue-600';
                title = `提交进度 v${act.version}`;
            } else if (isUpload) {
                icon = Icon('check-circle-2', '', 20);
                iconBg = 'bg-green-100 text-green-600';
                title = `提交版本 v${act.version}`;
            } else if (isAutoDiscard) {
                icon = Icon('clock', '', 20);
                iconBg = 'bg-orange-100 text-orange-600';
                title = '超时自动放弃';
            } else {
                icon = Icon('x-circle', '', 20);
                iconBg = 'bg-red-100 text-red-600';
                title = '放弃了修改';
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
                                            <span class="flex items-center gap-1">${Icon('timer', '', 14)} 编辑时长: ${getFriendlyDuration(act.duration)}</span>
                                            ${isUpload ? `<span class="flex items-center gap-1">${Icon('hard-drive', '', 14)} 文件大小: ${act.size}</span>` : ''}
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
            <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 fade-in" onclick="if(event.target===this) window.dispatch('closeActivationCodesModal')">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onclick="event.stopPropagation()">
                    <div class="px-6 py-5 border-b flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800 flex items-center">${Icon('key-round', 'mr-2 text-amber-500', 22)} 激活码管理</h3>
                            <p class="text-sm text-gray-500 mt-1">生成和管理用户激活码 · 有效期 90 天 · 每码限用 1 次</p>
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
            const expiryMs = createdMs + (c.durationDays || 90) * 86400000;
            const expiryDate = createdMs ? new Date(expiryMs).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '未知';
            const isExpired = createdMs && Date.now() > expiryMs;
            const remainDays = createdMs ? Math.max(0, Math.ceil((expiryMs - Date.now()) / 86400000)) : 0;
            const usedByUser = c.usedByEmail || c.usedByUid || '';

            return `
                                        <div class="bg-white rounded-xl border ${isUsed ? 'border-gray-200 opacity-60' : isExpired ? 'border-red-200 opacity-70' : 'border-gray-200'} p-4 flex items-center justify-between hover:shadow-sm transition-all">
                                            <div class="flex items-center gap-4 flex-1 min-w-0">
                                                <div class="flex-shrink-0">
                                                    ${isUsed
                    ? `<div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">${Icon('check', '', 16)}</div>`
                    : isExpired
                        ? `<div class="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400">${Icon('clock', '', 16)}</div>`
                        : `<div class="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500">${Icon('key-round', '', 16)}</div>`
                }
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <div class="flex items-center gap-2">
                                                        <code class="text-sm font-mono font-bold ${isUsed ? 'text-gray-400' : isExpired ? 'text-red-500' : 'text-gray-800'} tracking-wider">${c.code}</code>
                                                        ${isUsed
                    ? '<span class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">已使用</span>'
                    : isExpired
                        ? '<span class="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded font-medium">已过期</span>'
                        : '<span class="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded font-medium">可用</span>'
                }
                                                    </div>
                                                    <p class="text-[11px] text-gray-400 mt-1">创建: ${createdDate} · 到期: ${expiryDate}${!isUsed && !isExpired ? ` · <span class="text-amber-500 font-medium">剩余 ${remainDays} 天</span>` : ''}</p>
                                                    ${isUsed && usedByUser ? `<p class="text-[11px] text-blue-400 mt-0.5">${Icon('user', 'inline-block mr-1 align-middle', 12)} 使用者: ${usedByUser}</p>` : ''}
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-1 ml-3">
                                                ${!isUsed ? `
                                                    <button onclick="window.dispatch('copyActivationCode', '${c.code}')" 
                                                        class="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-500 rounded-lg transition-colors relative" title="复制">
                                                        <span id="copy-text-${c.code}" class="absolute -left-10 text-[10px] text-green-500 opacity-0 transition-opacity whitespace-nowrap">已复制</span>
                                                        ${Icon('copy', '', 16)}
                                                    </button>
                                                ` : ''}
                                                <button onclick="window.dispatch('openConfirmModal', 'delete_activation', '${c.code}', '删除激活码', '确定要删除激活码 ${c.code} 吗？')" 
                                                    class="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors" title="删除">
                                                    ${Icon('trash-2', '', 16)}
                                                </button>
                                            </div>
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
                            激活高级功能
                        </h3>
                        <button onclick="window.dispatch('closeActivationModal')" class="text-gray-400 hover:text-gray-600 transition-colors">${Icon('x', '', 20)}</button>
                    </div>
                    
                    <div class="p-6 space-y-5">
                        <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800">
                            <div class="flex-shrink-0 mt-0.5">
                                ${Icon('info', '', 18)}
                            </div>
                            <div class="text-sm">
                                <p class="font-bold mb-1">文件任务功能需激活</p>
                                <p class="text-xs text-blue-700 opacity-90 leading-relaxed">文件上传下载功能有可能产生费用，需要独立激活使用。如有需要联系管理员（wechat:kururugi111）获取 12 位激活码。</p>
                            </div>
                        </div>
                        
                        <div>
                            <label for="activation-code-input" class="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">激活码</label>
                            <input id="activation-code-input" type="text" placeholder="例如: ABCD EFGH IJKL" 
                                class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono text-center tracking-widest text-lg font-bold uppercase"
                                onkeyup="if(event.key === 'Enter') window.dispatch('submitActivationCode')"
                            />
                        </div>
                    </div>
                    
                    <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
                        <button onclick="window.dispatch('closeActivationModal')" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors">取消</button>
                        <button onclick="window.dispatch('submitActivationCode')" class="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center">
                            ${Icon('zap', 'mr-1.5', 16)} 立即激活
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    return '';
}
