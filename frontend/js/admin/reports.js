import { apiRequest, getAdminToken } from '../shared/api.js';
import { escapeHtml, formatDateTime } from '../shared/utils.js';

export async function renderReports(container) {
  container.innerHTML = '<p>Carregando relatórios e estatísticas...</p>';

  const subjects = await apiRequest('/api/admin/subjects');

  container.innerHTML = `
    <div class="page-header">
      <h2>Resultados e Relatórios</h2>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-export-csv">Exportar CSV</button>
        <button type="button" class="btn btn-primary btn-sm" id="btn-export-xlsx">Exportar Excel (.xlsx)</button>
      </div>
    </div>

    <div class="card">
      <form id="report-filter-form" class="form-row" style="align-items: flex-end;">
        <div class="form-group" style="margin-bottom: 0;">
          <label for="rep-student">Pesquisar aluno</label>
          <input type="text" id="rep-student" class="form-control" placeholder="Nome do aluno..." />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label for="rep-subject">Tema</label>
          <select id="rep-subject" class="form-control">
            <option value="">Todos os temas</option>
            ${subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label for="rep-from">Data inicial</label>
          <input type="date" id="rep-from" class="form-control" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label for="rep-to">Data final</label>
          <input type="date" id="rep-to" class="form-control" />
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button type="submit" class="btn btn-primary">Filtrar</button>
          <button type="button" class="btn btn-secondary" id="btn-rep-clear">Limpar</button>
        </div>
      </form>
    </div>

    <div id="reports-dynamic-content"></div>

    <div id="attempt-detail-modal" class="modal-backdrop hidden">
      <div class="modal-box" style="max-width: 780px;">
        <div class="modal-header">
          <h3>Detalhes da Tentativa</h3>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-close-attempt-modal">Fechar</button>
        </div>
        <div id="attempt-detail-body"></div>
      </div>
    </div>
  `;

  function buildQueryParams() {
    const params = new URLSearchParams();
    const student = document.getElementById('rep-student').value.trim();
    const subject = document.getElementById('rep-subject').value;
    const from = document.getElementById('rep-from').value;
    const to = document.getElementById('rep-to').value;

    if (student) params.append('student_name', student);
    if (subject) params.append('subject_id', subject);
    if (from) params.append('date_from', from);
    if (to) params.append('date_to', to);
    return params.toString();
  }

  async function loadFilteredData() {
    const target = document.getElementById('reports-dynamic-content');
    target.innerHTML = '<p>Consultando histórico...</p>';

    const qs = buildQueryParams();
    const data = await apiRequest(`/api/admin/reports?${qs}`);

    target.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <span>Tentativas encontradas</span>
          <strong>${data.summary.total_attempts}</strong>
        </div>
        <div class="kpi-card">
          <span>Percentual geral de acertos</span>
          <strong>${data.summary.average_accuracy}%</strong>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom: 1rem;">Histórico de Tentativas</h3>
        ${
          data.attempts.length === 0
            ? '<p style="color: var(--color-muted);">Nenhum registro encontrado para os filtros aplicados.</p>'
            : `<div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th>Tema</th>
                      <th>Início</th>
                      <th>Acertos</th>
                      <th>Erros</th>
                      <th>Não resp.</th>
                      <th>Aproveitamento</th>
                      <th>Situação</th>
                      <th>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.attempts
                      .map(
                        (a) => `
                      <tr>
                        <td><strong>${escapeHtml(a.student_name)}</strong></td>
                        <td>${escapeHtml(a.subject_name_snapshot)}</td>
                        <td>${formatDateTime(a.started_at)}</td>
                        <td style="color: var(--color-success); font-weight:700;">${a.correct_answers}</td>
                        <td style="color: var(--color-error); font-weight:700;">${a.incorrect_answers}</td>
                        <td>${a.unanswered_questions}</td>
                        <td><strong>${Number(a.accuracy_percentage).toFixed(0)}%</strong></td>
                        <td>${
                          a.status === 'completed'
                            ? '<span class="badge badge-active">Concluída</span>'
                            : a.status === 'abandoned'
                            ? '<span class="badge badge-warning">Inatividade</span>'
                            : '<span class="badge badge-inactive">Em andamento</span>'
                        }</td>
                        <td>
                          <button type="button" class="btn btn-secondary btn-sm btn-view-attempt" data-id="${a.id}">Ver respostas</button>
                        </td>
                      </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>

      <div class="card">
        <h3 style="margin-bottom: 1rem;">Desempenho por Pergunta (no período/filtro)</h3>
        ${
          data.question_stats.length === 0
            ? '<p style="color: var(--color-muted);">Sem dados de respostas para exibir.</p>'
            : `<div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Pergunta</th>
                      <th>Respostas</th>
                      <th>Acertos</th>
                      <th>Erros</th>
                      <th>Taxa de acerto</th>
                      <th>Tempo médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.question_stats
                      .map(
                        (q) => `
                      <tr>
                        <td>${escapeHtml(q.statement)}</td>
                        <td>${q.total}</td>
                        <td>${q.corrects}</td>
                        <td>${q.errors}</td>
                        <td><strong>${q.accuracy_rate}%</strong></td>
                        <td>${q.avg_time_seconds !== null ? `${q.avg_time_seconds}s` : '-'}</td>
                      </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    `;

    target.querySelectorAll('.btn-view-attempt').forEach((btn) => {
      btn.addEventListener('click', () => openAttemptDetail(btn.dataset.id));
    });
  }

  async function openAttemptDetail(attemptId) {
    const modal = document.getElementById('attempt-detail-modal');
    const body = document.getElementById('attempt-detail-body');
    body.innerHTML = '<p>Carregando respostas...</p>';
    modal.classList.remove('hidden');

    const { attempt, answers } = await apiRequest(`/api/admin/reports/${attemptId}`);

    body.innerHTML = `
      <div style="margin-bottom: 1rem; padding: 0.85rem; background: var(--color-surface-subtle); border-radius: 8px;">
        <strong>Aluno:</strong> ${escapeHtml(attempt.student_name)} |
        <strong>Tema:</strong> ${escapeHtml(attempt.subject_name_snapshot)} |
        <strong>Aproveitamento:</strong> ${Number(attempt.accuracy_percentage).toFixed(0)}%
      </div>
      ${
        answers.length === 0
          ? '<p>Nenhuma resposta registrada nesta tentativa.</p>'
          : `<table class="data-table">
              <thead>
                <tr>
                  <th>Pergunta</th>
                  <th>Escolhida</th>
                  <th>Gabarito</th>
                  <th>Resultado</th>
                  <th>Tempo</th>
                </tr>
              </thead>
              <tbody>
                ${answers
                  .map(
                    (ans) => `
                  <tr>
                    <td>${escapeHtml(ans.statement_snapshot)}</td>
                    <td><strong>${ans.selected_option || '-'}</strong></td>
                    <td><strong>${ans.correct_option_snapshot}</strong></td>
                    <td>${
                      ans.is_unanswered
                        ? '<span class="badge badge-warning">Tempo esgotado</span>'
                        : ans.is_correct
                        ? '<span class="badge badge-active">Acerto</span>'
                        : '<span class="badge badge-error">Erro</span>'
                    }</td>
                    <td>${ans.response_time_seconds !== null ? `${ans.response_time_seconds}s` : '-'}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>`
      }
    `;
  }

  async function triggerExport(format) {
    const qs = buildQueryParams();
    const token = getAdminToken();
    const res = await fetch(`/api/admin/reports/export?format=${format}&${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert('Falha ao exportar relatório.');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-descomplica-clt.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  document.getElementById('report-filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadFilteredData();
  });

  document.getElementById('btn-rep-clear').addEventListener('click', () => {
    document.getElementById('report-filter-form').reset();
    loadFilteredData();
  });

  document.getElementById('btn-export-xlsx').addEventListener('click', () => triggerExport('xlsx'));
  document.getElementById('btn-export-csv').addEventListener('click', () => triggerExport('csv'));
  document.getElementById('btn-close-attempt-modal').addEventListener('click', () => {
    document.getElementById('attempt-detail-modal').classList.add('hidden');
  });

  await loadFilteredData();
}
