export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDateTime(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatSeconds(sec) {
  const total = Math.max(0, Math.ceil(sec));
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  if (mins > 0) {
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${rem}s`;
}
