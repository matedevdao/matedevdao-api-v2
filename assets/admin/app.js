// API Base URL (same origin)
const API_BASE = '';

// State
let token = localStorage.getItem('admin_token');
let editingId = null;

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const announcementForm = document.getElementById('announcement-form');
const formTitle = document.getElementById('form-title');
const cancelBtn = document.getElementById('cancel-btn');
const formError = document.getElementById('form-error');
const loading = document.getElementById('loading');
const announcementsTable = document.getElementById('announcements-table');
const announcementsTbody = document.getElementById('announcements-tbody');
const noAnnouncements = document.getElementById('no-announcements');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showDashboard();
  } else {
    showLogin();
  }

  // Event listeners
  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  announcementForm.addEventListener('submit', handleSubmitAnnouncement);
  cancelBtn.addEventListener('click', resetForm);
});

// Auth
async function handleLogin(e) {
  e.preventDefault();
  loginError.textContent = '';

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '로그인 실패');
    }

    token = data.token;
    localStorage.setItem('admin_token', token);
    showDashboard();
  } catch (error) {
    loginError.textContent = error.message;
  }
}

function handleLogout() {
  token = null;
  localStorage.removeItem('admin_token');
  showLogin();
}

// UI Navigation
function showLogin() {
  loginSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  loginForm.reset();
  loginError.textContent = '';
}

function showDashboard() {
  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  loadAnnouncements();
}

// Announcements CRUD
async function loadAnnouncements() {
  loading.classList.remove('hidden');
  announcementsTable.classList.add('hidden');
  noAnnouncements.classList.add('hidden');

  try {
    const response = await fetch(`${API_BASE}/admin/announcements`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) {
      handleLogout();
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '공지사항 로딩 실패');
    }

    loading.classList.add('hidden');

    if (data.announcements && data.announcements.length > 0) {
      renderAnnouncements(data.announcements);
      announcementsTable.classList.remove('hidden');
    } else {
      noAnnouncements.classList.remove('hidden');
    }
  } catch (error) {
    loading.textContent = `오류: ${error.message}`;
  }
}

function renderAnnouncements(announcements) {
  announcementsTbody.innerHTML = announcements.map(ann => `
    <tr>
      <td>${ann.id}</td>
      <td>${escapeHtml(ann.title)}</td>
      <td>
        <span class="status-badge ${ann.is_active ? 'status-active' : 'status-inactive'}">
          ${ann.is_active ? '활성' : '비활성'}
        </span>
      </td>
      <td>${ann.priority}</td>
      <td>${formatDate(ann.created_at)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-secondary btn-sm" onclick="editAnnouncement(${ann.id})">수정</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAnnouncement(${ann.id})">삭제</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function handleSubmitAnnouncement(e) {
  e.preventDefault();
  formError.textContent = '';

  const title = document.getElementById('title').value;
  const content = document.getElementById('content').value;
  const link_url = document.getElementById('link_url').value || null;
  const priority = parseInt(document.getElementById('priority').value) || 0;
  const is_active = document.getElementById('is_active').checked;

  const body = { title, content, link_url, priority };

  // Include is_active only for updates
  if (editingId) {
    body.is_active = is_active;
  }

  try {
    const url = editingId
      ? `${API_BASE}/announcements/${editingId}`
      : `${API_BASE}/announcements`;

    const method = editingId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '저장 실패');
    }

    resetForm();
    loadAnnouncements();
  } catch (error) {
    formError.textContent = error.message;
  }
}

async function editAnnouncement(id) {
  try {
    const response = await fetch(`${API_BASE}/admin/announcements`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    const announcement = data.announcements.find(a => a.id === id);

    if (!announcement) {
      alert('공지사항을 찾을 수 없습니다.');
      return;
    }

    editingId = id;
    formTitle.textContent = '공지사항 수정';
    document.getElementById('edit-id').value = id;
    document.getElementById('title').value = announcement.title;
    document.getElementById('content').value = announcement.content;
    document.getElementById('link_url').value = announcement.link_url || '';
    document.getElementById('priority').value = announcement.priority;
    document.getElementById('is_active').checked = announcement.is_active;
    cancelBtn.classList.remove('hidden');

    // Scroll to form
    document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    alert(`오류: ${error.message}`);
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/announcements/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '삭제 실패');
    }

    loadAnnouncements();
  } catch (error) {
    alert(`오류: ${error.message}`);
  }
}

function resetForm() {
  editingId = null;
  formTitle.textContent = '새 공지사항 작성';
  announcementForm.reset();
  document.getElementById('edit-id').value = '';
  document.getElementById('is_active').checked = true;
  cancelBtn.classList.add('hidden');
  formError.textContent = '';
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
