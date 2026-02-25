// --- State Management ---
let state = {
    authStatus: 'loading', // 'loading' | 'unauthenticated' | 'authenticated'
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
        editProjectId: null,
        editTaskId: null,
        profileModalOpen: false,
        activationCodesModalOpen: false,
        activationCodesLoading: false,
        activationModalOpen: false,
        inviteInput: '',
        draftSearchResult: null, // 创建项目时搜索成员的结果
        inviteSearchResult: null, // 成员管理弹窗搜索的结果
        editingTodoId: null,
        editorTaskId: null,
        editorContent: '',
        todoAnimKeys: {},
        isUploading: false,
        aiLoading: false,
        projectSummary: '',
        memberListExpandedByProjectId: {},
        myWorkPopoverOpen: false
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
