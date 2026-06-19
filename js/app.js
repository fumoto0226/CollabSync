// --- Main Render Loop ---
function Render() {
    saveScroll(); // Save scroll position before update

    // Capture current caret position in todo editor before re-render.
    // 用结构路径（childNode 索引）而不是纯文本长度，避免末尾换行后光标无法落到新行。
    const prevEditor = document.getElementById('todo-editor');
    let prevEditorCaretPath = null;
    let prevEditorCaretOffset = 0;
    if (prevEditor) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount && prevEditor.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            const path = [];
            let node = range.startContainer;
            while (node && node !== prevEditor) {
                const parent = node.parentNode;
                if (!parent) { path.length = 0; break; }
                const idx = Array.prototype.indexOf.call(parent.childNodes, node);
                if (idx < 0) { path.length = 0; break; }
                path.unshift(idx);
                node = parent;
            }
            if (node === prevEditor) {
                prevEditorCaretPath = path;
                prevEditorCaretOffset = range.startOffset;
            }
        }
    }

    const app = document.getElementById('app');
    const portal = document.getElementById('modal-portal');
    if (!app) return;

    if (state.ui.isMobile) {
        app.innerHTML = state.ui.mobilePane === 'sidebar'
            ? RenderSidebar({ mobile: true })
            : RenderMobileMainShell();
    } else {
        app.innerHTML = RenderSidebar() + RenderMain();
    }
    portal.innerHTML = RenderModals();

    // Re-initialize icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Apply mention color by viewer identity (@me = green, @others = purple)
    document.querySelectorAll('.todo-mention').forEach(el => {
        const mentionUid = el.getAttribute('data-mention-uid');
        el.classList.remove('todo-mention-me', 'todo-mention-other');
        if (mentionUid && state.currentUser?.uid && mentionUid === state.currentUser.uid) {
            el.classList.add('todo-mention-me');
        } else {
            el.classList.add('todo-mention-other');
        }
    });

    restoreScroll(); // Restore scroll position

    // Restore input focus
    if (state.ui.inviteInput) {
        const el = document.querySelector('input[placeholder*="邮箱"]');
        if (el) { el.focus(); el.value = state.ui.inviteInput; }
    }
    // Restore draft inputs
    if (state.draft.name) {
        const el = document.querySelector('input[value="' + state.draft.name + '"]');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
    if (state.draft.memberSearchInput) {
        const el = document.querySelector('input[placeholder*="搜索姓名"]');
        if (el) { el.focus(); el.value = state.draft.memberSearchInput; }
    }

    // Restore Rich Editor Content (for edit mode switching)
    const editor = document.getElementById('todo-editor');
    const currentTaskId = state.activeView?.type === 'task_detail' ? state.activeView.taskId : null;
    if (editor && state.ui.editorTaskId === currentTaskId && state.ui.editorContent) {
        if (editor.innerHTML !== state.ui.editorContent) {
            editor.innerHTML = state.ui.editorContent;
        }
        // Restore caret using the structural path captured before re-render.
        if (prevEditorCaretPath) {
            let target = editor;
            let ok = true;
            for (const idx of prevEditorCaretPath) {
                if (!target.childNodes || !target.childNodes[idx]) { ok = false; break; }
                target = target.childNodes[idx];
            }
            const range = document.createRange();
            try {
                if (ok && target.nodeType === Node.TEXT_NODE) {
                    range.setStart(target, Math.min(prevEditorCaretOffset, (target.textContent || '').length));
                } else if (ok) {
                    range.setStart(target, Math.min(prevEditorCaretOffset, target.childNodes ? target.childNodes.length : 0));
                } else {
                    range.selectNodeContents(editor);
                    range.collapse(false);
                }
            } catch (e) {
                range.selectNodeContents(editor);
                range.collapse(false);
            }
            range.collapse(true);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    // Edit flow only: jump to editor when entering edit mode, then jump back to the edited todo after save.
    const scrollTarget = state.ui.todoScrollTarget;
    if (scrollTarget && state.activeView?.type === 'task_detail' && scrollTarget.taskId === currentTaskId) {
        requestAnimationFrame(() => {
            if (scrollTarget.type === 'editor') {
                const panel = document.getElementById(`todo-editor-panel-${scrollTarget.taskId}`);
                const currentEditor = document.getElementById('todo-editor');
                if (panel) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                if (currentEditor) {
                    currentEditor.focus();
                }
            } else if (scrollTarget.type === 'todo' && scrollTarget.todoId) {
                const todoEl = document.getElementById(`todo-item-${scrollTarget.taskId}-${scrollTarget.todoId}`);
                if (todoEl) {
                    todoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            state.ui.todoScrollTarget = null;
        });
    }
}

function syncResponsiveLayout() {
    const isMobile = window.innerWidth < 768;
    let needRender = false;
    if (state.ui.isMobile !== isMobile) {
        state.ui.isMobile = isMobile;
        state.ui.mobilePane = isMobile
            ? (state.activeView?.type === 'welcome' ? 'sidebar' : 'main')
            : 'main';
        needRender = true;
    }
    // 甘特图打开时，根据窗口大小自适应日期/行数，需要随尺寸变化重渲染
    if (state.ui.ganttModal?.mode) needRender = true;
    if (needRender) Render();
}

// Global Dispatcher
window.dispatch = (action, ...args) => {
    if (Actions[action]) {
        Actions[action](...args);
    } else {
        console.warn(`Action ${action} not found`);
    }
};

// Timer Update
setInterval(() => {
    document.querySelectorAll('.timer-display').forEach(el => {
        const ts = parseInt(el.getAttribute('data-ts'));
        if (ts) el.textContent = getDuration(ts);
    });
}, 1000);

// Initial Render
window.addEventListener('resize', syncResponsiveLayout);
syncResponsiveLayout();
Render();
