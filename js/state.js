// --- State Management ---
let state = {
    authStatus: 'loading', // 'loading' | 'unauthenticated' | 'authenticated'
    locale: (() => {
        try { return localStorage.getItem('cs_locale') || 'zh'; }
        catch (e) { return 'zh'; }
    })(),
    // 不再使用首屏弹窗，登录页直接放语言选择按钮
    localePickerRequired: false,
    currentUser: null,
    users: [],
    projects: [],
    tasks: [],
    activeView: { type: 'welcome' },
    draft: {
        projectId: null,
        name: '',
        desc: '',
        members: [],
        memberSearchInput: '',
        file: null,
        fileNote: '',
        kind: 'text' // 'file' | 'text' - 默认无文件任务
    },
    expandedProjects: {},
    contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        taskId: null,
        projectId: null
    },
    confirmModal: {
        visible: false,
        type: null, // 'delete_project' | 'delete_task'
        id: null,
        title: '',
        message: ''
    },
    ui: {
        memberModalProjectId: null,
        actionModalTaskId: null,
        historyModalTaskId: null,
        startModalTaskId: null,
        editHistoryModalTaskId: null,
        githubLinkTaskId: null,
        editProjectId: null,
        editTaskId: null,
        profileModalOpen: false,
        settingsPopoverOpen: false,
        languagePickerOpen: false,
        activationCodesModalOpen: false,
        activationCodesLoading: false,
        activationModalOpen: false,
        expiryEditorCode: null,
        pendingTodoRecovery: null,
        projectsLoading: false,
        ganttModal: {
            mode: null,         // 'project' | 'task' | null
            projectId: null,
            taskId: null,
            viewStartMs: null,  // 左边缘日期（凌晨0点 ms）
            dayCount: 14,       // 可视天数（已被自适应取代，保留兼容）
            cellW: 34,          // 每天像素宽（连续，1.2 - 60）
            zoomLevel: 'day',   // 'day' | 'month' | 'year' 从 cellW 推导，用于按钮高亮与表头格式
            selectedItemId: null, // 选中编辑的条
            ownerPickerOpen: false,
            priorityPickerOpen: false,
            showHiddenOld: false,
            quickAddOpen: false,
            quickAddText: '',
            quickEditOpen: false,
            quickEditText: '',
            contextMenu: null  // { kind, id, x, y } 或 null
        },
        inviteInput: '',
        draftSearchResult: null, // 创建项目时搜索成员的结果
        inviteSearchResult: null, // 成员管理弹窗搜索的结果
        editingTodoId: null,
        editorTaskId: null,
        editorContent: '',
        editorImages: [],
        editorPriority: 'none',
        todoPriorityMenuOpen: false,
        todoPriorityMenuTarget: {
            mode: null,
            taskId: null,
            todoId: null
        },
        mentionPicker: {
            visible: false,
            taskId: null,
            query: '',
            selectedIndex: -1,
            candidateUids: [],
            x: 12,
            y: 12
        },
        mentionPickerTimer: null,
        skipMentionNormalizeOnce: false,
        mentionComposing: false,
        imagePreviewUrl: null,
        todoAnimKeys: {},
        collapsedCompletedByTaskId: {},
        todoSubmitUploading: false,
        todoScrollTarget: null,
        isUploading: false,
        aiLoading: false,
        projectSummary: '',
        memberListExpandedByProjectId: {},
        myWorkPopoverOpen: false,
        isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
        mobilePane: 'sidebar',
        sidebarWidth: (() => {
            try {
                const v = parseInt(localStorage.getItem('cs_sidebar_width') || '', 10);
                return Number.isFinite(v) ? v : 280;
            } catch (e) {
                return 280;
            }
        })(),
        isSidebarResizing: false
    },
    activationCodes: []
};

// Firebase listeners unsubscribes
let unsubs = {
    projects: null,
    tasks: null,
    todos: null,
    users: null
};
