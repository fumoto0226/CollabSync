// --- Main Render Loop ---
function Render() {
    saveScroll(); // Save scroll position before update

    const app = document.getElementById('app');
    const portal = document.getElementById('modal-portal');
    if (!app) return;

    app.innerHTML = RenderSidebar() + RenderMain();
    portal.innerHTML = RenderModals();

    // Re-initialize icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

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
    if (editor && state.ui.editorContent) {
        if (editor.innerHTML !== state.ui.editorContent) {
            editor.innerHTML = state.ui.editorContent;
            // Set cursor to end
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            const sel = window.getSelection();
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
