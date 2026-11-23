import { apiRequest } from '../shared/api.js';

export async function renderSettings(container) {
  container.innerHTML = '<p>Carregando configurações...</p>';
  const settings = await apiRequest('/api/admin/settings');

  container.innerHTML = `
    <div class="page-header">
      <h2>Configurações Gerais do Totem</h2>
    </div>

    <div class="card" style="max-width: 680px;">
      <h3 style="margin-bottom: 0.4rem;">Temporizadores do quiz</h3>
      <p style="color: var(--color-text-secondary); margin-bottom: 1.35rem; font-size: 0.94rem;">
        Configure individualmente cada temporizador em segundos. As alterações passam a valer para todas as novas sessões iniciadas no totem, sem interromper alunos que já estejam respondendo.
      </p>

      <form id="settings-form" novalidate>
        <div class="form-group">
          <label for="set-question-time">Tempo para responder cada questão (em segundos) *</label>
          <input type="number" id="set-question-time" class="form-control" min="5" max="600" value="${settings.question_time_seconds ?? 60}" required />
          <small style="color: var(--color-muted);">
            Controla quanto tempo o aluno tem para responder cada questão (padrão: 60 segundos).
          </small>
        </div>

        <div class="form-group">
          <label for="set-feedback-time">Tempo de feedback das questões (em segundos) *</label>
          <input type="number" id="set-feedback-time" class="form-control" min="3" max="300" value="${settings.feedback_time_seconds ?? 30}" required />
          <small style="color: var(--color-muted);">
            Controla quanto tempo a explicação de cada resposta permanece na tela antes de avançar automaticamente (padrão: 30 segundos).
          </small>
        </div>

        <div class="form-group">
          <label for="set-inactivity-time">Tempo total de inatividade (em segundos) *</label>
          <input type="number" id="set-inactivity-time" class="form-control" min="10" max="900" value="${settings.inactivity_time_seconds ?? 90}" required />
          <small style="color: var(--color-muted);">
            Tempo máximo sem interação do aluno antes do encerramento automático da sessão (padrão: 90 segundos).
          </small>
        </div>

        <div class="form-group">
          <label for="set-inactivity-warning-time">Antecedência do aviso de inatividade (em segundos) *</label>
          <input type="number" id="set-inactivity-warning-time" class="form-control" min="3" max="300" value="${settings.inactivity_warning_seconds ?? 15}" required />
          <small style="color: var(--color-muted);">
            Quantidade de segundos antes do encerramento em que será exibido o aviso 'Você está aí?' ao aluno (padrão: 15 segundos).
          </small>
        </div>

        <div class="form-group">
          <label for="set-result-time">Tempo de exibição do resultado final (em segundos) *</label>
          <input type="number" id="set-result-time" class="form-control" min="5" max="600" value="${settings.result_time_seconds ?? 60}" required />
          <small style="color: var(--color-muted);">
            Controla quanto tempo a tela de resultado final permanece disponível antes de retornar automaticamente à tela inicial (padrão: 60 segundos).
          </small>
        </div>

        <div class="form-group" style="margin-top: 1.25rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="set-auto-timeout" ${settings.auto_timeout_enabled !== false ? 'checked' : ''} style="width: 18px; height: 18px;" />
            <span>Encerramento automático por inatividade global ativado</span>
          </label>
        </div>

        <div id="settings-feedback" class="hidden" style="margin-bottom: 1rem; padding: 0.75rem; border-radius: 8px; font-weight: 600;"></div>

        <button type="submit" class="btn btn-primary" id="btn-save-settings" style="min-height: 44px;">Salvar configurações</button>
      </form>
    </div>
  `;

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('settings-feedback');
    const btn = document.getElementById('btn-save-settings');

    const showFeedback = (msg, isError) => {
      fb.textContent = msg;
      fb.style.backgroundColor = isError ? 'var(--color-error-bg)' : 'var(--color-success-bg)';
      fb.style.color = isError ? 'var(--color-error)' : 'var(--color-success)';
      fb.classList.remove('hidden');
    };

    fb.classList.add('hidden');

    const qTime = Number(document.getElementById('set-question-time').value);
    const fTime = Number(document.getElementById('set-feedback-time').value);
    const iTime = Number(document.getElementById('set-inactivity-time').value);
    const wTime = Number(document.getElementById('set-inactivity-warning-time').value);
    const rTime = Number(document.getElementById('set-result-time').value);

    if (!Number.isInteger(qTime) || qTime < 5 || qTime > 600) {
      return showFeedback('O tempo para responder cada questão deve ser um número inteiro entre 5 e 600 segundos.', true);
    }
    if (!Number.isInteger(fTime) || fTime < 3 || fTime > 300) {
      return showFeedback('O tempo de feedback das questões deve ser um número inteiro entre 3 e 300 segundos.', true);
    }
    if (!Number.isInteger(iTime) || iTime < 10 || iTime > 900) {
      return showFeedback('O tempo total de inatividade deve ser um número inteiro entre 10 e 900 segundos.', true);
    }
    if (!Number.isInteger(wTime) || wTime < 3 || wTime > 300) {
      return showFeedback('A antecedência do aviso de inatividade deve ser um número inteiro entre 3 e 300 segundos.', true);
    }
    if (wTime >= iTime) {
      return showFeedback(
        `Configuração inválida: a antecedência do aviso (${wTime}s) deve ser menor que o tempo total de inatividade (${iTime}s).`,
        true
      );
    }
    if (!Number.isInteger(rTime) || rTime < 5 || rTime > 600) {
      return showFeedback('O tempo de exibição do resultado final deve ser um número inteiro entre 5 e 600 segundos.', true);
    }

    btn.disabled = true;

    try {
      await apiRequest('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          question_time_seconds: qTime,
          feedback_time_seconds: fTime,
          inactivity_time_seconds: iTime,
          inactivity_warning_seconds: wTime,
          result_time_seconds: rTime,
          auto_timeout_enabled: document.getElementById('set-auto-timeout').checked,
        }),
      });

      showFeedback('Configurações atualizadas com sucesso!', false);
    } catch (err) {
      showFeedback(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });
}
