// DailyMemo Web 管理界面 JavaScript（卡片式布局版本）

// 全局配置
let config = {
    // API 地址（写死，不允许修改）
    apiUrl: 'https://iwb283jfm0.execute-api.us-east-1.amazonaws.com/default',

    // API Token（需要用户输入）
    apiToken: ''
};

let currentEditingNoteId = null;
let isAuthenticated = false; // 是否已认证

// 页面加载时初始化
window.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    // 不自动加载笔记，等用户输入 token 后再加载

    // 监听提醒类型变化
    const remindType = document.getElementById('newRemindType');
    if (remindType) {
        remindType.addEventListener('change', function () {
            document.getElementById('weekdaysGroup').style.display =
                this.value === 'weekly' ? 'block' : 'none';
        });
    }
});

// ==================== 配置管理 ====================

function loadConfig() {
    const savedApiToken = localStorage.getItem('apiToken');

    if (savedApiToken) {
        config.apiToken = savedApiToken;
        document.getElementById('apiToken').value = savedApiToken;
        isAuthenticated = true;
        // 自动加载笔记
        loadNotes();
    } else {
        // 显示提示信息
        const notesList = document.getElementById('notesList');
        notesList.innerHTML = '<div class="empty">请先输入 API Token 并点击"开始使用"按钮</div>';
    }
}

function saveConfig() {
    const apiToken = document.getElementById('apiToken').value.trim();

    if (!apiToken) {
        alert('❌ 请输入 API Token');
        return;
    }

    config.apiToken = apiToken;
    localStorage.setItem('apiToken', apiToken);
    isAuthenticated = true;

    alert('✅ 配置已保存');
    // 立即加载笔记
    loadNotes();
}

// ==================== API 请求 ====================

async function apiRequest(method, path, body = null) {
    const url = `${config.apiUrl}${path}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // 添加认证头
    if (config.apiToken) {
        options.headers['Authorization'] = `Bearer ${config.apiToken}`;
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || '请求失败');
        }

        return data.data;
    } catch (error) {
        console.error('API请求失败:', error);
        throw error;
    }
}

// ==================== 笔记列表 ====================

async function loadNotes() {
    if (!isAuthenticated || !config.apiToken) {
        const notesList = document.getElementById('notesList');
        notesList.innerHTML = '<div class="empty">请先输入 API Token 并点击"开始使用"按钮</div>';
        return;
    }

    const notesList = document.getElementById('notesList');
    notesList.innerHTML = '<div class="loading">加载中...</div>';

    try {
        let notes = await apiRequest('GET', '/api/notes');

        if (!notes || notes.length === 0) {
            allNotes = [];
            notesList.innerHTML = '<div class="empty">暂无笔记</div>';
            return;
        }

        // 按创建时间倒序排序
        notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // 存储所有笔记到全局变量
        allNotes = notes;

        // 根据当前过滤器显示笔记
        renderFilteredNotes();
    } catch (error) {
        allNotes = [];
        notesList.innerHTML = `<div class="empty">获取数据失败: ${error.message}</div>`;
    }
}

// 渲染笔记列表（卡片式布局）
function renderNoteItem(note) {
    // 创建时间
    const createdAt = new Date(note.created_at);
    const timeStr = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')} ${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}:${String(createdAt.getSeconds()).padStart(2, '0')}`;

    // 标签显示
    const tagsHtml = note.tags && note.tags.length > 0
        ? note.tags.map(tag => `<span class="badge badge-${note.category || 'todo'}">${tag}</span>`).join(' ')
        : '';

    // 提醒时间显示
    let remindTimesHtml = '';
    if (note.cron_expression) {
        remindTimesHtml = `<span>⏰ Cron: ${note.cron_expression}</span>`;
    } else if (note.remind_times && note.remind_times.length > 0) {
        remindTimesHtml = `<span>⏰ ${note.remind_times.join(', ')}</span>`;
    }

    // 合并提醒标记
    const mergeRemindHtml = note.merge_remind ? '<span>🔗 合并提醒</span>' : '';

    // 提醒状态
    const remindStatusHtml = note.enable_remind
        ? '<span style="color: #48bb78;">✅ 提醒已启用</span>'
        : '<span style="color: #cbd5e0;">❌ 提醒已禁用</span>';

    return `
        <div class="note-item">
            <div class="note-header">
                <div class="note-title">${escapeHtml(note.title)}</div>
                <span class="badge badge-${note.category || 'todo'}">${note.category || 'other'}</span>
            </div>
            <div class="note-meta">
                <span>📅 ${timeStr}</span>
                <span class="priority">优先级: ${'⭐'.repeat(note.priority || 3)}</span>
                ${remindStatusHtml}
                ${remindTimesHtml}
                ${mergeRemindHtml}
            </div>
            ${tagsHtml ? `<div class="note-meta">${tagsHtml}</div>` : ''}
            <div class="note-content">${escapeHtml(note.content)}</div>
            <div class="note-actions">
                <button class="btn btn-primary" onclick="editNote('${note.note_id}')">编辑</button>
                <button class="btn ${note.enable_remind ? 'btn-danger' : 'btn-success'}" 
                        onclick="toggleReminder('${note.note_id}', ${!note.enable_remind})">
                    ${note.enable_remind ? '关闭提醒' : '启用提醒'}
                </button>
                <button class="btn ${note.merge_remind ? '' : 'btn-success'}" 
                        onclick="toggleMergeRemind('${note.note_id}', ${!note.merge_remind})">
                    ${note.merge_remind ? '取消合并' : '合并提醒'}
                </button>
                <button class="btn btn-danger" onclick="deleteNote('${note.note_id}')">删除</button>
            </div>
        </div>
    `;
}

// ==================== 创建笔记 ====================

async function createNote() {
    const title = document.getElementById('newTitle').value.trim();
    const content = document.getElementById('newContent').value.trim();
    const category = document.getElementById('newCategory').value;
    const priority = parseInt(document.getElementById('newPriority').value);
    const remindType = document.getElementById('newRemindType').value;

    if (!title || !content) {
        alert('请填写标题和内容');
        return;
    }

    let remindTimes = [];
    let cronExpression = null;

    if (remindType === 'cron') {
        // 使用 Cron 表达式
        cronExpression = document.getElementById('newCronExpression').value.trim();
        if (!cronExpression) {
            alert('请填写 Cron 表达式');
            return;
        }
        // 简单验证 Cron 表达式（5 个字段）
        const cronParts = cronExpression.split(/\s+/);
        if (cronParts.length !== 5) {
            alert('❌ Cron 表达式格式错误\n应该包含 5 个字段：分钟 小时 日期 月份 星期');
            return;
        }
    } else {
        // 使用提醒时间点
        const remindTimesInput = document.getElementById('newRemindTimes').value.trim();
        if (remindTimesInput) {
            remindTimes = remindTimesInput.split(',').map(t => t.trim()).filter(t => t);

            // 验证时间格式（HH:MM）
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            for (const time of remindTimes) {
                if (!timeRegex.test(time)) {
                    alert(`❌ 时间格式错误: ${time}\n请使用 HH:MM 格式，如：08:10, 12:30, 20:00`);
                    return;
                }
            }
        } else {
            // 如果没有输入，使用默认值
            remindTimes = ['08:10', '12:30', '20:00'];
        }
    }

    try {
        await apiRequest('POST', '/api/notes', {
            title,
            content,
            category,
            priority,
            tags: [],
            remind_times: remindTimes,
            cron_expression: cronExpression,
            enable_remind: true,
            merge_remind: false
        });

        // 清空表单
        document.getElementById('newTitle').value = '';
        document.getElementById('newContent').value = '';
        document.getElementById('newCategory').value = 'todo';
        document.getElementById('newPriority').value = '3';
        document.getElementById('newRemindTimes').value = '08:10, 12:30, 20:00';

        alert('✅ 创建成功');
        loadNotes();
    } catch (error) {
        alert(`❌ 创建失败: ${error.message}`);
    }
}

// ==================== 编辑笔记 ====================

async function editNote(noteId) {
    try {
        const note = await apiRequest('GET', `/api/notes/${noteId}`);

        currentEditingNoteId = noteId;
        document.getElementById('editTitle').value = note.title;
        document.getElementById('editContent').value = note.content;
        document.getElementById('editCategory').value = note.category;
        document.getElementById('editPriority').value = note.priority;
        document.getElementById('editEnableRemind').checked = note.enable_remind;
        document.getElementById('editMergeRemind').checked = note.merge_remind;

        // 根据笔记的提醒方式设置表单
        if (note.cron_expression) {
            document.getElementById('editRemindType').value = 'cron';
            document.getElementById('editCronExpression').value = note.cron_expression;
            toggleRemindType('edit');
        } else {
            document.getElementById('editRemindType').value = 'times';
            document.getElementById('editRemindTimes').value = note.remind_times.join(', ');
            toggleRemindType('edit');
        }

        document.getElementById('editModal').style.display = 'block';
    } catch (error) {
        alert(`❌ 获取笔记失败: ${error.message}`);
    }
}

async function updateNote() {
    if (!currentEditingNoteId) return;

    const title = document.getElementById('editTitle').value.trim();
    const content = document.getElementById('editContent').value.trim();
    const category = document.getElementById('editCategory').value;
    const priority = parseInt(document.getElementById('editPriority').value);
    const enableRemind = document.getElementById('editEnableRemind').checked;
    const mergeRemind = document.getElementById('editMergeRemind').checked;
    const remindType = document.getElementById('editRemindType').value;

    if (!title || !content) {
        alert('请填写标题和内容');
        return;
    }

    let remindTimes = [];
    let cronExpression = null;

    if (remindType === 'cron') {
        // 使用 Cron 表达式
        cronExpression = document.getElementById('editCronExpression').value.trim();
        if (!cronExpression) {
            alert('请填写 Cron 表达式');
            return;
        }
        // 简单验证 Cron 表达式（5 个字段）
        const cronParts = cronExpression.split(/\s+/);
        if (cronParts.length !== 5) {
            alert('❌ Cron 表达式格式错误\n应该包含 5 个字段：分钟 小时 日期 月份 星期');
            return;
        }
    } else {
        // 使用提醒时间点
        const remindTimesInput = document.getElementById('editRemindTimes').value.trim();
        if (remindTimesInput) {
            remindTimes = remindTimesInput.split(',').map(t => t.trim()).filter(t => t);

            // 验证时间格式
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            for (const time of remindTimes) {
                if (!timeRegex.test(time)) {
                    alert(`❌ 时间格式错误: ${time}\n请使用 HH:MM 格式，如：08:10, 12:30, 20:00`);
                    return;
                }
            }
        }
    }

    try {
        await apiRequest('PUT', `/api/notes/${currentEditingNoteId}`, {
            title,
            content,
            category,
            priority,
            remind_times: remindTimes.length > 0 ? remindTimes : undefined,
            cron_expression: cronExpression,
            enable_remind: enableRemind,
            merge_remind: mergeRemind
        });

        closeEditModal();
        alert('✅ 更新成功');
        loadNotes();
    } catch (error) {
        alert(`❌ 更新失败: ${error.message}`);
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditingNoteId = null;
}

// ==================== 删除笔记 ====================

async function deleteNote(noteId) {
    if (!confirm('确定要删除这条笔记吗？')) {
        return;
    }

    try {
        await apiRequest('DELETE', `/api/notes/${noteId}`);
        alert('✅ 删除成功');
        loadNotes();
    } catch (error) {
        alert(`❌ 删除失败: ${error.message}`);
    }
}

// ==================== 切换提醒状态 ====================

async function toggleReminder(noteId, enable) {
    try {
        await apiRequest('PUT', `/api/notes/${noteId}`, {
            enable_remind: enable
        });
        loadNotes();
    } catch (error) {
        alert(`❌ 操作失败: ${error.message}`);
    }
}

async function toggleMergeRemind(noteId, merge) {
    try {
        await apiRequest('PUT', `/api/notes/${noteId}`, {
            merge_remind: merge
        });
        loadNotes();
    } catch (error) {
        alert(`❌ 操作失败: ${error.message}`);
    }
}

// ==================== 测试功能 ====================

async function testPush() {
    try {
        const result = await apiRequest('POST', '/api/push/test');
        alert('✅ 测试推送成功！请检查微信通知');
    } catch (error) {
        alert(`❌ 测试推送失败: ${error.message}`);
    }
}

async function pushNow() {
    if (!confirm('确定要立即推送今日笔记吗？')) {
        return;
    }

    try {
        const result = await apiRequest('POST', '/api/push/now');
        alert(`✅ 推送成功！`);
    } catch (error) {
        alert(`❌ 推送失败: ${error.message}`);
    }
}

// ==================== 搜索和过滤功能 ====================

let allNotes = []; // 存储所有笔记
let currentFilter = 'all'; // 当前过滤器：all, enabled, merged

async function searchNotes() {
    const keyword = document.getElementById('searchKeyword').value.trim().toLowerCase();

    if (!keyword) {
        // 如果搜索框为空，显示根据当前过滤器的笔记
        renderFilteredNotes();
        return;
    }

    // 搜索标题或内容包含关键词的笔记
    const filtered = allNotes.filter(note =>
        note.title.toLowerCase().includes(keyword) ||
        note.content.toLowerCase().includes(keyword)
    );

    renderNotes(filtered);
}

function showAllNotes() {
    currentFilter = 'all';
    document.getElementById('searchKeyword').value = '';
    renderFilteredNotes();
}

function showEnabledOnly() {
    currentFilter = 'enabled';
    document.getElementById('searchKeyword').value = '';
    renderFilteredNotes();
}

function showMergedOnly() {
    currentFilter = 'merged';
    document.getElementById('searchKeyword').value = '';
    renderFilteredNotes();
}

function renderFilteredNotes() {
    let filtered = allNotes;

    if (currentFilter === 'enabled') {
        filtered = allNotes.filter(note => note.enable_remind);
    } else if (currentFilter === 'merged') {
        filtered = allNotes.filter(note => note.merge_remind);
    }

    renderNotes(filtered);
}

function renderNotes(notes) {
    const notesList = document.getElementById('notesList');

    if (notes.length === 0) {
        notesList.innerHTML = '<div class="empty">没有找到笔记</div>';
        return;
    }

    notesList.innerHTML = notes.map(note => renderNoteItem(note)).join('');
}

// ==================== 工具函数 ====================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 切换提醒类型（时间点 vs Cron）
function toggleRemindType(type) {
    if (type === 'new') {
        const remindType = document.getElementById('newRemindType').value;
        const timesGroup = document.getElementById('newRemindTimesGroup');
        const cronGroup = document.getElementById('newCronGroup');

        if (remindType === 'cron') {
            timesGroup.style.display = 'none';
            cronGroup.style.display = 'block';
        } else {
            timesGroup.style.display = 'block';
            cronGroup.style.display = 'none';
        }
    } else if (type === 'edit') {
        const remindType = document.getElementById('editRemindType').value;
        const timesGroup = document.getElementById('editRemindTimesGroup');
        const cronGroup = document.getElementById('editCronGroup');

        if (remindType === 'cron') {
            timesGroup.style.display = 'none';
            cronGroup.style.display = 'block';
        } else {
            timesGroup.style.display = 'block';
            cronGroup.style.display = 'none';
        }
    }
}

