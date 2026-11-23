const SESSION_KEY = 'descomplica_clt_totem_session';

export function saveTotemSession(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Falha ao salvar sessão temporária:', e);
  }
}

export function loadTotemSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearTotemSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
