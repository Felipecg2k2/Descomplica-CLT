const TOKEN_KEY = 'descomplica_clt_admin_token';

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('descomplica_clt_admin_user');
}

export async function apiRequest(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getAdminToken();

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if ((response.status === 401 || response.status === 403) && endpoint.startsWith('/api/admin') && endpoint !== '/api/admin/login' && endpoint !== '/api/admin/logout') {
    clearAdminToken();
    window.location.href = '/admin/login';
    throw new Error(response.status === 403 ? 'Acesso administrativo não autorizado.' : 'Sessão expirada.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao processar solicitação.');
    }
    return data;
  }

  if (!response.ok) {
    throw new Error('Falha na comunicação com o servidor.');
  }

  return response;
}
