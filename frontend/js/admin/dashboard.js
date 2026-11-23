import { apiRequest } from '../shared/api.js';
import { escapeHtml, formatDateTime } from '../shared/utils.js';

export async function renderDashboard(container) {
  container.innerHTML = '<p>Carregando indicadores...</p>';

  const data = await apiRequest('/api/admin/dashboard');
  const { metrics, recent_attempts, top_subjects, most_missed_questions } = data;

  container.innerHTML = `
    <div class="page-header">
      <h2>Dashboard Geral</h2>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-dash">Atualizar dados</button>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span>Temas cadastrados</span>
        <strong>${metrics.total_subjects}</strong>
      </div>
      <div class="kpi-card">
        <span>Perguntas cadastradas</span>
        <strong>${metrics.total_questions}</strong>
      </div>
      <div class="kpi-card">
        <span>Alunos identificados</span>
        <strong>${metrics.unique_students}</strong>
      </div>
      <div class="kpi-card">
        <span>Tentativas realizadas</span>
        <strong>${metrics.total_attempts}</strong>
      </div>
      <div class="kpi-card">
        <span>Média geral de aproveitamento</span>
        <strong>${metrics.average_accuracy}%</strong>
      </div>
    </div>

    <div class="form-row">
      <div class="card">
        <h3 style="margin-bottom: 1rem;">Temas mais realizados</h3>
        ${
          top_subjects.length === 0
            ? '<p style="color: var(--color-muted);">Nenhuma atividade registrada ainda.</p>'
            : `<table class="data-table">
                <thead>
                  <tr><th>Tema</th><th>Tentativas</th><th>Média</th></tr>
                </thead>
                <tbody>
                  ${top_subjects
                    .map(
                      (s) => `
                    <tr>
                      <td><strong>${escapeHtml(s.name)}</strong></td>
                      <td>${s.attempts}</td>
                      <td>${s.avg_accuracy}%</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>`
        }
      </div>

      <div class="card">
        <h3 style="margin-bottom: 1rem;">Questões com maior índice de erros</h3>
        ${
          most_missed_questions.length === 0
            ? '<p style="color: var(--color-muted);">Sem respostas registradas ainda.</p>'
            : `<table class="data-table">
                <thead>
                  <tr><th>Enunciado</th><th>Erros</th><th>Taxa de erro</th></tr>
                </thead>
                <tbody>
                  ${most_missed_questions
                    .map(
                      (q) => `
                    <tr>
                      <td>${escapeHtml(q.statement.slice(0, 75))}${q.statement.length > 75 ? '...' : ''}</td>
                      <td>${q.errors} / ${q.total}</td>
                      <td><span class="badge badge-error">${q.error_rate}%</span></td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>`
        }
      </div>
    </div>

    <div class="card">
      <h3 style="margin-bottom: 1rem;">Atividades recentes no totem</h3>
      ${
        recent_attempts.length === 0
          ? '<p style="color: var(--color-muted);">Nenhuma tentativa realizada até o momento.</p>'
          : `<div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Tema</th>
                    <th>Data/Hora</th>
                    <th>Acertos</th>
                    <th>Aproveitamento</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  ${recent_attempts
                    .map(
                      (a) => `
                    <tr>
                      <td><strong>${escapeHtml(a.student_name)}</strong></td>
                      <td>${escapeHtml(a.subject_name_snapshot)}</td>
                      <td>${formatDateTime(a.started_at)}</td>
                      <td>${a.correct_answers} / ${a.total_questions}</td>
                      <td><strong>${Number(a.accuracy_percentage).toFixed(0)}%</strong></td>
                      <td>${
                        a.status === 'completed'
                          ? '<span class="badge badge-active">Concluída</span>'
                          : a.status === 'abandoned'
                          ? '<span class="badge badge-warning">Inatividade</span>'
                          : '<span class="badge badge-inactive">Em andamento</span>'
                      }</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
      }
    </div>
  `;

  document.getElementById('btn-refresh-dash').addEventListener('click', () => renderDashboard(container));
}
