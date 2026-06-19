// --- i18n: 国际化（中文 / 日语） ---

const I18N_MESSAGES = {
    zh: {
        // 通用
        'common.confirm': '确认',
        'common.cancel': '取消',
        'common.save': '保存',
        'common.delete': '删除',
        'common.close': '关闭',
        'common.edit': '编辑',
        'common.add': '新增',
        'common.back': '返回',
        'common.loading': '加载中',
        'common.online': '在线',
        'common.search': '搜索',
        'common.today': '今天',
        'common.expand': '展开',
        'common.collapse': '收起',
        'common.copy': '复制',
        'common.copied': '已复制',
        'common.notFound': '未找到',
        'common.noContent': '暂无内容',
        'common.optional': '可选',

        // 登录 / 欢迎
        'login.title': 'CollabSync',
        'login.subtitle': '团队协作 · 项目同步',
        'login.button': '使用 Google 登录',
        'welcome.title': '欢迎使用 CollabSync',
        'welcome.subtitle': '从左侧选择项目开始，或新建一个项目',
        'welcome.createProject': '新建项目',

        // 侧边栏
        'sidebar.projects': 'Projects',
        'sidebar.newProject': '新建项目',
        'sidebar.newTask': '新建任务',
        'sidebar.backToProjects': '项目列表',
        'sidebar.loadingProjects': '正在加载你的项目…',
        'sidebar.members': '位成员',
        'sidebar.idle': '空闲',
        'sidebar.working': 'Working',

        // 个人信息 / 设置
        'profile.title': '个人设置',
        'profile.currentAccount': '当前账号',
        'profile.username': '用户名',
        'profile.usernameHint': '修改后会在项目成员列表、任务占用等地方同步显示。',
        'profile.logout': '退出登录',
        'profile.admin': '管理员',
        'profile.activated': '已激活',
        'profile.daysLeft': '剩 {n} 天',
        'profile.lifetimeActivated': '永久激活',
        'profile.activate': '激活账号',
        'profile.codesAdmin': '激活码管理',
        'settings.menu': '设置',
        'settings.language': '切换语言',
        'settings.languageZh': '简体中文',
        'settings.languageJa': '日本語',
        'settings.profileEntry': '个人信息',

        // 项目仪表盘
        'project.gantt': '甘特图',
        'project.delete': '删除项目',
        'project.leave': '退出项目',
        'project.editBtn': '编辑项目',
        'project.taskBoard': '任务看板',
        'project.noTasks': '新建任务',
        'project.todoCounter': '{done}/{total} 待办',
        'project.statusIdle': '空闲',

        // 任务详情
        'task.gantt': '甘特图',
        'task.history': '查看历史版本',
        'task.editHistory': '查看编辑记录',
        'task.progressHistory': '查看进度记录',
        'task.linkGithub': '链接 GitHub',
        'task.linkedGithub': '已链接 GitHub',
        'task.startWork': '开始占用',
        'task.finishWork': '结束占用',
        'task.completed': '任务已完成',
        'task.idleEditable': '空闲可编辑',
        'task.elapsed': '耗时',
        'task.locked': '正在占用...',
        'task.todoTitle': '待办事项',
        'task.todoPlaceholder': '在这里添加新的待办（可直接粘贴或拖入图片）',
        'task.todoPlaceholderMobile': '在这里添加新的待办（可点图片按钮从相册添加）',
        'task.todoCompletedDisabled': '已完成任务不可编辑',
        'task.emptyTodos': '暂无待办',

        // 待办操作
        'todo.copyForAi': '复制到聊天框',
        'todo.editTooltip': '编辑',
        'todo.deleteTooltip': '删除',
        'todo.priorityNone': '无优先级',
        'todo.priorityLow': '低优先级',
        'todo.priorityMedium': '中优先级',
        'todo.priorityHigh': '高优先级',

        // 甘特图
        'gantt.title': '甘特图',
        'gantt.hint': '从左侧拖到时间轴上排期；拖条本体可平移或上下调位；拖两端可改时长；点击条选中后可编辑或"移出排期"',
        'gantt.unscheduledSection': '未排期',
        'gantt.tasks': '任务',
        'gantt.todos': '待办',
        'gantt.hiddenCount': '隐藏 {n}',
        'gantt.empty': '列表为空',
        'gantt.noScheduled': '还没有排期项',
        'gantt.noScheduledHint': '从左侧把项目拖到日期格子上',
        'gantt.expandOld': '展开更早的已完成 ({n})',
        'gantt.collapseOld': '收起',
        'gantt.jumpToItem': '跳到该项目所在日期',
        'gantt.addTodo': '新增待办',
        'gantt.addTodoPlaceholder': '输入待办内容，支持 @成员，Ctrl/⌘+Enter 提交',
        'gantt.editContent': '编辑内容',
        'gantt.editContentPlaceholderTask': '任务名，Ctrl/⌘+Enter 保存',
        'gantt.editContentPlaceholderTodo': '待办内容（支持 @成员），Ctrl/⌘+Enter 保存',
        'gantt.editContentHint': '提示：此处是纯文本编辑，附件图片会保留；原有的粗体/颜色等富文本会被清掉。"@名字" 会自动识别为成员提及。',
        'gantt.contentLabel': '内容：',
        'gantt.start': '开始',
        'gantt.end': '结束',
        'gantt.ownerLabel': '负责人:',
        'gantt.ownerNone': '暂无',
        'gantt.pickOwner': '选择负责人',
        'gantt.priorityLabel': '优先级:',
        'gantt.removeSchedule': '移出排期',
        'gantt.unscheduled': '未排期',
        'gantt.noMembersInProject': '项目暂无成员',
        'gantt.dragHintEmpty': '无 · 拖右侧条到此处可取消排期',
        'gantt.iAm': ' （我）',
        'gantt.prevMonth': '向前一个月',
        'gantt.prevWeek': '向前一周',
        'gantt.nextWeek': '向后一周',
        'gantt.nextMonth': '向后一个月',
        'gantt.add': '添加',

        // 激活
        'activation.title': '激活高级功能',
        'activation.notice': '文件上传功能需激活',
        'activation.detail': '向项目上传文件可能产生费用，需要独立激活后方可使用（下载、评论、GitHub 同步等其他功能不受限）。如有需要请联系管理员（wechat:kururugi111）获取 12 位激活码。激活后有效期 90 天。',
        'activation.codeLabel': '激活码',
        'activation.codePlaceholder': '例如: ABCD EFGH IJKL',
        'activation.submit': '激活',
        'activation.successAlert': '🎉 激活成功！您现在可以使用文件任务功能了。',
        'activation.featureLocked': '该功能需要激活账号后才能使用。请在个人设置中输入激活码进行激活。'
    },
    ja: {
        // 通用
        'common.confirm': '確認',
        'common.cancel': 'キャンセル',
        'common.save': '保存',
        'common.delete': '削除',
        'common.close': '閉じる',
        'common.edit': '編集',
        'common.add': '追加',
        'common.back': '戻る',
        'common.loading': '読み込み中',
        'common.online': 'オンライン',
        'common.search': '検索',
        'common.today': '今日',
        'common.expand': '展開',
        'common.collapse': '折りたたむ',
        'common.copy': 'コピー',
        'common.copied': 'コピー済み',
        'common.notFound': '見つかりません',
        'common.noContent': 'コンテンツなし',
        'common.optional': '任意',

        // 登录 / 欢迎
        'login.title': 'CollabSync',
        'login.subtitle': 'チーム協業 · プロジェクト同期',
        'login.button': 'Google でログイン',
        'welcome.title': 'CollabSync へようこそ',
        'welcome.subtitle': '左側のプロジェクトを選択するか、新規作成してください',
        'welcome.createProject': '新規プロジェクト',

        // 侧边栏
        'sidebar.projects': 'Projects',
        'sidebar.newProject': '新規プロジェクト',
        'sidebar.newTask': '新規タスク',
        'sidebar.backToProjects': 'プロジェクト一覧',
        'sidebar.loadingProjects': 'プロジェクトを読み込んでいます…',
        'sidebar.members': '人のメンバー',
        'sidebar.idle': '空いている',
        'sidebar.working': '作業中',

        // 个人信息 / 设置
        'profile.title': '個人設定',
        'profile.currentAccount': '現在のアカウント',
        'profile.username': 'ユーザー名',
        'profile.usernameHint': '変更するとプロジェクトのメンバー一覧や占有表示に反映されます。',
        'profile.logout': 'ログアウト',
        'profile.admin': '管理者',
        'profile.activated': 'アクティブ',
        'profile.daysLeft': '残り {n} 日',
        'profile.lifetimeActivated': '永久ライセンス',
        'profile.activate': 'アカウントを有効化',
        'profile.codesAdmin': 'アクティベーションコード管理',
        'settings.menu': '設定',
        'settings.language': '言語を切替',
        'settings.languageZh': '简体中文',
        'settings.languageJa': '日本語',
        'settings.profileEntry': '個人情報',

        // 项目仪表盘
        'project.gantt': 'ガントチャート',
        'project.delete': 'プロジェクトを削除',
        'project.leave': 'プロジェクトを退出',
        'project.editBtn': 'プロジェクトを編集',
        'project.taskBoard': 'タスクボード',
        'project.noTasks': '新規タスク',
        'project.todoCounter': '{done}/{total} ToDo',
        'project.statusIdle': '空き',

        // 任务详情
        'task.gantt': 'ガントチャート',
        'task.history': 'バージョン履歴',
        'task.editHistory': '編集履歴',
        'task.progressHistory': '進捗履歴',
        'task.linkGithub': 'GitHub をリンク',
        'task.linkedGithub': 'GitHub 連携済み',
        'task.startWork': '占有開始',
        'task.finishWork': '占有終了',
        'task.completed': 'タスク完了',
        'task.idleEditable': '空き · 編集可',
        'task.elapsed': '経過',
        'task.locked': '占有中...',
        'task.todoTitle': 'ToDo',
        'task.todoPlaceholder': 'ここに新しい ToDo を追加（画像のコピペ・ドラッグ可）',
        'task.todoPlaceholderMobile': 'ここに新しい ToDo を追加（画像ボタンからアルバム選択可）',
        'task.todoCompletedDisabled': '完了タスクは編集できません',
        'task.emptyTodos': 'ToDo はありません',

        // 待办操作
        'todo.copyForAi': 'チャットボックスへコピー',
        'todo.editTooltip': '編集',
        'todo.deleteTooltip': '削除',
        'todo.priorityNone': '優先度なし',
        'todo.priorityLow': '低優先度',
        'todo.priorityMedium': '中優先度',
        'todo.priorityHigh': '高優先度',

        // 甘特图
        'gantt.title': 'ガントチャート',
        'gantt.hint': '左側からタイムラインへドラッグしてスケジューリング；バー本体をドラッグで移動・縦位置変更；両端のハンドルで期間変更；バーをクリックで編集または「スケジュールから除外」',
        'gantt.unscheduledSection': '未スケジュール',
        'gantt.tasks': 'タスク',
        'gantt.todos': 'ToDo',
        'gantt.hiddenCount': '非表示 {n}',
        'gantt.empty': '一覧は空です',
        'gantt.noScheduled': 'まだスケジュール済みの項目はありません',
        'gantt.noScheduledHint': '左側から日付セルへドラッグしてください',
        'gantt.expandOld': '古い完了済みを表示 ({n})',
        'gantt.collapseOld': '折りたたむ',
        'gantt.jumpToItem': 'この項目の日付へジャンプ',
        'gantt.addTodo': 'ToDo を追加',
        'gantt.addTodoPlaceholder': 'ToDo 内容を入力（@メンバー対応、Ctrl/⌘+Enter で送信）',
        'gantt.editContent': '内容を編集',
        'gantt.editContentPlaceholderTask': 'タスク名、Ctrl/⌘+Enter で保存',
        'gantt.editContentPlaceholderTodo': 'ToDo 内容（@メンバー対応）、Ctrl/⌘+Enter で保存',
        'gantt.editContentHint': 'ヒント：ここではプレーンテキスト編集です。添付画像は保持されますが、太字・色などのリッチ書式はクリアされます。「@名前」は自動的にメンションとして認識されます。',
        'gantt.contentLabel': '内容：',
        'gantt.start': '開始',
        'gantt.end': '終了',
        'gantt.ownerLabel': '担当者:',
        'gantt.ownerNone': 'なし',
        'gantt.pickOwner': '担当者を選択',
        'gantt.priorityLabel': '優先度:',
        'gantt.removeSchedule': 'スケジュールから除外',
        'gantt.unscheduled': '未スケジュール',
        'gantt.noMembersInProject': 'プロジェクトにメンバーがいません',
        'gantt.dragHintEmpty': 'なし · 右側のバーをここへドラッグで解除',
        'gantt.iAm': '（自分）',
        'gantt.prevMonth': '1か月戻る',
        'gantt.prevWeek': '1週間戻る',
        'gantt.nextWeek': '1週間進む',
        'gantt.nextMonth': '1か月進む',
        'gantt.add': '追加',

        // 激活
        'activation.title': '高度な機能を有効化',
        'activation.notice': 'ファイルアップロード機能はアクティベーションが必要です',
        'activation.detail': 'プロジェクトへのファイルアップロードは費用が発生する可能性があるため、別途アクティベーションが必要です（ダウンロード、コメント、GitHub 連携などは制限なし）。必要な場合は管理者（wechat:kururugi111）まで 12 桁のコードをお問い合わせください。有効期間は 90 日です。',
        'activation.codeLabel': 'アクティベーションコード',
        'activation.codePlaceholder': '例: ABCD EFGH IJKL',
        'activation.submit': '有効化',
        'activation.successAlert': '🎉 アクティベーション成功！ファイルタスク機能が利用できます。',
        'activation.featureLocked': 'この機能はアカウントの有効化が必要です。個人設定でアクティベーションコードを入力してください。'
    }
};

// 当前语言（持久化到 localStorage）
function getCurrentLocale() {
    if (typeof state === 'object' && state?.locale) return state.locale;
    try {
        return localStorage.getItem('cs_locale') || 'zh';
    } catch (e) { return 'zh'; }
}

// 翻译函数：L('key') 或 L('key', {n: 5}) 占位符替换
// 命名用 L (Localize) 避免与 render.js 里大量 `const t = task` 的局部变量冲突
function L(key, params) {
    const locale = getCurrentLocale();
    const dict = I18N_MESSAGES[locale] || I18N_MESSAGES.zh;
    let str = dict[key];
    if (str === undefined) str = I18N_MESSAGES.zh[key] || key;
    if (params && typeof params === 'object') {
        Object.keys(params).forEach(k => {
            str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
        });
    }
    return str;
}

window.L = L;
