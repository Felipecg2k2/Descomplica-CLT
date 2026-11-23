import { apiRequest, getAdminToken, clearAdminToken } from '../shared/api.js';
import { renderDashboard } from './dashboard.js';
import { renderContentManager } from './content.js';
import { renderReports } from './reports.js';
import { renderSettings } from './settings.js';
import { renderBrandHeader, BRAND_CONFIG } from '/assets/brand/brandConfig.js';

const mainContent = document.getElementById('admin-content');
const navButtons = document.querySelectorAll('.nav-item');

const views = {
  dashboard: renderDashboard,
  content: renderContentManager,
  reports: renderReports,
  settings: renderSettings,
};

async function switchView(viewName) {
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  const renderer = views[viewName] || renderDashboard;
  try {
    await renderer(mainContent);
  } catch (err) {
    mainContent.innerHTML = `<div class="alert-banner">Erro ao carregar módulo: ${err.message}</div>`;
  }
}

async function initAdminPanel() {
  renderBrandHeader(document.getElementById('admin-brand-mount'), {
    showSubtitle: true,
    subtitleText: BRAND_CONFIG.adminSubtitle,
  });

  if (!getAdminToken()) {
    window.location.href = '/admin/login';
    return;
  }

  try {
    const { user } = await apiRequest('/api/admin/me');
    const userLabel = document.getElementById('admin-user-name');
    if (userLabel) {
      userLabel.textContent = user.email || user.name;
    }
  } catch (_) {
    clearAdminToken();
    window.location.href = '/admin/login';
    return;
  }

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('btn-admin-logout').addEventListener('click', async () => {
    const logoutBtn = document.getElementById('btn-admin-logout');
    if (logoutBtn) {
      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Saindo...';
    }
    try {
      await apiRequest('/api/admin/logout', { method: 'POST' });
    } catch (_) {
      // Encerra sessão localmente mesmo se o token já tiver expirado
    } finally {
      clearAdminToken();
      window.location.href = '/admin/login';
    }
  });

  await switchView('dashboard');
}

initAdminPanel();
