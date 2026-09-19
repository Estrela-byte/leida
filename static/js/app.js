const STORAGE_KEY = 'campus_opportunity_user_id';

const state = {
  userId: '',
  filters: {
    category: 'all',
    search: '',
    sort: 'deadline'
  },
  opportunities: []
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

function setUserBadge() {
  const badge = document.getElementById('userIdBadge');
  if (badge) {
    badge.textContent = getUserId().slice(0, 10) + '...';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMetrics(data) {
  const total = document.getElementById('totalCount');
  const upcoming = document.getElementById('upcomingCount');
  const bookmark = document.getElementById('bookmarkCount');

  if (total) total.textContent = data.total ?? 0;
  if (upcoming) upcoming.textContent = data.upcoming ?? 0;
  if (bookmark) bookmark.textContent = data.bookmarks ?? 0;
}

function renderOpportunityCard(opportunity) {
  const tagHtml = (opportunity.tags || []).slice(0, 4).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const isFeatured = Number(opportunity.is_featured) === 1;
  const deadlineText = opportunity.deadline && opportunity.deadline !== '待定' ? `截止：${opportunity.deadline}` : '截止：待定';
  const sourceText = opportunity.source || '用户上报';
  const locationText = opportunity.location || '未知地点';

  const cardClass = isFeatured ? 'opportunity-card featured' : 'opportunity-card';
  const bookmarkClass = opportunity.is_bookmarked ? 'bookmark-btn active' : 'bookmark-btn';
  const bookmarkLabel = opportunity.is_bookmarked ? '已收藏' : '收藏';

  return `
    <article class="${cardClass}" data-id="${opportunity.id}">
      <div class="card-top">
        <span class="badge ${isFeatured ? 'orange' : 'green'}">${isFeatured ? '推荐' : escapeHtml(opportunity.category || '机会')}</span>
        <button class="${bookmarkClass}" data-opportunity-id="${opportunity.id}" type="button">${bookmarkLabel}</button>
      </div>
      <h3>${escapeHtml(opportunity.title || '未命名机会')}</h3>
      <div class="meta-grid">
        <span>${escapeHtml(opportunity.institution || '未知机构')}</span>
        <span>${escapeHtml(locationText)}</span>
        <span>${escapeHtml(deadlineText)}</span>
      </div>
      <p>${escapeHtml(opportunity.description || '暂无简介')}</p>
      <div class="tag-list">${tagHtml || '<span class="tag">校园成长</span>'}</div>
      <div class="card-bottom">
        <span>${escapeHtml(sourceText)}</span>
        <a class="card-link" href="${escapeHtml(opportunity.url || '#')}" target="_blank" rel="noreferrer">查看详情</a>
      </div>
    </article>
  `;
}

function renderOpportunities() {
  const list = document.getElementById('opportunityList');
  if (!list) return;

  if (!state.opportunities.length) {
    list.innerHTML = '<div class="empty-state">没有找到匹配的机会，换个关键词试试。</div>';
    return;
  }

  list.innerHTML = state.opportunities.map(renderOpportunityCard).join('');

  document.querySelectorAll('.bookmark-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const opportunityId = Number(button.dataset.opportunityId);
      await toggleBookmark(opportunityId);
    });
  });
}

async function fetchDashboard() {
  const queryString = new URLSearchParams({ user_id: getUserId() }).toString();
  const response = await fetch(`/api/dashboard?${queryString}`);
  const data = await response.json();
  renderMetrics(data);
}

async function fetchOpportunities() {
  const params = new URLSearchParams({
    user_id: getUserId(),
    category: state.filters.category,
    search: state.filters.search,
    sort: state.filters.sort
  });

  const response = await fetch(`/api/opportunities?${params.toString()}`);
  const data = await response.json();
  state.opportunities = Array.isArray(data) ? data : [];
  renderOpportunities();
}

async function submitOpportunity(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const payload = {
    user_id: getUserId(),
    title: form.title.value.trim(),
    category: form.category.value.trim(),
    institution: form.institution.value.trim(),
    location: form.location.value.trim(),
    type: form.type.value.trim(),
    description: form.description.value.trim(),
    deadline: form.deadline.value,
    url: form.url.value.trim(),
    source: form.source.value.trim(),
    tags: (form.tags.value || '').split(',').map(item => item.trim()).filter(Boolean)
  };

  const response = await fetch('/api/opportunities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || '提交失败');
    return;
  }

  form.reset();
  await fetchDashboard();
  await fetchOpportunities();
  alert('机会已成功上报，已加入列表。');
}

async function toggleBookmark(opportunityId) {
  const response = await fetch('/api/bookmark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: getUserId(),
      opportunity_id: opportunityId
    })
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || '收藏操作失败');
    return;
  }

  await fetchDashboard();
  await fetchOpportunities();
}

function bindControls() {
  const categoryFilter = document.getElementById('categoryFilter');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const refreshBtn = document.getElementById('refreshBtn');
  const jumpToForm = document.getElementById('jumpToForm');
  const form = document.getElementById('opportunityForm');

  categoryFilter.addEventListener('change', (event) => {
    state.filters.category = event.target.value;
    fetchOpportunities();
  });

  searchInput.addEventListener('input', (event) => {
    state.filters.search = event.target.value.trim();
    fetchOpportunities();
  });

  sortSelect.addEventListener('change', (event) => {
    state.filters.sort = event.target.value;
    fetchOpportunities();
  });

  refreshBtn.addEventListener('click', async () => {
    await fetchDashboard();
    await fetchOpportunities();
  });

  jumpToForm.addEventListener('click', () => {
    document.getElementById('titleInput').focus();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  form.addEventListener('submit', submitOpportunity);
}

document.addEventListener('DOMContentLoaded', async () => {
  setUserBadge();
  bindControls();
  await fetchDashboard();
  await fetchOpportunities();
});
