// --- Render Functions ---

const TODO_PRIORITY_META = {
    high: { rank: 3, label: '高优先级', stroke: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
    medium: { rank: 2, label: '中优先级', stroke: '#f59e0b', bg: '#fffbeb', text: '#d97706' },
    low: { rank: 1, label: '低优先级', stroke: '#3b82f6', bg: '#eff6ff', text: '#2563eb' },
    none: { rank: 0, label: '无优先级', stroke: '#d1d5db', bg: '#ffffff', text: '#9ca3af' }
};

function getTodoPriorityMeta(priority) {
    return TODO_PRIORITY_META[priority] || TODO_PRIORITY_META.none;
}

function getTodoSortTime(todo) {
    return todo.completed ? (todo.completedAt || todo.createdAt || 0) : (todo.createdAt || 0);
}

function sortTodosByPriorityAndTime(list) {
    return [...(list || [])].sort((a, b) => {
        const prioDiff = getTodoPriorityMeta(b.priority).rank - getTodoPriorityMeta(a.priority).rank;
        if (prioDiff !== 0) return prioDiff;
        return getTodoSortTime(b) - getTodoSortTime(a);
    });
}

function groupTodosByPriority(list) {
    const groups = [];
    (list || []).forEach(todo => {
        const priority = getTodoPriorityValue(todo);
        const prev = groups[groups.length - 1];
        if (prev && prev.priority === priority) {
            prev.items.push(todo);
        } else {
            groups.push({ priority, items: [todo] });
        }
    });
    return groups;
}

function getTodoPriorityValue(todo) {
    return Object.prototype.hasOwnProperty.call(TODO_PRIORITY_META, todo?.priority) ? todo.priority : 'none';
}

function renderTodoImages(images) {
    if (!images?.length) return '';
    return `
        <div class="flex flex-wrap gap-2 mt-2">
            ${images.map((img, idx) => `<div class="todo-attach-pill todo-attach-pill-readonly"><img src="${img}" class="todo-attach-pill-thumb" onclick="window.dispatch('openImagePreview', '${String(img).replace(/'/g, "\\'")}')" /><span class="todo-attach-pill-name">图片${idx + 1}</span></div>`).join('')}
        </div>
    `;
}

function renderPriorityMenu(priority, onclickExpr) {
    const priorityOptions = ['high', 'medium', 'low', 'none'];
    return `
        <div class="todo-priority-menu">
            ${priorityOptions.map(option => {
        const meta = getTodoPriorityMeta(option);
        const selected = priority === option;
        return `
                    <button
                        onmousedown="event.preventDefault()"
                        onclick="${onclickExpr(option)}"
                        class="todo-priority-option ${selected ? 'todo-priority-option-selected' : ''}"
                        style="--priority-stroke:${meta.stroke}; --priority-bg:${meta.bg}; --priority-text:${meta.text};">
                        <span class="todo-priority-option-flag">${Icon('flag', '', 16, option === 'none' ? 'none' : meta.stroke, meta.stroke)}</span>
                        <span class="todo-priority-option-label">${meta.label}</span>
                        ${selected ? `<span class="todo-priority-option-check">${Icon('check', '', 16)}</span>` : '<span class="w-4 h-4"></span>'}
                    </button>
                `;
    }).join('')}
        </div>
    `;
}

function renderTodoActions(taskId, todo) {
    const priority = getTodoPriorityValue(todo);
    const priorityMeta = getTodoPriorityMeta(priority);
    const priorityTarget = state.ui.todoPriorityMenuTarget || {};
    const isMobile = !!state.ui.isMobile;
    const priorityMenuOpen = state.ui.todoPriorityMenuOpen
        && priorityTarget.mode === 'todo'
        && priorityTarget.taskId === taskId
        && priorityTarget.todoId === todo.id;
    const priorityButtonClass = priority === 'none'
        ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        : '';
    return `
        <div class="flex items-center ${isMobile ? 'opacity-100 mt-1.5 justify-end' : `${priorityMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ml-2`} transition-opacity gap-1">
            <div class="relative">
                <button onclick="event.stopPropagation(); window.dispatch('toggleTodoPriorityMenu', 'todo', '${taskId}', '${todo.id}')" 
                    class="p-1.5 rounded transition-colors ${priorityButtonClass}" title="${priorityMeta.label}"
                    style="${priority === 'none' ? '' : `color:${priorityMeta.stroke}; background:${priorityMeta.bg};`}">
                    ${Icon('flag', '', 14, priority === 'none' ? 'none' : priorityMeta.stroke, priorityMeta.stroke)}
                </button>
                ${priorityMenuOpen ? renderPriorityMenu(priority, (option) => `window.dispatch('setTodoEditorPriority', '${option}', '${taskId}', '${todo.id}')`) : ''}
            </div>
            <button onclick="event.stopPropagation(); window.dispatch('copyTodoForAi', '${taskId}', '${todo.id}')" 
                class="p-1.5 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded transition-colors" title="复制到聊天框">
                ${Icon('copy', '', 14)}
            </button>
            <button onclick="event.stopPropagation(); window.dispatch('setEditingTodo', '${taskId}', '${todo.id}')" 
                class="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-500 rounded transition-colors" title="编辑">
                ${Icon('edit-2', '', 14)}
            </button>
            <button onclick="event.stopPropagation(); window.dispatch('deleteTodo', '${taskId}', '${todo.id}')" 
                class="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors" title="删除">
                ${Icon('trash-2', '', 14)}
            </button>
        </div>
    `;
}

function renderTodoItem(taskId, todo, opts = {}) {
    const { completed = false, grouped = false, animated = false, editing = false } = opts;
    const isMobile = !!state.ui.isMobile;
    const wrapperClass = grouped
        ? `todo-priority-item group ${isMobile ? 'todo-priority-item-mobile' : ''} ${completed ? 'todo-priority-item-completed' : ''} ${editing ? 'ring-2 ring-blue-100 bg-blue-50 rounded-xl' : ''}`
        : `flex items-start group ${isMobile ? 'px-4 py-1.5' : 'p-3'} rounded-lg transition-colors relative ${completed ? 'opacity-60 hover:opacity-100' : 'hover:bg-gray-50 border border-transparent hover:border-gray-100'} ${editing ? 'ring-2 ring-blue-100 bg-blue-50' : ''}`;
    const iconHtml = completed
        ? `<div onclick="window.dispatch('toggleTodo', '${taskId}', '${todo.id}')" class="mt-0.5 mr-3 text-green-500 cursor-pointer">${Icon('check-circle-2', '', 20)}</div>`
        : `<div onclick="window.dispatch('toggleTodo', '${taskId}', '${todo.id}')" class="mt-0.5 mr-3 text-gray-300 group-hover:text-indigo-500 transition-colors cursor-pointer">${Icon('circle', '', 20)}</div>`;
    const textClass = completed ? 'text-sm text-gray-400 line-through' : 'text-sm text-gray-700 font-medium';
    return `
        <div id="todo-item-${taskId}-${todo.id}" class="${wrapperClass}">
            ${iconHtml}
            <div class="flex-1 min-w-0 pt-0.5">
                <div class="${textClass} break-words whitespace-normal leading-relaxed ${animated ? 'todo-text-enter' : ''}">${todo.text}</div>
                ${renderTodoImages(todo.images)}
                ${isMobile ? renderTodoActions(taskId, todo) : ''}
            </div>
            ${isMobile ? '' : renderTodoActions(taskId, todo)}
        </div>
    `;
}

function renderTodoGroups(taskId, todos, opts = {}) {
    const { completed = false, todoAnimKeys = {}, editingTodoId = null } = opts;
    return groupTodosByPriority(todos).map(group => {
        if (group.priority === 'none') {
            return group.items.map(todo => renderTodoItem(taskId, todo, {
                completed,
                grouped: false,
                animated: !!todoAnimKeys[`${taskId}:${todo.id}`],
                editing: editingTodoId === todo.id
            })).join('');
        }
        return `
            <div class="todo-priority-group todo-priority-group-${group.priority} ${completed ? 'todo-priority-group-completed' : ''}">
                ${group.items.map(todo => renderTodoItem(taskId, todo, {
                    completed,
                    grouped: true,
                    animated: !!todoAnimKeys[`${taskId}:${todo.id}`],
                    editing: editingTodoId === todo.id
                })).join('')}
            </div>
        `;
    }).join('');
}

function RenderSidebar(options = {}) {
    const { mobile = false } = options;
    const { projects, expandedProjects, activeView } = state;
    const sidebarWidth = Math.max(240, Math.min(460, state.ui.sidebarWidth || 280));
    const resizeHandle = mobile ? '' : `<div onmousedown="window.dispatch('startSidebarResize', event)" class="absolute top-0 -right-1 w-2 h-full cursor-col-resize z-20" title="拖拽调整宽度"></div>`;
    const sidebarShellClass = mobile
        ? 'relative bg-[#f3f4f6] flex flex-col h-full w-full text-gray-700'
        : 'relative bg-[#f3f4f6] flex flex-col h-full text-gray-700 flex-shrink-0 border-r border-gray-200';
    const sidebarShellStyle = mobile ? '' : `style="width:${sidebarWidth}px;"`;

    // 个人项目排序和置顶
    const uid = state.currentUser?.uid;
    const pinnedProjects = state.currentUser?.pinnedProjects || [];
    const projectOrder = state.currentUser?.projectOrder || [];

    // 过滤并排序项目：置顶的在前，然后按个人排序，最后按创建时间
    const myProjects = projects.filter(p => 
        (p.memberIds || []).includes(uid)
    );

    myProjects.sort((a, b) => {
        // 置顶的项目在最前
        const aPin = pinnedProjects.includes(a.id);
        const bPin = pinnedProjects.includes(b.id);
        if (aPin && !bPin) return -1;
        if (!aPin && bPin) return 1;
        
        // 如果都置顶或都未置顶，按个人排序
        const aOrder = projectOrder.indexOf(a.id);
        const bOrder = projectOrder.indexOf(b.id);
        if (aOrder !== -1 && bOrder !== -1) return aOrder - bOrder;
        if (aOrder !== -1) return -1;
        if (bOrder !== -1) return 1;
        
        // 都没有排序记录，按创建时间
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    let projectsHtml = myProjects.map(p => {
        const isActive = (activeView.type === 'project_dashboard' && activeView.projectId === p.id) || (activeView.type === 'new_task' && activeView.projectId === p.id);
        const isExpanded = expandedProjects[p.id];
        const pTasks = state.tasks.filter(t => t.projectId === p.id);
        const memberIds = (p.memberIds || p.members || []);
        const occupiedUids = new Set(
            pTasks
                .filter(t => t.isLocked && t.lockedBy)
                .map(t => t.lockedBy)
        );
        const isMeOccupied = occupiedUids.has(uid);
        const members = state.users
            .filter(u => memberIds.includes(u.uid))
            .sort((a, b) => {
                const aIsMe = a.uid === uid;
                const bIsMe = b.uid === uid;
                const aOccupied = occupiedUids.has(a.uid);
                const bOccupied = occupiedUids.has(b.uid);

                // 自己占用时，自己永远排最前。
                if (isMeOccupied) {
                    if (aIsMe && !bIsMe) return -1;
                    if (!aIsMe && bIsMe) return 1;
                }

                // 其次所有占用中的成员优先显示。
                if (aOccupied && !bOccupied) return -1;
                if (!aOccupied && bOccupied) return 1;

                // 最后按项目成员原始顺序稳定展示。
                return memberIds.indexOf(a.uid) - memberIds.indexOf(b.uid);
            });
        const expanded = !!state.ui.memberListExpandedByProjectId[p.id];
        const collapsedCount = 3;
        const displayMembers = expanded ? members : members.slice(0, collapsedCount);
        const hiddenCount = Math.max(0, members.length - collapsedCount);
        const isPinned = pinnedProjects.includes(p.id);

        let tasksHtml = '';
        if (isExpanded) {
            // 任务排序：置顶的在前，按 order 降序排序，完成的任务在最后
            const sortedTasks = [...pTasks].sort((a, b) => {
                // 完成的任务始终在后面
                if (a.completed && !b.completed) return 1;
                if (!a.completed && b.completed) return -1;
                // 置顶的任务在前面
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                // 未完成的任务按 order 降序（新任务在上）
                return (b.order || 0) - (a.order || 0);
            });
            tasksHtml = `<div class="ml-4 pl-2 my-1 border-l border-gray-300 space-y-1" 
                              data-project-id="${p.id}"
                              ondragover="window.dispatch('taskContainerDragOver', event, '${p.id}')"
                              ondrop="window.dispatch('taskContainerDrop', event, '${p.id}')">
                ${
                    sortedTasks.length === 0
                        ? `<button onclick="event.stopPropagation(); window.dispatch('initNewTask', '${p.id}')" class="w-full flex items-center px-3 py-2 text-xs text-gray-400 hover:bg-gray-200 rounded-md transition-colors">
                                ${Icon('plus', 'mr-2', 12)} 新建任务
                           </button>`
                        : ''
                }
                ${sortedTasks.map((t, index) => {
                    const isTaskActive = activeView.type === 'task_detail' && activeView.taskId === t.id;
                    const locker = t.isLocked && t.lockedBy ? state.users.find(u => u.uid === t.lockedBy) : null;
                    const isMe = locker && locker.uid === state.currentUser.uid;
                    let activeColor = '#2563eb', activeFill = isTaskActive ? '#DBEAFE' : 'none', activeTextClass = isTaskActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-[#e5e7eb]';

                    if (locker) {
                        if (isMe) { activeColor = isTaskActive ? '#ffffff' : COLOR_ME; activeFill = '#d1fae5'; activeTextClass = isTaskActive ? 'bg-blue-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'; }
                        else { activeColor = isTaskActive ? '#ffffff' : COLOR_OTHER; activeFill = '#f3e8ff'; activeTextClass = isTaskActive ? 'bg-blue-600 text-white' : 'text-purple-700 hover:bg-purple-50'; }
                    } else if (isTaskActive) activeColor = '#ffffff';
                    else activeColor = '#9ca3af';

                    const isTextTask = t.kind === 'text';
                    let versionLabel;
                    if (isTextTask) {
                        const progressActs = (t.activities || []).filter(a => a.type === 'progress');
                        const maxVer = progressActs.reduce((m, a) => Math.max(m, a.version || 0), 0);
                        versionLabel = maxVer > 0 ? `v${maxVer}` : '未开始';
                    } else {
                        versionLabel = t.file && t.file.version > 0
                            ? `v${t.file.version}`
                            : (t.github?.enabled ? '未记录' : '未上传');
                    }

                    const durationStr = locker ? getDuration(t.lockedAt) : '00:00';
                    return `
                        <div draggable="${!t.completed}" 
                             data-task-id="${t.id}" 
                             data-task-order="${t.order || 0}"
                             ondragstart="window.dispatch('taskDragStart', event, '${t.id}')"
                             ondragover="window.dispatch('taskDragOver', event)"
                             ondrop="window.dispatch('taskDrop', event, '${p.id}', '${t.id}')"
                             ondragend="window.dispatch('taskDragEnd', event)"
                             onclick="if(!event.defaultPrevented) window.dispatch('setView', {type:'task_detail', projectId:'${p.id}', taskId:'${t.id}'})" 
                             oncontextmenu="window.dispatch('openTaskContextMenu', event, '${p.id}', '${t.id}')"
                             class="flex items-center px-2.5 py-1 cursor-pointer text-sm rounded-md mr-2 relative group transition-all ${activeTextClass} ${t.pinned ? 'ring-1 ring-gray-300' : ''}"
                             style="cursor: ${t.completed ? 'pointer' : 'grab'}; transition: transform 0.2s ease;">
                            <span class="drag-handle mr-1 opacity-0 group-hover:opacity-100 transition-opacity ${isTaskActive ? 'text-white' : 'text-gray-400'}" style="cursor: grab; user-select: none;">⋮⋮</span>
                            ${Icon(isTextTask ? 'file-text' : 'folder', 'mr-2 flex-shrink-0 transition-colors', 14, activeFill, activeColor)}
                            <div class="flex items-center min-w-0 flex-1 ${locker ? 'font-medium' : ''} ${t.completed ? 'line-through opacity-60' : ''}">
                                <span class="truncate min-w-0">${t.name}</span>
                                <span class="text-[11px] ${isTaskActive ? 'text-white opacity-90' : 'text-gray-400'} ml-1 shrink-0">(${versionLabel})</span>
                            </div>
                            ${locker ? `<div class="flex items-center ${isTaskActive ? 'bg-white/20 border-white/30' : 'bg-white'} rounded-full pl-2 pr-1 py-0.5 ml-2 border" style="border-color:${isTaskActive ? 'rgba(255,255,255,0.3)' : (isMe ? '#a7f3d0' : '#e9d5ff')}" title="Locked by ${locker.name}"><span class="text-[10px] font-mono mr-1.5 tabular-nums timer-display" style="color:${activeColor}" data-ts="${t.lockedAt}">${durationStr}</span>${AvatarEmoji(locker.emoji, 'w-4 h-4 rounded-full border border-white', 'text-[12px]')}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>`;
        }

        return `
            <div class="mb-1" 
                 draggable="true"
                 data-project-id="${p.id}"
                 ondragstart="window.dispatch('projectDragStart', event, '${p.id}')"
                 ondragover="window.dispatch('projectDragOver', event)"
                 ondrop="window.dispatch('projectDrop', event, '${p.id}')"
                 ondragend="window.dispatch('projectDragEnd', event)"
                 style="transition: transform 0.2s ease;">
                <div onclick="window.dispatch('toggleProject', '${p.id}'); window.dispatch('setView', {type:'project_dashboard', projectId:'${p.id}'})"
                     oncontextmenu="window.dispatch('openProjectContextMenu', event, '${p.id}')"
                     class="flex items-center px-3 py-2 cursor-move group transition-all mx-2 rounded-md border
                     ${isActive ? `bg-white text-blue-600 shadow-sm border-gray-100 ${isPinned ? 'ring-1 ring-gray-300' : ''}` : `border-transparent hover:bg-[#e5e7eb] ${isPinned ? 'ring-1 ring-gray-300' : ''}`}">
                    <button onclick="event.stopPropagation(); window.dispatch('toggleProject', '${p.id}')" class="p-1 mr-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                        ${isExpanded ? Icon('chevron-down', '', 14) : Icon('chevron-right', '', 14)}
                    </button>
                    ${Icon('hash', `mr-2 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`, 16)}
                    <div class="flex items-center min-w-0 flex-1 text-sm font-medium">
                        <span class="truncate min-w-0">${p.name}</span>
                        <span class="text-xs opacity-50 font-normal shrink-0 ml-1">${p.completed ? '（已完成✅）' : `(${pTasks.filter(t => t.completed).length}/${pTasks.length})`}</span>
                    </div>
                    
                    <div class="flex -space-x-1.5 ml-2 cursor-pointer hover:opacity-80" onclick="event.stopPropagation(); window.dispatch('openMemberModal', '${p.id}')">
                        ${displayMembers.map(m => {
                            const occupied = occupiedUids.has(m.uid);
                            const isMe = m.uid === uid;
                            const borderClass = occupied
                                ? (isMe ? 'border-emerald-500' : 'border-purple-600')
                                : 'border-white';
                            return AvatarEmoji(m.emoji, `w-5 h-5 rounded-full border ${borderClass} bg-gray-200`, 'text-[12px]');
                        }).join('')}
                        ${(!expanded && hiddenCount > 0) ? `<div class="w-5 h-5 rounded-full border border-white bg-gray-200 text-[8px] flex items-center justify-center text-gray-600 font-bold">+${hiddenCount}</div>` : ''}
                    </div>
                    
                    <button onclick="event.stopPropagation(); window.dispatch('initNewTask', '${p.id}')" class="ml-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-opacity" title="新建任务">
                        ${Icon('plus', '', 14)}
                    </button>

                </div>
                ${tasksHtml}
            </div>
        `;
    }).join('');

    const u = state.currentUser;
    if (state.authStatus === 'loading') {
        // 加载期间占位，避免先闪出“未登录”界面
        return `
            <div class="${mobile ? 'relative bg-[#f3f4f6] flex flex-col h-full w-full' : 'relative bg-[#f3f4f6] flex flex-col h-full flex-shrink-0 border-r border-gray-200'}" ${mobile ? '' : `style="width:${sidebarWidth}px;"`} id="sidebar-scroll" data-scroll>
                ${resizeHandle}
            </div>
        `;
    }
    if (state.authStatus !== 'authenticated' || !u) {
        return `
            <div class="${mobile ? 'relative bg-[#f3f4f6] flex flex-col h-full w-full text-gray-700' : 'relative bg-[#f3f4f6] flex flex-col h-full text-gray-700 flex-shrink-0 border-r border-gray-200'}" ${mobile ? '' : `style="width:${sidebarWidth}px;"`} id="sidebar-scroll" data-scroll>
                <div class="h-14 flex items-center px-4 border-b border-gray-200 font-bold text-gray-800 bg-[#f3f4f6]">
                    <span class="truncate text-lg tracking-tight">CollabSync</span>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center p-6">
                    <div class="bg-white w-full rounded-2xl border border-gray-200 shadow-sm p-6">
                        <h2 class="text-sm font-bold text-gray-800 mb-2">请先登录</h2>
                        <p class="text-xs text-gray-500 mb-4">登录后才能查看项目并进行操作</p>
                        <button onclick="window.dispatch('login')" class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors">使用 Google 登录</button>
                    </div>
                </div>
                <div class="border-t border-gray-200 bg-[#f3f4f6] p-4">
                    <div class="text-[10px] text-gray-400">未登录</div>
                </div>
                ${resizeHandle}
            </div>
        `;
    }
    return `
        <div class="${sidebarShellClass}" ${sidebarShellStyle} id="sidebar-scroll" data-scroll>
            <div class="h-14 flex items-center px-4 border-b border-gray-200 font-bold text-gray-800 bg-[#f3f4f6]">
                <span class="truncate text-lg tracking-tight">CollabSync</span>
            </div>
            <div class="flex-1 overflow-y-auto py-4 custom-scrollbar">
                <div class="flex items-center justify-between px-4 group mb-2">
                    <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Projects</span>
                    <button onclick="window.dispatch('initNewProject')" class="ml-auto inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm" title="新建项目">${Icon('plus', '', 14)} 新建项目</button>
                </div>
                <div class="space-y-1" 
                     id="projects-container"
                     ondragover="window.dispatch('projectContainerDragOver', event)"
                     ondrop="window.dispatch('projectContainerDrop', event)">${projectsHtml}</div>
            </div>
            <div class="relative border-t border-gray-200 bg-[#f3f4f6]">
                <div class="h-16 flex items-center px-4">
                    <div class="relative mr-3">
                        <div class="cursor-pointer" onclick="window.dispatch('toggleMyWorkPopover')">${AvatarEmoji(u.emoji, 'w-9 h-9 rounded-md border border-gray-300 bg-white', 'text-xl')}</div>
                        <button onclick="event.stopPropagation(); window.dispatch('randomizeMyEmoji')" class="absolute top-0 right-0 text-sm flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer" style="transform: translate(40%, -40%);">🎲</button>
                    </div>
                    <div class="flex flex-col overflow-hidden flex-1">
                        <span class="text-sm font-bold truncate text-gray-800">${u.name}</span>
                        <span class="text-xs text-gray-500 opacity-80 truncate">在线</span>
                    </div>
                    <button onclick="window.dispatch('openProfileModal')" class="ml-2 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700">
                        ${Icon('settings', '', 16)}
                    </button>
                </div>
            </div>
            ${resizeHandle}
        </div>
    `;
}

function RenderMobileMainShell() {
    return `
        <div class="relative w-full h-full">
            ${RenderMain()}
            ${state.activeView?.type !== 'welcome' ? `
                <button onclick="window.dispatch('goMobileSidebar')"
                    class="fixed top-4 left-4 z-[85] inline-flex items-center gap-1 px-1 py-1 text-sm font-semibold text-gray-600 hover:text-gray-900 active:scale-95 transition-all">
                    ${Icon('chevron-left', '', 16)} 项目列表
                </button>
            ` : ''}
        </div>
    `;
}

function RenderMain() {
    const { activeView, draft } = state;

    if (state.authStatus === 'loading') {
        // Auth 初始化中，主区域显示空白即可，避免闪动
        return `<div class="flex-1 bg-[#f3f4f6]"></div>`;
    }

    // WELCOME
    if (activeView.type === 'welcome') {
        return `
            <div class="flex-1 flex flex-col items-center justify-center p-8 bg-[#f3f4f6]">
                <div class="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 max-w-lg text-center">
                    <img src="https://cdn-icons-png.flaticon.com/512/3655/3655584.png" class="w-32 h-32 mx-auto mb-6 opacity-90">
                    <h1 class="text-3xl font-extrabold text-gray-800 mb-4">欢迎来到 CollabSync</h1>
                    <p class="text-gray-600 mb-8 leading-relaxed">选择左侧的项目开始协作。</p>
                </div>
            </div>
        `;
    }

    // NEW PROJECT
    if (activeView.type === 'new_project') {
        return `
            <div class="flex-1 flex flex-col items-center justify-center bg-[#f3f4f6] overflow-y-auto p-4" id="main-scroll">
                <div class="bg-white w-full max-w-2xl rounded-2xl shadow-lg border border-gray-200 overflow-hidden fade-in">
                    <div class="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">新建项目</h2>
                            <p class="text-sm text-gray-500 mt-1">创建一个新的协作空间</p>
                        </div>
                        <button onclick="window.dispatch('cancelCreation')" class="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors">${Icon('x', '', 20)}</button>
                    </div>
                    
                    <div class="p-8 space-y-6">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">项目名称</label>
                            <input type="text" value="${draft.name}" oninput="window.dispatch('updateDraft', 'name', this.value)"
                                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow" placeholder="例如: 2024 年度营销计划">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">描述 (可选)</label>
                            <textarea rows="3" oninput="window.dispatch('updateDraft', 'desc', this.value)"
                                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow" placeholder="简单描述项目目标...">${draft.desc}</textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">添加成员</label>
                            <div class="flex items-center gap-2 mb-3">
                                <div class="relative flex-1">
                                    ${Icon('search', 'absolute left-3 top-3 text-gray-400', 18)}
                                    <input type="text" value="${draft.memberSearchInput}" 
                                        oninput="window.dispatch('updateDraft', 'memberSearchInput', this.value)"
                                        onkeydown="if(event.key==='Enter') window.dispatch('draftSearchMember')"
                                        class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="输入用户邮箱搜索...">
                                </div>
                                <button onclick="window.dispatch('draftSearchMember')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">搜索</button>
                            </div>
                            ${state.ui.draftSearchResult ? (state.ui.draftSearchResult.found ? `
                                <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                                    <div class="flex items-center">
                                        ${AvatarEmoji(state.ui.draftSearchResult.user.emoji, 'w-8 h-8 rounded-full mr-3', 'text-xl')}
                                        <div>
                                            <p class="text-sm font-semibold text-gray-800">${state.ui.draftSearchResult.user.name}</p>
                                            <p class="text-xs text-gray-500">${state.ui.draftSearchResult.user.email}</p>
                                        </div>
                                    </div>
                                    <button onclick="window.dispatch('draftAddMember')" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">添加</button>
                                </div>
                            ` : `
                                <div class="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                    ${Icon('alert-circle', 'inline mr-2', 16)} 未找到此用户，请检查邮箱是否正确
                                </div>
                            `) : ''}
                            <div class="flex flex-wrap gap-2">
                                <div class="flex items-center bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-100 pr-4">
                                    ${AvatarEmoji(state.currentUser.emoji, 'w-5 h-5 rounded-full mr-2 bg-white', 'text-[12px]')}
                                    <span class="text-sm font-medium">我 (Owner)</span>
                                </div>
                                ${draft.members.map(m => `
                                    <div class="flex items-center bg-white text-gray-700 px-2 py-1.5 rounded-full border border-gray-200 shadow-sm pr-2">
                                        ${AvatarEmoji(m.emoji, 'w-5 h-5 rounded-full mr-2 bg-white', 'text-[12px]')}
                                        <span class="text-sm font-medium mr-2">${m.name}</span>
                                        <button onclick="window.dispatch('draftRemoveMember', '${m.uid}')" class="text-gray-400 hover:text-red-500 p-0.5 rounded-full hover:bg-red-50 transition-colors">${Icon('x', '', 14)}</button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="pt-4 border-t border-gray-100 flex justify-end gap-3">
                            <button onclick="window.dispatch('cancelCreation')" class="px-6 py-2.5 rounded-xl text-gray-500 font-medium hover:bg-gray-100 transition-colors">取消</button>
                            <button onclick="window.dispatch('submitNewProject')" class="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md transform active:scale-95 transition-all">创建项目</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // NEW TASK
    if (activeView.type === 'new_task') {
        const project = state.projects.find(p => p.id === activeView.projectId);
        const draft = state.draft;
        return `
            <div class="flex-1 flex flex-col bg-[#f3f4f6] overflow-hidden" id="main-scroll">
                <div class="flex-1 overflow-y-auto p-6">
                    <div class="bg-white w-full max-w-2xl mx-auto rounded-2xl shadow-lg border border-gray-200 overflow-hidden fade-in">
                        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div class="flex items-center gap-3">
                                <h2 class="text-lg font-bold text-gray-800">新建任务</h2>
                                <span class="text-xs text-gray-500">·</span>
                                <p class="text-xs text-gray-500">所属: <span class="font-medium text-gray-800">${project?.name}</span></p>
                            </div>
                            <button onclick="window.dispatch('cancelCreation')" class="p-1.5 hover:bg-gray-200 rounded-full text-gray-400 transition-colors">${Icon('x', '', 18)}</button>
                        </div>
                        
                        <div class="p-6 space-y-5">
                            <div class="flex items-end gap-4">
                                <div class="flex-1">
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">任务名称</label>
                                    <input type="text" value="${draft.name}" oninput="window.dispatch('updateDraft', 'name', this.value)"
                                        class="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow text-sm" placeholder="例如: 首页 UI 设计">
                                </div>
                                <div class="flex-shrink-0">
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">任务类型</label>
                                    <div class="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 text-xs font-medium">
                                        <button onclick="window.dispatch('updateDraft', 'kind', 'text')"
                                            class="px-3 py-1.5 rounded-lg transition-all ${draft.kind === 'text' || !draft.kind ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-800'}">
                                            无文件任务
                                        </button>
                                        <button onclick="window.dispatch('updateDraft', 'kind', 'file')"
                                            class="px-3 py-1.5 rounded-lg transition-all ${draft.kind === 'file' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-800'}">
                                            有文件任务
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">任务详情</label>
                                <textarea rows="3" oninput="window.dispatch('updateDraft', 'desc', this.value)"
                                    class="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow text-sm resize-none" placeholder="详细描述任务要求...">${draft.desc}</textarea>
                            </div>
                            ${draft.kind === 'file' || !draft.kind ? `
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">初始文件 (可选)</label>
                                <div class="relative group">
                                    <input type="file" id="draft-file" class="hidden" onchange="window.dispatch('handleDraftFileChange', this.files[0])">
                                    <label for="draft-file" class="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-colors">
                                        <div class="flex flex-col items-center justify-center py-4">
                                            ${draft.file
                                                ? `<div class="text-blue-600 mb-1">${Icon('file-check', '', 28)}</div><p class="text-xs text-gray-700 font-medium">${draft.file.name}</p><p class="text-[11px] text-gray-500">点击更换</p>`
                                                : `<div class="text-gray-400 mb-1 group-hover:text-blue-500 transition-colors">${Icon('upload-cloud', '', 28)}</div><p class="text-xs text-gray-500"><span class="font-semibold">点击上传</span> 或拖拽文件</p>`
                                            }
                                        </div>
                                    </label>
                                    <p class="mt-1.5 text-[11px] text-gray-400 text-right">单个文件不超过 3MB</p>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">文件备注 (可选)</label>
                                <textarea rows="2" oninput="window.dispatch('updateDraft', 'fileNote', this.value)"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow text-sm resize-none"
                                    placeholder="简单说明这个初始文件的用途，方便团队成员理解">${draft.fileNote || ''}</textarea>
                            </div>
                            ` : `
                            <div class="border border-dashed border-gray-300 rounded-xl p-3 bg-gray-50 text-xs text-gray-500">
                                这是一个<strong class="font-semibold text-gray-700">无文件任务</strong>，不需要上传/下载文件。可以直接在待办区域记录内容，或通过"完成编辑"添加进度备注。
                            </div>
                            `}
                            <div class="pt-3 border-t border-gray-100 flex justify-end gap-3">
                                <button onclick="window.dispatch('cancelCreation')" class="px-5 py-2 rounded-xl text-sm text-gray-500 font-medium hover:bg-gray-100 transition-colors">取消</button>
                                <button onclick="window.dispatch('submitNewTask')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md transform active:scale-95 transition-all">创建任务</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // PROJECT DASHBOARD
    if (activeView.type === 'project_dashboard') {
        const p = state.projects.find(proj => proj.id === activeView.projectId);
        if (!p) {
            // 项目列表尚未同步完成时显示空白，避免闪烁 Project Not Found
            if (state.projects.length === 0) {
                return `<div class="flex-1 bg-[#f3f4f6]" id="main-scroll" data-scroll></div>`;
            }
            return `<div class="p-8">Project Not Found</div>`;
        }
        const members = state.users.filter(u => (p.memberIds || p.members || []).includes(u.uid));
        const pTasks = state.tasks.filter(t => t.projectId === p.id);
        const isOwner = p.ownerId === state.currentUser.uid;

        return `
            <div class="flex-1 flex flex-col h-full bg-[#f3f4f6] overflow-y-auto" id="main-scroll" data-scroll>
                <div class="bg-white border-b px-8 py-10 relative">
                    <button onclick="window.dispatch('openConfirmModal', '${isOwner ? 'delete_project' : 'leave_project'}', '${p.id}', '${isOwner ? '删除项目' : '退出项目'}', '${isOwner ? '确定要删除这个项目吗？删除后，项目下的所有任务也会被删除，所有成员都将退出。此操作不可撤销。' : '确定要退出这个项目吗？你将不再是该项目的成员。'}')" 
                        class="absolute top-8 right-8 flex items-center px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
                        ${isOwner ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}">
                        ${isOwner ? Icon('trash-2', 'mr-2', 16) : Icon('log-out', 'mr-2', 16)}
                        ${isOwner ? "删除项目" : "退出项目"}
                    </button>
                    <div class="flex items-center gap-3 mb-2">
                        <h1 class="text-3xl font-bold text-gray-900"># ${p.name}${p.completed ? ' <span class="text-base text-gray-500 font-semibold">（已完成✅）</span>' : ''}</h1>
                        <button onclick="window.dispatch('openEditProjectModal', '${p.id}')" class="px-2 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center gap-1">
                            ${Icon('edit-3', '', 14)} 编辑项目
                        </button>
                    </div>
                    <p class="text-gray-600 mb-6">${p.description}</p>
                    <div class="flex items-center space-x-2 mb-6">
                        <div class="flex -space-x-2 overflow-hidden cursor-pointer" onclick="window.dispatch('openMemberModal', '${p.id}')">
                            ${members.map(m => `<div onclick="event.stopPropagation(); window.dispatch('openMemberModal', '${p.id}')">${AvatarEmoji(m.emoji, 'inline-block h-8 w-8 rounded-full ring-2 ring-white bg-white', 'text-xl')}</div>`).join('')}
                            <button onclick="event.stopPropagation(); window.dispatch('openMemberModal', '${p.id}')" class="h-8 w-8 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center text-gray-500 text-xs font-medium hover:bg-gray-200">+</button>
                        </div>
                        <span class="text-sm text-gray-500 ml-2">${members.length} 位成员</span>
                    </div>
                </div>
                <div class="p-8">
                    <h2 class="text-lg font-bold text-gray-800 mb-4">任务看板</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        ${pTasks.map(t => {
            const locker = t.isLocked ? state.users.find(u => u.uid === t.lockedBy) : null;
            const isMe = locker && locker.uid === state.currentUser.uid;
            const cardColor = isMe ? COLOR_ME : COLOR_OTHER;
            const cardBg = isMe ? 'bg-emerald-50' : 'bg-purple-50';
            const cardBorder = isMe ? 'border-emerald-200' : 'border-purple-200';
            const cardText = isMe ? 'text-emerald-600' : 'text-purple-600';

            return `
                                <div onclick="window.dispatch('setView', {type:'task_detail', projectId:'${p.id}', taskId:'${t.id}'})"
                                     class="relative bg-white p-5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all group ${t.isLocked ? 'ring-2' : 'hover:border-indigo-300'}"
                                     style="${t.isLocked ? `box-shadow: 0 0 0 2px ${cardColor};` : ''}">
                                    <div class="flex justify-between items-start mb-3">
                                        <h3 class="font-semibold text-gray-800 line-clamp-1">${t.name}</h3>
                                        ${t.isLocked ? `
                                            <span class="flex h-2 w-2 relative">
                                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background:${cardColor}"></span>
                                                <span class="relative inline-flex rounded-full h-2 w-2" style="background:${cardColor}"></span>
                                            </span>
                                        ` : ''}
                                    </div>
                                    <p class="text-sm text-gray-500 mb-4 line-clamp-2 h-10">${t.description}</p>
                                    <div class="flex items-center justify-between mt-auto">
                                        <div class="text-xs text-gray-400">${t.todos.filter(x => x.completed).length}/${t.todos.length} 待办</div>
                                        ${t.isLocked && locker ? `
                                            <div onclick="event.stopPropagation(); window.dispatch('openMemberModal', '${p.id}')" class="flex items-center pl-2 py-1 rounded-full text-xs font-medium border ${cardBg} ${cardBorder} cursor-pointer hover:opacity-80">
                                                <span class="mr-2 ${cardText}">Working</span>
                                                ${AvatarEmoji(locker.emoji, 'w-5 h-5 rounded-full bg-white', 'text-[12px]')}
                                            </div>
                                        ` : `<span class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">空闲</span>`}
                                    </div>
                                </div>
                            `;
        }).join('')}
                        ${pTasks.length === 0 ? `
                            <button onclick="window.dispatch('initNewTask', '${p.id}')" class="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors bg-white/50 h-full min-h-[200px]">
                                <span class="text-4xl mb-2">+</span><span class="font-medium">新建任务</span>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // TASK DETAIL
    if (activeView.type === 'task_detail') {
        const t = state.tasks.find(tk => tk.id === activeView.taskId);
        if (!t) {
            if (state.tasks.length === 0) {
                return `<div class="flex-1 bg-[#f3f4f6]" id="main-scroll" data-scroll></div>`;
            }
            return `<div class="p-8">Task Not Found</div>`;
        }
        const locker = state.users.find(u => u.uid === t.lockedBy);
        const isMe = t.lockedBy === state.currentUser.uid;
        const statusColor = isMe ? COLOR_ME : COLOR_OTHER;
        const statusBg = isMe ? BG_ME : BG_OTHER;
        const activeTodos = sortTodosByPriorityAndTime(t.todos.filter(x => !x.completed));
        const completedTodos = [...t.todos.filter(x => x.completed)].sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));
        const collapseThresholdMs = 2 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const oldCompletedCandidates = completedTodos.filter(td => {
            const doneAt = td.completedAt || td.createdAt || 0;
            return doneAt > 0 && (now - doneAt) >= collapseThresholdMs;
        });
        const recentCompletedTodos = completedTodos.filter(td => !oldCompletedCandidates.includes(td));
        const totalTodoCount = t.todos.length;
        const shouldAutoCollapseOldCompleted = totalTodoCount > 10;
        let defaultVisibleOldCompletedTodos = [];
        let hiddenOldCompletedTodos = [];
        if (shouldAutoCollapseOldCompleted) {
            // 保底默认至少显示 10 条，优先折叠更早（更旧）的已完成待办。
            const maxHiddenCount = Math.max(0, totalTodoCount - 10);
            const hiddenCount = Math.min(oldCompletedCandidates.length, maxHiddenCount);
            defaultVisibleOldCompletedTodos = oldCompletedCandidates.slice(0, oldCompletedCandidates.length - hiddenCount);
            hiddenOldCompletedTodos = oldCompletedCandidates.slice(oldCompletedCandidates.length - hiddenCount);
        } else {
            defaultVisibleOldCompletedTodos = oldCompletedCandidates;
            hiddenOldCompletedTodos = [];
        }
        const isOldCompletedExpanded = !!state.ui.collapsedCompletedByTaskId?.[t.id];
        const visibleHiddenOldCompletedTodos = isOldCompletedExpanded ? hiddenOldCompletedTodos : [];
        const todoAnimKeys = state.ui.todoAnimKeys || {};
        const mentionPicker = state.ui.mentionPicker || {};
        const mentionCandidates = mentionPicker.visible && mentionPicker.taskId === t.id
            ? mentionPicker.candidateUids
                .map(uid => state.users.find(u => u.uid === uid))
                .filter(Boolean)
            : [];
        const durationStr = t.isLocked ? getDuration(t.lockedAt) : '00:00';
        const editorPriority = getTodoPriorityValue({ priority: state.ui.editorPriority });
        const editorPriorityMeta = getTodoPriorityMeta(editorPriority);
        const priorityTarget = state.ui.todoPriorityMenuTarget || {};
        const editorPriorityMenuOpen = state.ui.todoPriorityMenuOpen
            && priorityTarget.mode === 'editor'
            && priorityTarget.taskId === t.id;
        const isMobile = !!state.ui.isMobile;
        const githubLink = t.github?.enabled ? t.github : null;

        return `
            <div class="flex-1 flex flex-col h-full bg-[#f3f4f6]" id="main-scroll" data-scroll>
                ${state.ui.todoPriorityMenuOpen ? `<div class="fixed inset-0 z-[65]" onclick="window.dispatch('closeTodoPriorityMenu')"></div>` : ''}
                 <div class="${isMobile ? 'px-4 pt-16 pb-4 bg-white border-b shadow-sm' : 'px-6 py-5 border-b flex justify-between items-center bg-white z-10 shadow-sm sticky top-0'}">
                    ${isMobile ? `
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0 flex-1">
                                <h1 class="text-[28px] leading-tight font-bold text-gray-800 break-words">${t.name}</h1>
                                ${(t.kind === 'file') ? `
                                    <button onclick="window.dispatch('openGithubLinkModal', '${t.id}')" class="mt-2 inline-flex items-center gap-1 text-xs font-semibold ${githubLink ? 'text-blue-700' : 'text-gray-500'}">
                                        ${Icon('github', '', 14)} ${githubLink ? '已链接 GitHub' : '链接 GitHub 仓库'}
                                    </button>
                                ` : ''}
                            </div>
                            <div class="shrink-0">
                                ${t.isLocked ? `
                                    <div class="px-3 py-2 rounded-full text-xs font-semibold border ${isMe ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200'}">
                                        ${locker ? `${locker.name} 编辑中` : '编辑中'}
                                    </div>
                                ` : `
                                    <div class="px-3 py-2 rounded-full text-xs font-semibold border border-gray-200 bg-gray-50 text-gray-500">
                                        空闲中
                                    </div>
                                `}
                            </div>
                        </div>
                    ` : `
                        <div>
                            <div class="flex items-center gap-3">
                                <h1 class="text-2xl font-bold flex items-center text-gray-800">
                                    ${t.isLocked ? Icon('lock', 'mr-3 text-gray-400', 20) : ''}
                                    ${t.name}
                                </h1>
                                <button onclick="window.dispatch('openEditTaskModal', '${t.id}')" class="px-2 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center gap-1">
                                    ${Icon('edit-3', '', 14)} 编辑任务
                                </button>
                            </div>
                            <p class="text-gray-500 mt-1 text-sm">${t.description}</p>
                        </div>
                        <div class="flex items-center space-x-4">
                            ${t.isLocked ? `
                                <div class="flex items-center pr-5">
                                    <div class="p-1 cursor-pointer" onclick="window.dispatch('openMemberModal', '${t.projectId}')">
                                        ${AvatarEmoji(locker.emoji, 'w-10 h-10 rounded-full bg-white', 'text-3xl')}
                                    </div>
                                    <div class="ml-2 flex flex-col justify-center">
                                        <span class="text-[10px] text-gray-400 font-medium leading-none mb-1">正在编辑</span>
                                        <span class="font-bold text-sm leading-none" style="color:${statusColor}">${locker.name}</span>
                                    </div>
                                    <div class="h-8 w-px bg-gray-200 mx-4"></div>
                                    <div class="flex flex-col items-end justify-center">
                                         <span class="text-[10px] text-gray-400 font-medium leading-none mb-1">耗时</span>
                                         <span class="text-xl font-mono font-bold text-gray-800 leading-none timer-display" data-ts="${t.lockedAt}">${durationStr}</span>
                                    </div>
                                </div>
                            ` : `
                                <div class="px-4 py-2 rounded-full bg-gray-50 text-gray-500 font-medium text-sm border border-gray-200 flex items-center">
                                    ${t.completed ? `<div class=\"w-2 h-2 rounded-full bg-gray-400 mr-2\"></div>任务已完成` : `<div class=\"w-2 h-2 rounded-full bg-green-500 mr-2\"></div>空闲可编辑`}
                                </div>
                            `}
                        </div>
                    `}
                </div>

                <div class="flex-1 overflow-y-auto ${isMobile ? 'px-0 pb-6 pt-4' : 'p-6'} transition-colors duration-500 todo-list-container" style="background-color:${t.isLocked ? statusBg : '#f3f4f6'}">
                    <div class="${isMobile ? 'w-full space-y-5' : 'max-w-4xl mx-auto space-y-8'}">
                        ${isMobile ? '' : (t.kind === 'text' ? `
                        <!-- Text Task: Compact Header -->
                        <div class="p-4 rounded-2xl border-2 border-dashed transition-all bg-white shadow-sm"
                             style="border-color: ${t.isLocked ? statusColor : '#cbd5e1'}">
                            <div class="flex items-center justify-center gap-3 min-h-[52px]">
                                <button onclick="window.dispatch('openEditHistoryModal', '${t.id}')" 
                                    class="flex items-center px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-all text-sm font-medium">
                                    ${Icon('file-clock', 'mr-2', 16)} 查看进度记录
                                </button>
                                ${!t.isLocked ? `
                                    <button onclick="window.dispatch('startTask', '${t.id}')" 
                                        class="flex items-center px-5 py-2.5 rounded-lg font-medium shadow-sm transition-transform active:scale-95 ${t.completed ? 'bg-gray-300 text-gray-600 cursor-not-allowed hover:bg-gray-300' : 'bg-black text-white hover:bg-gray-800'}" ${t.completed ? 'disabled' : ''}>
                                        ${Icon('play', 'mr-2', 18)} ${t.completed ? '任务已完成' : '开始占用'}
                                    </button>
                                ` : isMe ? `
                                    <button onclick="window.dispatch('openActionModal', '${t.id}')" 
                                        class="flex items-center px-5 py-2.5 rounded-lg font-medium shadow-sm bg-green-600 text-white hover:bg-green-700 transition-transform active:scale-95">
                                        ${Icon('square', 'mr-2', 16)} 结束占用
                                    </button>
                                ` : `
                                    <div class="text-sm text-gray-500 font-medium">
                                        ${locker ? `${locker.name} 正在占用...` : '进行中'}
                                    </div>
                                `}
                            </div>
                        </div>
                        ` : `
                        <!-- File Task: Normal File Upload/Download -->
                        <div class="p-10 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all bg-white shadow-sm relative group"
                             style="border-color: ${t.isLocked ? statusColor : '#cbd5e1'}">
                             
                            <div class="mb-4 text-gray-400 group-hover:scale-105 transition-transform duration-300">
                                ${Icon('file-text', '', 72, 'none', '#94a3b8')}
                            </div>
                            
                            <h3 class="text-xl font-bold text-gray-800 mb-1">
                                ${t.file?.version > 0
            ? (t.file?.source === 'github' ? 'GitHub 仓库快照' : t.file.name)
            : "暂无文件"}
                            </h3>
                            <p class="text-sm text-gray-500 font-medium">
                                ${t.file?.version > 0
            ? (t.file?.source === 'github'
                ? `v${t.file.version} <span class="ml-1 text-[11px] font-semibold text-blue-600">GitHub</span> • ${t.file.branch || 'main'} 分支 • commit ${String(t.file.commitSha || '').slice(0, 7)} • ${new Date(t.file.lastUpdated).toLocaleDateString()}`
                : `v${t.file.version} • ${t.file.size} • ${new Date(t.file.lastUpdated).toLocaleDateString()}`)
            : (githubLink ? '尚未记录 GitHub 版本' : '尚未上传文件')}
                            </p>
                            ${t.file?.note ? `<p class="mt-1 text-xs text-gray-500 max-w-xl text-center">备注：${t.file.note}</p>` : ''}
                            <div class="h-4"></div>
                            
                            <div class="flex gap-2 mb-4">
                                <button onclick="window.dispatch('openHistoryModal', '${t.id}')" 
                                    class="flex items-center px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-all text-sm font-medium">
                                    ${Icon('history', 'mr-2', 16)} 查看历史版本
                                </button>
                                <button onclick="window.dispatch('openEditHistoryModal', '${t.id}')" 
                                    class="flex items-center px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-all text-sm font-medium">
                                    ${Icon('file-clock', 'mr-2', 16)} 查看编辑记录
                                </button>
                                <button onclick="window.dispatch('openGithubLinkModal', '${t.id}')" 
                                    class="flex items-center px-4 py-2 rounded-lg bg-white border ${githubLink ? 'border-blue-200 text-blue-700 hover:bg-blue-50' : 'border-blue-200 text-blue-700 hover:bg-blue-50'} shadow-sm transition-all text-sm font-medium">
                                    ${Icon('github', 'mr-2', 16)} ${githubLink ? '已链接 GitHub' : '链接 GitHub'}
                                </button>
                            </div>
                            ${githubLink ? `
                                <a href="${githubLink.repoUrl}" target="_blank" rel="noopener noreferrer"
                                   class="mb-4 inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">
                                    ${Icon('link-2', 'mr-2', 14)} ${githubLink.owner}/${githubLink.repo}
                                </a>
                            ` : ''}
                            
                            ${t.isLocked && locker ? `
                                <div class="flex items-center px-4 py-1.5 rounded-lg text-sm font-medium animate-pulse
                                    ${isMe ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-purple-100 text-purple-700 border border-purple-200'}">
                                    ${Icon('lock', 'mr-2', 14)} ${locker.name} 正在占用...
                                </div>
                            ` : ''}

                            <div class="flex gap-4 mt-6">
                                ${(!t.isLocked && t.file?.version > 0) ? `
                                    <button onclick="window.dispatch('openStartModal', '${t.id}')" 
                                        class="flex items-center px-6 py-3 rounded-lg font-medium shadow-md transition-transform active:scale-95 ${t.completed ? 'bg-gray-300 text-gray-600 cursor-not-allowed hover:bg-gray-300' : 'bg-black text-white hover:bg-gray-800'}" ${t.completed ? 'disabled' : ''}>
                                        ${Icon('download', 'mr-2', 20)} ${t.completed ? '任务已完成' : '开始占用'}
                                    </button>
                                ` : ''}

                                ${(!t.isLocked && (!t.file || t.file.version === 0)) ? `
                                    <button onclick="window.dispatch('triggerInitialUpload', '${t.id}')" 
                                        class="flex items-center px-6 py-3 rounded-lg font-medium shadow-md transition-transform active:scale-95 bg-blue-600 text-white hover:bg-blue-700">
                                        ${state.ui.isUploading ? Icon('loader-2', 'mr-2 animate-spin', 20) : Icon('upload-cloud', 'mr-2', 20)} 上传初始文件
                                    </button>
                                    <input type="file" id="initial-file-upload-${t.id}" class="hidden" onchange="window.dispatch('uploadFile', '${t.id}', this)">
                                ` : ''}

                                ${isMe ? `
                                    <button onclick="window.dispatch('openActionModal', '${t.id}')" 
                                        class="flex items-center px-6 py-3 rounded-lg font-medium shadow-md bg-green-600 text-white hover:bg-green-700 transition-transform active:scale-95">
                                        ${Icon('settings-2', 'mr-2', 20)} 提交 / 管理
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        `)}

                        <div class="${isMobile ? '' : 'bg-white rounded-xl shadow-sm border p-6'}">
                            <div class="flex justify-between items-center ${isMobile ? 'mb-4' : 'mb-6'}">
                                 <h3 class="text-lg font-bold text-gray-800 flex items-center ${isMobile ? 'px-4' : ''}">${Icon('check-circle-2', 'mr-2 text-indigo-500', 20)} 待办事项 <span class="ml-2 text-sm text-gray-400 font-semibold">(${completedTodos.length}/${t.todos.length})</span></h3>
                            </div>
                            
                            <div id="todo-editor-panel-${t.id}" class="mb-6 border rounded-xl overflow-visible shadow-sm focus-within:ring-2 ring-indigo-500 transition-all bg-white relative ${isMobile ? 'mx-4' : ''}">
                                <div class="flex items-center gap-1 p-2 border-b bg-gray-50 text-gray-600 rounded-t-xl relative">
                                    <button onmousedown="event.preventDefault()" onclick="window.dispatch('execCmd', 'bold')" class="p-1.5 hover:bg-gray-200 rounded text-xs font-bold w-8" title="加粗">B</button>
                                    <div class="w-px h-4 bg-gray-300 mx-1"></div>
                                    <button onmousedown="event.preventDefault()" onclick="window.dispatch('execCmd', 'backColor', '#fef08a')" class="w-6 h-6 rounded bg-yellow-200 hover:ring-2 ring-yellow-400 border border-yellow-300 mx-1" title="黄色背景"></button>
                                    <button onmousedown="event.preventDefault()" onclick="window.dispatch('execCmd', 'backColor', '#bbf7d0')" class="w-6 h-6 rounded bg-green-200 hover:ring-2 ring-green-400 border border-green-300 mx-1" title="绿色背景"></button>
                                    <button onmousedown="event.preventDefault()" onclick="window.dispatch('execCmd', 'backColor', '#bfdbfe')" class="w-6 h-6 rounded bg-blue-200 hover:ring-2 ring-blue-400 border border-blue-300 mx-1" title="蓝色背景"></button>
                                    <button onmousedown="event.preventDefault()" onclick="window.dispatch('insertMentionTrigger', '${t.id}')" class="w-8 h-8 inline-flex items-center justify-center rounded text-xs font-bold hover:bg-gray-100 text-gray-600 ml-1" title="@ 提及">@</button>
                                    <div class="relative ml-1">
                                        <button onmousedown="event.preventDefault()" onclick="window.dispatch('toggleTodoPriorityMenu', 'editor', '${t.id}')" class="w-8 h-8 inline-flex items-center justify-center rounded transition-colors ${t.completed ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:bg-gray-100'}" style="${editorPriority === 'none' ? 'color:#9ca3af;' : `color:${editorPriorityMeta.stroke}; background:${editorPriorityMeta.bg};`}" title="${editorPriorityMeta.label}">
                                            ${Icon('flag', '', 14, editorPriority === 'none' ? 'none' : editorPriorityMeta.stroke, editorPriorityMeta.stroke)}
                                        </button>
                                        ${editorPriorityMenuOpen ? renderPriorityMenu(editorPriority, (priority) => `window.dispatch('setTodoEditorPriority', '${priority}', '${t.id}')`) : ''}
                                    </div>
                                    ${isMobile ? `
                                        <button onmousedown="event.preventDefault()" onclick="window.dispatch('triggerTodoImageInput', '${t.id}')" class="w-8 h-8 inline-flex items-center justify-center rounded transition-colors hover:bg-gray-100 text-gray-500 ml-1" title="添加图片">
                                            ${Icon('image-plus', '', 14)}
                                        </button>
                                        <input type="file" id="todo-image-input-${t.id}" class="hidden" accept="image/*" multiple onchange="window.dispatch('handleTodoImageInputChange', '${t.id}', this)">
                                    ` : ''}
                                    <button onmousedown="event.preventDefault()" onclick="window.dispatch('execCmd', 'removeFormat')" class="ml-auto p-1.5 hover:bg-gray-200 rounded text-xs" title="清除格式">${Icon('eraser', '', 14)}</button>
                                </div>
                                <div class="relative">
                                    <div id="todo-editor" contenteditable="${t.completed ? 'false' : 'true'}" 
                                         class="p-4 min-h-[100px] outline-none text-sm text-gray-800 rich-editor ${t.completed ? 'bg-gray-50' : ''}" 
                                         placeholder="${t.completed ? '已完成任务不可编辑' : (isMobile ? '在这里添加新的待办（可点图片按钮从相册添加）' : '在这里添加新的待办（可直接粘贴或拖入图片）')}"
                                         oninput="window.dispatch('updateEditorDraft', '${t.id}', this.innerHTML)"
                                         onpaste="window.dispatch('handleTodoPaste', event, '${t.id}')"
                                         ondragover="window.dispatch('handleTodoDragOver', event)"
                                         ondrop="window.dispatch('handleTodoDrop', event, '${t.id}')"
                                         oncompositionstart="window.dispatch('setMentionComposing', true)"
                                         oncompositionend="window.dispatch('handleMentionCompositionEnd', event, '${t.id}')"
                                         onkeydown="window.dispatch('handleTodoMentionBackspace', event, '${t.id}'); window.dispatch('handleTodoEditorKeyDown', event, '${t.id}'); window.dispatch('handleTodoSubmitShortcut', event, '${t.id}'); if(event.key==='Enter' && event.shiftKey) {}"
                                         onkeyup="window.dispatch('handleTodoEditorKeyUp', event, '${t.id}')"></div>
                                    ${mentionCandidates.length ? `
                                        <div class="mention-float-panel" style="left:${mentionPicker.x || 12}px; top:${mentionPicker.y || 12}px;">
                                            ${mentionCandidates.map((u, idx) => {
            const isMe = u.uid === state.currentUser.uid;
            const isActive = idx === (mentionPicker.selectedIndex ?? -1);
            const base = 'w-full text-left px-3 py-2 text-sm text-gray-900';
            const hover = isMe ? 'hover:bg-emerald-50 hover:text-emerald-700' : 'hover:bg-purple-50 hover:text-purple-700';
            const active = isActive ? (isMe ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700') : '';
            return `<button onmousedown="event.preventDefault(); window.dispatch('pickMentionFromPicker', event, '${t.id}', '${u.uid}')" class="${base} ${hover} ${active}">@${u.name}</button>`;
        }).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="p-2 ${isMobile ? 'space-y-3' : 'flex items-center justify-between gap-3'} bg-white border-t border-gray-50 rounded-b-xl">
                                    <div class="flex flex-wrap gap-2 items-center flex-1 min-w-0">
                                        ${(state.ui.editorImages || []).map((img, idx) => {
            const previewUrl = (typeof img === 'object' && img) ? (img.previewUrl || img.url || '') : String(img || '');
            const imageId = (typeof img === 'object' && img && img.id) ? img.id : `legacy:${idx}`;
            return `<div class="todo-attach-pill">
                                                    <img src="${previewUrl}" class="todo-attach-pill-thumb" onclick="window.dispatch('openImagePreview', '${String(previewUrl).replace(/'/g, "\\'")}')" />
                                                    <span class="todo-attach-pill-name">图片${idx + 1}</span>
                                                    <button class="todo-attach-remove" onclick="window.dispatch('removeEditorImage', '${String(imageId).replace(/'/g, "\\'")}')">${Icon('x', '', 12)}</button>
                                               </div>`;
        }).join('')}
                                    </div>
                                    <div class="flex items-center ${isMobile ? 'justify-end' : 'justify-end'} gap-2 shrink-0">
                                        ${isMobile ? '' : '<span class="text-[11px] text-gray-400 select-none">Ctrl/⌘ + Enter</span>'}
                                        ${state.ui.todoSubmitUploading ? `
                                            <div class="todo-uploading-hint">
                                                上传中<span class="uploading-dots"><i>.</i><i>.</i><i>.</i></span>
                                            </div>
                                        ` : ''}
                                        ${state.ui.editingTodoId ? `
                                            <button onclick="window.dispatch('saveTodo', '${t.id}')" 
                                                class="px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-green-700 transition-colors flex items-center ${state.ui.todoSubmitUploading ? 'opacity-60 cursor-not-allowed' : ''}" ${state.ui.todoSubmitUploading ? 'disabled' : ''}>
                                                ${Icon('save', 'mr-1.5', 14)} 保存修改
                                            </button>
                                            <button onclick="window.dispatch('reAddTodo', '${t.id}')" 
                                                class="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center ${state.ui.todoSubmitUploading ? 'opacity-60 cursor-not-allowed' : ''}" ${state.ui.todoSubmitUploading ? 'disabled' : ''}>
                                                ${Icon('refresh-cw', 'mr-1.5', 14)} 重新添加
                                            </button>
                                            <button onclick="window.dispatch('cancelEditingTodo')" class="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 ${state.ui.todoSubmitUploading ? 'opacity-60 cursor-not-allowed' : ''}" ${state.ui.todoSubmitUploading ? 'disabled' : ''}>取消</button>
                                        ` : `
                                            <button onclick="window.dispatch('addTodo', '${t.id}')" 
                                                class="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-colors flex items-center ${state.ui.todoSubmitUploading ? 'opacity-60 cursor-not-allowed' : ''}" ${state.ui.todoSubmitUploading ? 'disabled' : ''}>
                                                ${Icon('plus', 'mr-1.5', 14)} 添加待办
                                            </button>
                                        `}
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-2 ${isMobile ? 'px-0' : ''}">
                                ${renderTodoGroups(t.id, activeTodos, { todoAnimKeys, editingTodoId: state.ui.editingTodoId })}
                                ${(activeTodos.length && (recentCompletedTodos.length || defaultVisibleOldCompletedTodos.length || hiddenOldCompletedTodos.length)) ? '<div class="h-px bg-gray-100 my-4 mx-2"></div>' : ''}
                                ${renderTodoGroups(t.id, recentCompletedTodos, { completed: true, todoAnimKeys, editingTodoId: state.ui.editingTodoId })}
                                ${renderTodoGroups(t.id, defaultVisibleOldCompletedTodos, { completed: true, todoAnimKeys, editingTodoId: state.ui.editingTodoId })}
                                ${hiddenOldCompletedTodos.length ? `
                                    <div class="px-3 py-2">
                                        <button onclick="window.dispatch('toggleCompletedTodoCollapse', '${t.id}')" class="text-xs text-gray-500 hover:text-gray-700 font-medium">
                                            ${isOldCompletedExpanded ? `收起（已经折叠 ${hiddenOldCompletedTodos.length} 条已完成待办）` : `（已经折叠 ${hiddenOldCompletedTodos.length} 条已完成待办）点击展开`}
                                        </button>
                                    </div>
                                ` : ''}
                                ${renderTodoGroups(t.id, visibleHiddenOldCompletedTodos, { completed: true, todoAnimKeys, editingTodoId: state.ui.editingTodoId })}
                                ${t.todos.length === 0 ? '<div class="text-center py-8 text-gray-400 text-sm italic">暂无待办</div>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
