const STORAGE_KEY = 'campus_radar_user_id';

const state = {
  userId: '',
  filters: {
    type: '',
    source: '',
    status: '',
    search: ''
  },
  selectedTags: new Set(['开发', '学习', '设计']),
  activities: [],
  selectedActivity: null
};

function getUserId() {
  let userId = localStorage.getItem(STORAGE_KEY);
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(16).slice(2, 10);
    localStorage.setItem(STORAGE_KEY, userId);
  }
  state.userId = userId;
  return userId;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDeadline(deadline) {
  if (!deadline || deadline === '待定' || deadline === 'None') {
    return '截止：待定';
  }

  const text = String(deadline).trim();
  if (!text) return '截止：待定';

  const match = text.match(/(\d{4}-\d{2}-\d{2})[\sT]*(\d{2}:\d{2})?/);
  if (!match) {
    return `截止：${text}`;
  }

  const datePart = match[1];
  const timePart = match[2] || '23:59';
  const target = new Date(`${datePart}T${timePart}:00`);
  if (Number.isNaN(target.getTime())) {
    return `截止：${text}`;
  }

  const diffMs = target.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const label = diffMs <= 0 ? '已截止' : diffDays > 1 ? `${diffDays}天后截止` : `${diffHours}小时后截止`;
  return `截止：${text}（${label}）`;
}

function normalizeActivities(data) {
  return (Array.isArray(data) ? data : []).map((item) => ({
    ...item,
    missing_info: Array.isArray(item.missing_info) ? item.missing_info : [],
    risk_note: item.risk_note || '',
    favorite: false,
    signed_up: false,
    source: item.source || '学生个人发布',
    status: item.status || '待定',
    type: item.type || '活动',
    description: item.description || '暂无详细说明'
  }));
}

function calculateMatch(activity) {
  let score = 72;
  const text = `${activity.title || ''} ${activity.description || ''} ${activity.target || ''} ${activity.requirements || ''} ${activity.type || ''}`.toLowerCase();

  if (state.selectedTags.size > 0) {
    let hits = 0;
    for (const tag of state.selectedTags) {
      if (text.includes(tag.toLowerCase())) {
        hits += 1;
      }
    }
    score += hits * 7;
  }

  if ((activity.source || '').includes('校内')) score += 6;
  if ((activity.type || '').includes('培训') || (activity.type || '').includes('活动')) score += 4;
  if ((activity.status || '').includes('待核实')) score -= 15;
  if ((activity.status || '').includes('长期')) score += 5;
  if (activity.is_user_published) score -= 10;
  if ((activity.missing_info || []).length >= 3) score -= 10;
  if ((activity.risk_note || '').length > 0) score -= 8;

  return Math.max(40, Math.min(99, Math.round(score)));
}

function buildActivityCard(activity) {
  const match = calculateMatch(activity);
  const status = activity.status || '待定';
  const deadlineText = formatDeadline(activity.deadline);
  const missingInfo = Array.isArray(activity.missing_info) ? activity.missing_info : [];
  const favoriteActive = Boolean(activity.favorite);
  const signupActive = Boolean(activity.signed_up);
  const sourceLabel = activity.source || '学生个人发布';

  return `
    <article class="activity-card" data-id="${activity.id}" tabindex="0">
      <div class="card-header">
        <div>
          <h3 class="card-title">${escapeHtml(activity.title || '未命名活动')}</h3>
          <div class="badge-row">
            <span class="badge blue">${escapeHtml(activity.type || '活动')}</span>
            <span class="badge green">适配度 ${match}%</span>
            <span class="badge ${status.includes('待核实') || status.includes('风险') ? 'red' : 'orange'}">${escapeHtml(status)}</span>
          </div>
        </div>
        <button class="favorite-btn ${favoriteActive ? 'active' : ''}" type="button" data-action="favorite" data-id="${activity.id}">${favoriteActive ? '已收藏' : '收藏'}</button>
      </div>

      <div class="card-meta">
        <span>主办：${escapeHtml(activity.organizer || '待确认')}</span>
        <span>对象：${escapeHtml(activity.target || '待确认')}</span>
      </div>

      <p class="card-summary">${escapeHtml(activity.description || '暂无详细说明')}</p>

      <div class="meta-grid">
        <div class="metric">
          <span class="metric-label">时间</span>
          <strong>${escapeHtml(activity.start_time || '待定')}</strong>
        </div>
        <div class="metric">
          <span class="metric-label">来源</span>
          <strong>${escapeHtml(sourceLabel)}</strong>
        </div>
        <div class="metric">
          <span class="metric-label">地点</span>
          <strong>${escapeHtml(activity.location || '待定')}</strong>
        </div>
        <div class="metric">
          <span class="metric-label">费用</span>
          <strong>${escapeHtml(activity.fee || '待定')}</strong>
        </div>
      </div>

      <div class="warning-box">
        <span class="warning-text">${escapeHtml(deadlineText)}</span>
      </div>

      ${missingInfo.length ? `
        <div class="warning-box">
          <span class="warning-text">缺失信息：</span>
          ${missingInfo.map(item => escapeHtml(item)).join('；')}
        </div>
      ` : ''}

      ${activity.risk_note ? `
        <div class="risk-box">
          <span class="risk-text">风险提醒：</span>
          ${escapeHtml(activity.risk_note)}
        </div>
      ` : ''}

      <div class="card-actions">
        <button class="inline-btn" type="button" data-action="detail" data-id="${activity.id}">查看详情</button>
        <button class="signup-btn ${signupActive ? 'active' : ''}" type="button" data-action="signup" data-id="${activity.id}">${signupActive ? '已报名' : '报名'}</button>
      </div>
    </article>
  `;
}

function renderActivities() {
  const list = document.getElementById('activityList');
  if (!list) return;

  if (!state.activities.length) {
    list.innerHTML = '<div class="empty-state">暂无符合条件的活动，换个筛选条件试试看。</div>';
    return;
  }

  list.innerHTML = state.activities.map(buildActivityCard).join('');

  list.querySelectorAll('[data-action="favorite"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(Number(btn.dataset.id));
    });
  });

  list.querySelectorAll('[data-action="signup"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleSignup(Number(btn.dataset.id));
    });
  });

  list.querySelectorAll('[data-action="detail"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = Number(btn.dataset.id);
      const found = state.activities.find((item) => Number(item.id) === id);
      if (found) openDetail(found);
    });
  });

  list.querySelectorAll('.activity-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = Number(card.dataset.id);
      const found = state.activities.find((item) => Number(item.id) === id);
      if (found) openDetail(found);
    });
  });
}

function buildDetailContent(activity) {
  const missingInfo = Array.isArray(activity.missing_info) ? activity.missing_info : [];
  const tags = ['开发', '学习', '设计'];

  return `
    <div class="detail-content">
      <div class="detail-section">
        <h4>基本信息</h4>
        <div class="detail-grid">
          <div><strong>标题：</strong> ${escapeHtml(activity.title || '未命名活动')}</div>
          <div><strong>类型：</strong> ${escapeHtml(activity.type || '活动')}</div>
          <div><strong>来源：</strong> ${escapeHtml(activity.source || '学生个人发布')}</div>
          <div><strong>主办方：</strong> ${escapeHtml(activity.organizer || '待确认')}</div>
          <div><strong>对象：</strong> ${escapeHtml(activity.target || '待确认')}</div>
          <div><strong>时间：</strong> ${escapeHtml(activity.start_time || '待定')}</div>
          <div><strong>截止：</strong> ${escapeHtml(activity.deadline || '待定')}</div>
          <div><strong>地点：</strong> ${escapeHtml(activity.location || '待定')}</div>
          <div><strong>费用：</strong> ${escapeHtml(activity.fee || '待定')}</div>
          <div><strong>状态：</strong> ${escapeHtml(activity.status || '待定')}</div>
        </div>
      </div>

      <div class="detail-section">
        <h4>活动说明</h4>
        <p>${escapeHtml(activity.description || '暂无详细说明')}</p>
      </div>

      <div class="detail-section">
        <h4>参与要求</h4>
        <p>${escapeHtml(activity.requirements || '未说明')}</p>
      </div>

      <div class="detail-section">
        <h4>标签</h4>
        <div class="chip-list">
          ${tags.map((tag) => `<span class="chip ${state.selectedTags.has(tag) ? 'active' : ''}">${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>

      ${missingInfo.length ? `
        <div class="detail-section">
          <h4>缺失信息</h4>
          <div class="warning-box">
            <span class="warning-text">缺失信息：</span>
            ${missingInfo.map(item => escapeHtml(item)).join('；')}
          </div>
        </div>
      ` : ''}

      ${activity.risk_note ? `
        <div class="detail-section">
          <h4>风险提醒</h4>
          <div class="risk-box">
            <span class="risk-text">风险提醒：</span>
            ${escapeHtml(activity.risk_note)}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function openDetail(activity) {
  const modal = document.getElementById('detailModal');
  if (!modal) return;
  const panel = modal.querySelector('.modal-panel');
  const title = panel.querySelector('[data-role="detail-title"]');
  const body = panel.querySelector('[data-role="detail-body"]');

  state.selectedActivity = activity;
  title.textContent = activity.title || '活动详情';
  body.innerHTML = buildDetailContent(activity);
  modal.classList.remove('hidden');
}

function closeDetail() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.add('hidden');
}

function getFilteredActivities() {
  const search = state.filters.search.trim().toLowerCase();
  const activities = normalizeActivities(window.CAMPUS_ACTIVITIES || []);

  return activities.filter((activity) => {
    const matchesType = !state.filters.type || activity.type === state.filters.type;
    const matchesSource = !state.filters.source || activity.source === state.filters.source;
    const matchesStatus = !state.filters.status || String(activity.status).includes(state.filters.status);
    const text = [activity.title, activity.organizer, activity.target, activity.description, activity.requirements].join(' ').toLowerCase();
    const matchesSearch = !search || text.includes(search);
    return matchesType && matchesSource && matchesStatus && matchesSearch;
  });
}

function refreshActivities() {
  state.activities = getFilteredActivities();
  renderActivities();
}

function toggleFavorite(activityId) {
  const activity = state.activities.find((item) => Number(item.id) === Number(activityId));
  if (!activity) return;
  activity.favorite = !activity.favorite;
  renderActivities();
}

function toggleSignup(activityId) {
  const activity = state.activities.find((item) => Number(item.id) === Number(activityId));
  if (!activity) return;
  activity.signed_up = !activity.signed_up;
  renderActivities();
}

function submitPublish(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    id: Date.now(),
    title: form.title.value.trim(),
    type: form.type.value.trim() || '活动',
    source: form.source.value.trim() || '学生个人发布',
    organizer: form.organizer.value.trim() || '学生发布',
    target: form.target.value.trim() || '在校学生',
    start_time: form.start_time.value.trim() || '待定',
    deadline: form.deadline.value.trim() || '待定',
    location: form.location.value.trim() || '待定',
    fee: form.fee.value.trim() || '待定',
    requirements: form.requirements.value.trim() || '未说明',
    status: form.status.value.trim() || '待审核',
    description: form.description.value.trim(),
    missing_info: [form.missing_info.value.trim()].filter(Boolean),
    risk_note: form.risk_note.value.trim() || '信息待核实。',
    is_user_published: true,
    favorite: false,
    signed_up: false
  };

  const list = window.CAMPUS_ACTIVITIES || [];
  list.unshift(payload);
  window.CAMPUS_ACTIVITIES = list;
  form.reset();
  refreshActivities();
  alert('活动已成功发布，已进入活动列表。');
}

function bindEvents() {
  const searchInput = document.getElementById('searchInput');
  const typeSelect = document.getElementById('typeFilter');
  const sourceSelect = document.getElementById('sourceFilter');
  const statusSelect = document.getElementById('statusFilter');
  const refreshBtn = document.getElementById('refreshBtn');
  const newStudentBtn = document.getElementById('newStudentMode');
  const publishForm = document.getElementById('publishForm');
  const closeBtn = document.getElementById('closeDetail');
  const modal = document.getElementById('detailModal');

  searchInput.addEventListener('input', (event) => {
    state.filters.search = event.target.value.trim();
    refreshActivities();
  });

  typeSelect.addEventListener('change', (event) => {
    state.filters.type = event.target.value;
    refreshActivities();
  });

  sourceSelect.addEventListener('change', (event) => {
    state.filters.source = event.target.value;
    refreshActivities();
  });

  statusSelect.addEventListener('change', (event) => {
    state.filters.status = event.target.value;
    refreshActivities();
  });

  refreshBtn.addEventListener('click', refreshActivities);

  newStudentBtn.addEventListener('change', (event) => {
    document.body.classList.toggle('new-student-mode', event.target.checked);
  });

  publishForm.addEventListener('submit', submitPublish);
  closeBtn.addEventListener('click', closeDetail);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeDetail();
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const value = chip.dataset.tag;
      if (!value) return;
      if (state.selectedTags.has(value)) {
        state.selectedTags.delete(value);
      } else {
        state.selectedTags.add(value);
      }
      chip.classList.toggle('active', state.selectedTags.has(value));
      refreshActivities();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  getUserId();
  document.getElementById('newStudentMode').checked = false;
  bindEvents();
  refreshActivities();
});
