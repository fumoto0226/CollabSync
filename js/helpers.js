// --- Helpers ---
const COLOR_ME = '#10b981';     // Emerald 500
const COLOR_OTHER = '#9333ea';  // Purple 600
const BG_ME = '#ecfdf5';        // Emerald 50
const BG_OTHER = '#faf5ff';     // Purple 50

const getDuration = (ts, endTs) => {
    if (!ts) return '00:00';
    const end = endTs || Date.now();
    const diff = end - ts;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    const hStr = h.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');
    const sStr = s.toString().padStart(2, '0');

    if (h > 0) return `${hStr}:${mStr}:${sStr}`;
    return `${mStr}:${sStr}`;
};

const getFriendlyDuration = (ms) => {
    if (!ms) return '0s';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}小时${m % 60}分`;
    if (m > 0) return `${m}分${s % 60}秒`;
    return `${s}秒`;
};

const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '未知大小';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' B';
};

// Scroll Preservation
const scrollPositions = new Map();
function saveScroll() {
    // 专门记录主内容区滚动
    const main = document.getElementById('main-scroll');
    if (main) {
        scrollPositions.set('__main__', main.scrollTop);
    }

    // 保存待办区域滚动
    const todoContainer = document.querySelector('.todo-list-container');
    if (todoContainer) {
        scrollPositions.set('__todo_container__', todoContainer.scrollTop);
    }

    document.querySelectorAll('[data-scroll]').forEach(el => {
        if (el.id) {
            scrollPositions.set(el.id, el.scrollTop);
        }
    });
}

function restoreScroll() {
    const main = document.getElementById('main-scroll');
    if (main && scrollPositions.has('__main__')) {
        main.scrollTop = scrollPositions.get('__main__');
    }

    // 还原待办区域滚动
    const todoContainer = document.querySelector('.todo-list-container');
    if (todoContainer && scrollPositions.has('__todo_container__')) {
        todoContainer.scrollTop = scrollPositions.get('__todo_container__');
    }

    document.querySelectorAll('[data-scroll]').forEach(el => {
        if (el.id && scrollPositions.has(el.id)) {
            el.scrollTop = scrollPositions.get(el.id);
        }
    });
}

// --- View Helpers ---
// Lucide 新版移除了 github 图标，这里用内联 SVG 兜底。
const Icon = (name, cls = "", size = 16, fill = "none", color) => {
    if (name === 'github') {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="${cls}" style="width:${size}px; height:${size}px; ${color ? `color:${color};` : ''}" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.73.5 12.02c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.23 2.77.11 3.06.73.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.4 23.5 17.1 23.5 12.02 23.5 5.73 18.27.5 12 .5Z"/></svg>`;
    }
    return `<i data-lucide="${name}" class="${cls}" style="width:${size}px; height:${size}px; ${color ? `color:${color};` : ''} ${fill !== 'none' ? `fill:${fill};` : ''}"></i>`;
};

// --- Custom Modals & Toasts ---
window.showAlert = (msg) => {
    const toast = document.createElement('div');
    toast.className = 'fixed left-1/2 bottom-8 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-[100] text-sm font-medium transition-all duration-300 transform translate-y-4 opacity-0 flex items-center gap-2';
    toast.innerHTML = `${Icon('info', 'text-blue-400', 16)} <span>${msg}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
    });

    if (window.lucide) window.lucide.createIcons({ root: toast });

    setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.showConfirm = (msg) => {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity duration-200';

        const modal = document.createElement('div');
        modal.className = 'bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all duration-200 scale-95 opacity-0';

        modal.innerHTML = `
            <div class="px-6 py-5 border-b bg-gray-50 flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                    ${Icon('alert-triangle', '', 16)}
                </div>
                <h3 class="text-lg font-bold text-gray-800">请确认操作</h3>
            </div>
            <div class="p-6">
                <p class="text-sm text-gray-600 leading-relaxed">${msg}</p>
            </div>
            <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
                <button id="confirm-cancel" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors">取消</button>
                <button id="confirm-ok" class="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95">确定</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        if (window.lucide) window.lucide.createIcons({ root: overlay });

        requestAnimationFrame(() => {
            modal.classList.remove('scale-95', 'opacity-0');
        });

        const cleanup = () => {
            modal.classList.add('scale-95', 'opacity-0');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.remove(), 200);
        };

        overlay.querySelector('#confirm-cancel').onclick = () => {
            cleanup();
            resolve(false);
        };

        overlay.querySelector('#confirm-ok').onclick = () => {
            cleanup();
            resolve(true);
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve(false);
            }
        };
    });
};

window.alert = window.showAlert; // Override global alert

// One-shot todo text animation trigger. Keep key for one render tick to avoid repeated restarts.
window.queueTodoAnimation = (taskId, todoId) => {
    if (!taskId || !todoId) return;
    if (!state?.ui) return;
    if (!state.ui.todoAnimKeys) state.ui.todoAnimKeys = {};
    const key = `${taskId}:${todoId}`;
    state.ui.todoAnimKeys[key] = true;
    setTimeout(() => {
        if (state?.ui?.todoAnimKeys && state.ui.todoAnimKeys[key]) {
            delete state.ui.todoAnimKeys[key];
        }
    }, 80);
};
