// --- Main Render Loop ---
function Render() {
    saveScroll(); // Save scroll position before update

    // Capture current caret position in todo editor before re-render.
    const prevEditor = document.getElementById('todo-editor');
    let prevEditorCaret = null;
    if (prevEditor) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount && prevEditor.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0).cloneRange();
            const pre = range.cloneRange();
            pre.selectNodeContents(prevEditor);
            pre.setEnd(range.startContainer, range.startOffset);
            prevEditorCaret = pre.toString().length;
        }
    }

    const app = document.getElementById('app');
    const portal = document.getElementById('modal-portal');
    if (!app) return;

    app.innerHTML = RenderSidebar() + RenderMain();
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
        // Restore caret to previous position instead of forcing to end.
        if (prevEditorCaret !== null) {
            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
            let remaining = prevEditorCaret;
            let targetNode = null;
            let targetOffset = 0;
            let node;
            while ((node = walker.nextNode())) {
                const len = (node.textContent || '').length;
                if (remaining <= len) {
                    targetNode = node;
                    targetOffset = Math.max(0, Math.min(remaining, len));
                    break;
                }
                remaining -= len;
            }
            const sel = window.getSelection();
            const range = document.createRange();
            if (targetNode) {
                range.setStart(targetNode, targetOffset);
            } else {
                range.selectNodeContents(editor);
                range.collapse(false);
            }
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
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
Render();
