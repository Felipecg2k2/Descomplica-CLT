import { apiRequest, getAdminToken } from '../shared/api.js';
import { escapeHtml } from '../shared/utils.js';

const expandedThemes = new Set();
let searchFilter = '';

const PENCIL_ICON_SVG = `<svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;

function renderQuestionFeedbackPreview(q) {
  const mode = q.feedback_mode === 'individual' ? 'individual' : 'general';
  if (mode === 'individual') {
    const wrongOpts = ['A', 'B', 'C', 'D'].filter((opt) => opt !== q.correct_option);
    const itemsHtml = wrongOpts
      .map((opt) => {
        const val = q[`feedback_incorrect_${opt.toLowerCase()}`] || '(Não preenchido)';
        return `<div style="margin-top: 0.25rem;"><strong>Alt. ${opt}:</strong> ${escapeHtml(val)}</div>`;
      })
      .join('');

    return `
      <div class="feedback-preview-grid">
        <div class="feedback-pill-box fb-ok">
          <strong>Feedback de acerto:</strong> ${escapeHtml(q.feedback_correct)}
        </div>
        <div class="feedback-pill-box fb-err">
          <strong>Feedbacks individuais de erro:</strong>
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  return `
    <div class="feedback-preview-grid">
      <div class="feedback-pill-box fb-ok">
        <strong>Feedback de acerto:</strong> ${escapeHtml(q.feedback_correct)}
      </div>
      <div class="feedback-pill-box fb-err">
        <strong>Feedback geral de erro:</strong> ${escapeHtml(q.feedback_incorrect)}
      </div>
    </div>
  `;
}

export async function renderContentManager(container) {
  container.innerHTML = '<p>Carregando temas e perguntas...</p>';

  const [subjects, allQuestions] = await Promise.all([
    apiRequest('/api/admin/subjects'),
    apiRequest('/api/admin/questions'),
  ]);

  const questionsBySubject = {};
  subjects.forEach((s) => {
    questionsBySubject[s.id] = [];
  });
  allQuestions.forEach((q) => {
    if (!questionsBySubject[q.subject_id]) {
      questionsBySubject[q.subject_id] = [];
    }
    questionsBySubject[q.subject_id].push(q);
  });

  if (subjects.length === 1 && expandedThemes.size === 0) {
    expandedThemes.add(subjects[0].id);
  }

  const filteredSubjects = subjects.filter((s) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.trim().toLowerCase();
    const matchTheme =
      s.name.toLowerCase().includes(term) ||
      (s.description && s.description.toLowerCase().includes(term));
    const matchQ = (questionsBySubject[s.id] || []).some((q) =>
      q.statement.toLowerCase().includes(term)
    );
    return matchTheme || matchQ;
  });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Gerenciar conteúdos</h2>
        <p style="font-size: 0.92rem; color: var(--color-text-secondary);">
          Organize seus temas e respectivas perguntas em um único lugar ou importe diretamente de um arquivo Word (.docx).
        </p>
      </div>
      <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-download-docx-template" style="min-height: 44px;">
          ⬇ Baixar modelo (.docx)
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-open-docx-import" style="min-height: 44px;">
          ⬆ Importar Word (.docx)
        </button>
        <button type="button" class="btn btn-primary btn-sm" id="btn-new-theme" style="min-height: 44px;">
          + Novo tema
        </button>
      </div>
    </div>

    <div class="card" style="padding: 1rem 1.25rem;">
      <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;">
        <input
          type="text"
          id="content-search-input"
          class="form-control"
          style="max-width: 420px;"
          placeholder="Buscar tema ou enunciado de pergunta..."
          value="${escapeHtml(searchFilter)}"
        />
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-expand-all" style="min-height: 42px;">Expandir todos</button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-collapse-all" style="min-height: 42px;">Recolher todos</button>
        </div>
      </div>
    </div>

    <div id="themes-accordion-container">
      ${
        filteredSubjects.length === 0
          ? `<div class="card">
              <p style="color: var(--color-muted);">
                ${
                  subjects.length === 0
                    ? 'Nenhum tema cadastrado ainda. Clique em "+ Novo tema" ou importe um arquivo Word (.docx) para começar.'
                    : 'Nenhum tema ou pergunta corresponde à busca informada.'
                }
              </p>
            </div>`
          : filteredSubjects
              .map((theme) => {
                const isExpanded = expandedThemes.has(theme.id);
                const themeQuestions = questionsBySubject[theme.id] || [];

                return `
                  <div class="theme-accordion-card" data-theme-id="${theme.id}">
                    <div class="theme-accordion-header ${isExpanded ? 'is-expanded' : ''}">
                      <div class="theme-header-main">
                        <img
                          src="${theme.image_url ? escapeHtml(theme.image_url) : '/assets/placeholder-subject.svg'}"
                          alt="${escapeHtml(theme.name)}"
                          class="theme-thumb"
                          onerror="this.src='/assets/placeholder-subject.svg'"
                        />
                        <div style="min-width: 0; flex: 1;">
                          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <h3 style="font-size: 1.15rem; word-break: break-word;">${escapeHtml(theme.name)}</h3>
                            ${
                              theme.is_active
                                ? '<span class="badge badge-active">Ativo</span>'
                                : '<span class="badge badge-inactive">Inativo</span>'
                            }
                            <span class="badge badge-inactive">
                              ${theme.active_questions} ativa(s) / ${themeQuestions.length} pergunta(s)
                            </span>
                          </div>
                          ${
                            theme.description
                              ? `<p style="font-size: 0.9rem; color: var(--color-text-secondary); margin-top: 0.25rem; word-break: break-word;">${escapeHtml(theme.description)}</p>`
                              : ''
                          }
                        </div>
                      </div>

                      <div class="table-actions">
                        <button type="button" class="btn btn-primary btn-sm btn-toggle-expand" data-id="${theme.id}" style="min-height: 42px;">
                          ${isExpanded ? '▲ Ocultar perguntas' : `▼ Ver perguntas (${themeQuestions.length})`}
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm btn-add-q-inline" data-id="${theme.id}" style="min-height: 42px;">
                          + Pergunta
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm btn-edit-theme" data-id="${theme.id}" style="min-height: 42px;">
                          ${PENCIL_ICON_SVG} <span>Editar tema</span>
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm btn-toggle-theme" data-id="${theme.id}" data-active="${theme.is_active}" style="min-height: 42px;">
                          ${theme.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button type="button" class="btn btn-danger btn-sm btn-del-theme" data-id="${theme.id}" style="min-height: 42px;">
                          Excluir
                        </button>
                      </div>
                    </div>

                    ${
                      isExpanded
                        ? `<div class="theme-accordion-body">
                            <div class="theme-questions-toolbar">
                              <span style="font-size: 0.88rem; color: var(--color-text-secondary);">
                                Use os botões <strong>↑ Subir / ↓ Descer</strong> ou arraste pelo ícone <strong>☰</strong> para alterar a ordem.
                              </span>
                              <button type="button" class="btn btn-primary btn-sm btn-add-q-inline" data-id="${theme.id}" style="min-height: 42px;">
                                + Adicionar pergunta neste tema
                              </button>
                            </div>

                            <div class="sortable-questions-group" data-subject-id="${theme.id}">
                              ${
                                themeQuestions.length === 0
                                  ? '<p style="color: var(--color-muted); padding: 0.75rem; background: var(--color-surface); border-radius: 8px; border: 1px dashed var(--color-border);">Este tema ainda não possui perguntas. Clique em "+ Adicionar pergunta neste tema".</p>'
                                  : themeQuestions
                                      .map(
                                        (q, idx) => `
                                      <div class="question-item-card" draggable="true" data-id="${q.id}" data-subject-id="${theme.id}">
                                        <div class="question-card-content">
                                          <span class="drag-handle" title="Arraste para reordenar" aria-label="Reordenar pergunta ${idx + 1}">☰ #${idx + 1}</span>
                                          <div class="question-card-body">
                                            <div style="margin-bottom: 0.45rem; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center;">
                                              ${
                                                q.is_active
                                                  ? '<span class="badge badge-active">Ativa</span>'
                                                  : '<span class="badge badge-inactive">Inativa</span>'
                                              }
                                              <span class="badge badge-inactive">Correta: ${q.correct_option}</span>
                                              <span class="badge badge-inactive">
                                                ${q.feedback_mode === 'individual' ? 'Feedback por alternativa' : 'Feedback geral'}
                                              </span>
                                              ${
                                                q.needs_feedback_review
                                                  ? '<span class="badge badge-warning">Revisar feedbacks</span>'
                                                  : ''
                                              }
                                            </div>
                                            <p style="font-weight: 700; margin-bottom: 0.5rem;">${escapeHtml(q.statement)}</p>
                                            <div style="font-size: 0.88rem; color: var(--color-text-secondary); display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.35rem;">
                                              <div><strong>A)</strong> ${escapeHtml(q.option_a)}</div>
                                              <div><strong>B)</strong> ${escapeHtml(q.option_b)}</div>
                                              <div><strong>C)</strong> ${escapeHtml(q.option_c)}</div>
                                              <div><strong>D)</strong> ${escapeHtml(q.option_d)}</div>
                                            </div>
                                            ${renderQuestionFeedbackPreview(q)}
                                          </div>
                                        </div>

                                        <div class="question-card-actions">
                                          <div class="question-order-controls">
                                            <button type="button" class="btn btn-secondary btn-sm btn-move-up" data-subject-id="${theme.id}" data-index="${idx}" ${idx === 0 ? 'disabled' : ''} title="Mover para cima">↑ Subir</button>
                                            <button type="button" class="btn btn-secondary btn-sm btn-move-down" data-subject-id="${theme.id}" data-index="${idx}" ${idx === themeQuestions.length - 1 ? 'disabled' : ''} title="Mover para baixo">↓ Descer</button>
                                          </div>
                                          <button type="button" class="btn btn-secondary btn-sm btn-edit-q" data-id="${q.id}" aria-label="Editar pergunta">
                                            ${PENCIL_ICON_SVG}
                                            <span>Editar</span>
                                          </button>
                                          <button type="button" class="btn btn-secondary btn-sm btn-dup-q" data-id="${q.id}">Duplicar</button>
                                          <button type="button" class="btn btn-secondary btn-sm btn-toggle-q" data-id="${q.id}" data-active="${q.is_active}">
                                            ${q.is_active ? 'Desativar' : 'Ativar'}
                                          </button>
                                          <button type="button" class="btn btn-danger btn-sm btn-del-q" data-id="${q.id}">Excluir</button>
                                        </div>
                                      </div>`
                                      )
                                      .join('')
                              }
                            </div>
                          </div>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')
      }
    </div>

    <!-- MODAL: CRIAR / EDITAR TEMA -->
    <div id="theme-modal" class="modal-backdrop hidden">
      <div class="modal-box">
        <div class="modal-header">
          <h3 id="theme-modal-title">Novo Tema</h3>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-close-theme-modal" style="min-height: 40px;">Fechar</button>
        </div>
        <form id="theme-form">
          <input type="hidden" id="theme-id" />
          <div class="form-group">
            <label for="theme-name">Nome do tema *</label>
            <input type="text" id="theme-name" class="form-control" placeholder="Ex.: Jornada de trabalho e controle de ponto" required />
          </div>
          <div class="form-group">
            <label for="theme-desc">Descrição (opcional)</label>
            <textarea id="theme-desc" class="form-control" rows="3" placeholder="Breve resumo exibido ao aluno antes de iniciar o quiz..."></textarea>
          </div>
          <div class="form-group">
            <label for="theme-image">Imagem do tema (opcional - JPG, PNG, WEBP)</label>
            <input type="file" id="theme-image" class="form-control" accept="image/*" />
          </div>
          <div class="form-group" id="theme-remove-img-group" style="display:none;">
            <label><input type="checkbox" id="theme-remove-img" /> Remover imagem atual</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" id="theme-active" checked /> Tema ativo (visível no totem)</label>
          </div>
          <div id="theme-form-error" class="alert-banner hidden" style="margin-bottom: 1rem;"></div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-theme">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btn-save-theme">Salvar tema</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: CRIAR / EDITAR PERGUNTA (COM FEEDBACK GERAL OU INDIVIDUAL POR ALTERNATIVA) -->
    <div id="question-modal" class="modal-backdrop hidden">
      <div class="modal-box">
        <div class="modal-header">
          <h3 id="question-modal-title">Nova Pergunta</h3>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-close-q-modal" style="min-height: 40px;">Fechar</button>
        </div>
        <form id="question-form" novalidate>
          <input type="hidden" id="q-id" />
          <div class="form-group">
            <label for="q-subject">Tema vinculado *</label>
            <select id="q-subject" class="form-control" required>
              ${subjects
                .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="q-statement">Enunciado da pergunta *</label>
            <textarea id="q-statement" class="form-control" rows="3" required></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="q-opt-a">Alternativa A *</label>
              <input type="text" id="q-opt-a" class="form-control" required />
            </div>
            <div class="form-group">
              <label for="q-opt-b">Alternativa B *</label>
              <input type="text" id="q-opt-b" class="form-control" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="q-opt-c">Alternativa C *</label>
              <input type="text" id="q-opt-c" class="form-control" required />
            </div>
            <div class="form-group">
              <label for="q-opt-d">Alternativa D *</label>
              <input type="text" id="q-opt-d" class="form-control" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="q-correct">Alternativa correta *</label>
              <select id="q-correct" class="form-control" required>
                <option value="A">Alternativa A</option>
                <option value="B">Alternativa B</option>
                <option value="C">Alternativa C</option>
                <option value="D">Alternativa D</option>
              </select>
            </div>
            <div class="form-group" style="justify-content: center;">
              <label style="margin-top: 1.5rem;"><input type="checkbox" id="q-active" checked /> Pergunta ativa no quiz</label>
            </div>
          </div>

          <div class="form-group">
            <label for="q-fb-correct">Feedback para resposta correta (obrigatório) *</label>
            <textarea id="q-fb-correct" class="form-control" rows="2" placeholder="Explicação exibida quando o aluno acertar a questão..." required></textarea>
          </div>

          <div class="form-group">
            <label>Tipo de feedback para respostas incorretas *</label>
            <div class="feedback-mode-selector">
              <label class="feedback-mode-option">
                <input type="radio" name="q-feedback-mode" value="general" checked />
                <div>
                  <strong>Feedback geral</strong>
                  <div style="font-size: 0.82rem; color: var(--color-text-secondary);">
                    Mesma explicação para qualquer alternativa errada.
                  </div>
                </div>
              </label>
              <label class="feedback-mode-option">
                <input type="radio" name="q-feedback-mode" value="individual" />
                <div>
                  <strong>Feedback individual por alternativa</strong>
                  <div style="font-size: 0.82rem; color: var(--color-text-secondary);">
                    Explicação específica para cada alternativa errada escolhida.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- Modo 1: Feedback Geral -->
          <div id="q-fb-general-group" class="form-group">
            <label for="q-fb-incorrect">Feedback geral para resposta incorreta *</label>
            <textarea id="q-fb-incorrect" class="form-control" rows="2" placeholder="Explicação exibida quando o aluno selecionar qualquer alternativa incorreta..."></textarea>
          </div>

          <!-- Modo 2: Feedback Individual por Alternativa Incorreta -->
          <div id="q-fb-individual-group" class="hidden" style="padding: 1rem; background: var(--color-surface-subtle); border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 1rem;">
            <p style="font-size: 0.86rem; color: var(--color-text-secondary); margin-bottom: 0.75rem;">
              Preencha o feedback específico para cada alternativa <strong>incorreta</strong> abaixo (a alternativa marcada como correta já utiliza o feedback de acerto acima):
            </p>
            <div class="form-group" id="q-ind-wrap-A">
              <label for="q-fb-ind-a">Feedback caso o aluno marque a Alternativa A *</label>
              <textarea id="q-fb-ind-a" class="form-control" rows="2" placeholder="Explique por que a alternativa A está incorreta..."></textarea>
            </div>
            <div class="form-group" id="q-ind-wrap-B">
              <label for="q-fb-ind-b">Feedback caso o aluno marque a Alternativa B *</label>
              <textarea id="q-fb-ind-b" class="form-control" rows="2" placeholder="Explique por que a alternativa B está incorreta..."></textarea>
            </div>
            <div class="form-group" id="q-ind-wrap-C">
              <label for="q-fb-ind-c">Feedback caso o aluno marque a Alternativa C *</label>
              <textarea id="q-fb-ind-c" class="form-control" rows="2" placeholder="Explique por que a alternativa C está incorreta..."></textarea>
            </div>
            <div class="form-group" id="q-ind-wrap-D" style="margin-bottom: 0;">
              <label for="q-fb-ind-d">Feedback caso o aluno marque a Alternativa D *</label>
              <textarea id="q-fb-ind-d" class="form-control" rows="2" placeholder="Explique por que a alternativa D está incorreta..."></textarea>
            </div>
          </div>

          <div id="q-form-error" class="alert-banner hidden" style="margin-bottom: 1rem;"></div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-q">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btn-save-q">Salvar pergunta</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: IMPORTAÇÃO DE QUESTÕES POR WORD (.DOCX) -->
    <div id="docx-import-modal" class="modal-backdrop hidden">
      <div class="modal-box" style="max-width: 860px;">
        <div class="modal-header">
          <h3>Importar questões por arquivo Word (.docx)</h3>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-close-docx-modal" style="min-height: 40px;">Fechar</button>
        </div>

        <p style="font-size: 0.92rem; color: var(--color-text-secondary); margin-bottom: 1rem;">
          Envie um documento Word (<strong>.docx</strong>) preenchido no formato padrão. O sistema identificará automaticamente o tema, as perguntas novas e eventuais perguntas já existentes antes de salvar.
        </p>

        <div class="form-row" style="align-items: flex-end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label for="docx-file-input">Arquivo Word (.docx) *</label>
            <input type="file" id="docx-file-input" class="form-control" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label for="docx-override-subject">Tema de destino (opcional — detecta automático pelo Word)</label>
            <select id="docx-override-subject" class="form-control">
              <option value="">Detectar automaticamente pelo marcador TEMA:</option>
              ${subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="margin-top: 1rem; display: flex; gap: 0.65rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary btn-sm" id="btn-analyze-docx" style="min-height: 42px;">Analisar documento e gerar prévia</button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-modal-download-template" style="min-height: 42px;">⬇ Baixar modelo (.docx)</button>
        </div>

        <div id="docx-preview-container" style="margin-top: 1.25rem;"></div>
      </div>
    </div>
  `;

  // Busca instantânea
  const searchInput = document.getElementById('content-search-input');
  searchInput.addEventListener('input', (e) => {
    searchFilter = e.target.value;
    renderContentManager(container);
    const updatedInput = document.getElementById('content-search-input');
    if (updatedInput) {
      updatedInput.focus();
      updatedInput.setSelectionRange(updatedInput.value.length, updatedInput.value.length);
    }
  });

  document.getElementById('btn-expand-all').addEventListener('click', () => {
    subjects.forEach((s) => expandedThemes.add(s.id));
    renderContentManager(container);
  });

  document.getElementById('btn-collapse-all').addEventListener('click', () => {
    expandedThemes.clear();
    renderContentManager(container);
  });

  container.querySelectorAll('.btn-toggle-expand').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (expandedThemes.has(id)) expandedThemes.delete(id);
      else expandedThemes.add(id);
      renderContentManager(container);
    });
  });

  async function triggerTemplateDownload() {
    const token = getAdminToken();
    const res = await fetch('/api/admin/questions/import/template-docx', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert('Não foi possível baixar o modelo Word.');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-questoes-descomplica-clt.docx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  document.getElementById('btn-download-docx-template').addEventListener('click', triggerTemplateDownload);
  document.getElementById('btn-modal-download-template').addEventListener('click', triggerTemplateDownload);

  // ==================== CRUD DE TEMAS ====================
  const themeModal = document.getElementById('theme-modal');
  const themeForm = document.getElementById('theme-form');

  function openThemeModal(theme = null) {
    document.getElementById('theme-form-error').classList.add('hidden');
    themeForm.reset();
    if (theme) {
      document.getElementById('theme-modal-title').textContent = 'Editar Tema';
      document.getElementById('theme-id').value = theme.id;
      document.getElementById('theme-name').value = theme.name;
      document.getElementById('theme-desc').value = theme.description || '';
      document.getElementById('theme-active').checked = theme.is_active;
      document.getElementById('theme-remove-img-group').style.display = theme.image_url ? 'block' : 'none';
    } else {
      document.getElementById('theme-modal-title').textContent = 'Novo Tema';
      document.getElementById('theme-id').value = '';
      document.getElementById('theme-active').checked = true;
      document.getElementById('theme-remove-img-group').style.display = 'none';
    }
    themeModal.classList.remove('hidden');
  }

  document.getElementById('btn-new-theme').addEventListener('click', () => openThemeModal());
  document.getElementById('btn-close-theme-modal').addEventListener('click', () => themeModal.classList.add('hidden'));
  document.getElementById('btn-cancel-theme').addEventListener('click', () => themeModal.classList.add('hidden'));

  container.querySelectorAll('.btn-edit-theme').forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = subjects.find((s) => s.id === btn.dataset.id);
      if (theme) openThemeModal(theme);
    });
  });

  container.querySelectorAll('.btn-toggle-theme').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const currentActive = btn.dataset.active === 'true';
      await apiRequest(`/api/admin/subjects/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !currentActive }),
      });
      renderContentManager(container);
    });
  });

  container.querySelectorAll('.btn-del-theme').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const theme = subjects.find((s) => s.id === btn.dataset.id);
      const qCount = (questionsBySubject[theme.id] || []).length;
      const msg =
        qCount > 0 || theme.total_attempts > 0
          ? `Atenção: O tema "${theme.name}" possui ${qCount} pergunta(s) e ${theme.total_attempts} tentativa(s) registrada(s). As perguntas vinculadas serão removidas, mas os relatórios históricos serão preservados. Deseja realmente excluir?`
          : `Deseja excluir o tema "${theme.name}"?`;

      if (!confirm(msg)) return;
      await apiRequest(`/api/admin/subjects/${theme.id}`, { method: 'DELETE' });
      expandedThemes.delete(theme.id);
      renderContentManager(container);
    });
  });

  themeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('theme-id').value;
    const errBox = document.getElementById('theme-form-error');
    const saveBtn = document.getElementById('btn-save-theme');

    errBox.classList.add('hidden');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    try {
      const formData = new FormData();
      formData.append('name', document.getElementById('theme-name').value);
      formData.append('description', document.getElementById('theme-desc').value);
      formData.append('is_active', document.getElementById('theme-active').checked);
      formData.append('remove_image', document.getElementById('theme-remove-img').checked);

      const fileInput = document.getElementById('theme-image');
      if (fileInput.files[0]) {
        formData.append('image', fileInput.files[0]);
      }

      if (id) {
        await apiRequest(`/api/admin/subjects/${id}`, { method: 'PUT', body: formData });
        expandedThemes.add(id);
      } else {
        const created = await apiRequest('/api/admin/subjects', { method: 'POST', body: formData });
        if (created && created.id) expandedThemes.add(created.id);
      }

      themeModal.classList.add('hidden');
      renderContentManager(container);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salvar tema';
    }
  });

  // ==================== CRUD E ORDENAÇÃO DE PERGUNTAS ====================
  const qModal = document.getElementById('question-modal');
  const qForm = document.getElementById('question-form');
  const correctSelect = document.getElementById('q-correct');

  function getSelectedFeedbackMode() {
    const checked = qForm.querySelector('input[name="q-feedback-mode"]:checked');
    return checked ? checked.value : 'general';
  }

  function syncFeedbackModeUI() {
    const mode = getSelectedFeedbackMode();
    const correctOpt = correctSelect.value;
    const generalGroup = document.getElementById('q-fb-general-group');
    const indGroup = document.getElementById('q-fb-individual-group');

    if (mode === 'individual') {
      generalGroup.classList.add('hidden');
      indGroup.classList.remove('hidden');
      ['A', 'B', 'C', 'D'].forEach((opt) => {
        const wrap = document.getElementById(`q-ind-wrap-${opt}`);
        if (wrap) {
          wrap.classList.toggle('hidden', opt === correctOpt);
        }
      });
    } else {
      generalGroup.classList.remove('hidden');
      indGroup.classList.add('hidden');
    }
  }

  qForm.querySelectorAll('input[name="q-feedback-mode"]').forEach((radio) => {
    radio.addEventListener('change', syncFeedbackModeUI);
  });
  correctSelect.addEventListener('change', syncFeedbackModeUI);

  function openQuestionModal({ question = null, presetSubjectId = null } = {}) {
    if (subjects.length === 0) {
      alert('Crie um tema antes de adicionar perguntas.');
      return;
    }
    document.getElementById('q-form-error').classList.add('hidden');
    qForm.reset();

    if (question) {
      document.getElementById('question-modal-title').textContent = 'Editar Pergunta';
      document.getElementById('q-id').value = question.id;
      document.getElementById('q-subject').value = question.subject_id;
      document.getElementById('q-statement').value = question.statement;
      document.getElementById('q-opt-a').value = question.option_a;
      document.getElementById('q-opt-b').value = question.option_b;
      document.getElementById('q-opt-c').value = question.option_c;
      document.getElementById('q-opt-d').value = question.option_d;
      document.getElementById('q-correct').value = question.correct_option;
      document.getElementById('q-fb-correct').value = question.feedback_correct || question.explanation || '';

      const mode = question.feedback_mode === 'individual' ? 'individual' : 'general';
      const radioToSelect = qForm.querySelector(`input[name="q-feedback-mode"][value="${mode}"]`);
      if (radioToSelect) radioToSelect.checked = true;

      document.getElementById('q-fb-incorrect').value = question.feedback_incorrect || question.explanation || '';
      document.getElementById('q-fb-ind-a').value = question.feedback_incorrect_a || '';
      document.getElementById('q-fb-ind-b').value = question.feedback_incorrect_b || '';
      document.getElementById('q-fb-ind-c').value = question.feedback_incorrect_c || '';
      document.getElementById('q-fb-ind-d').value = question.feedback_incorrect_d || '';
      document.getElementById('q-active').checked = question.is_active;
    } else {
      document.getElementById('question-modal-title').textContent = 'Nova Pergunta';
      document.getElementById('q-id').value = '';
      document.getElementById('q-subject').value = presetSubjectId || subjects[0].id;
      document.getElementById('q-correct').value = 'A';
      const defaultRadio = qForm.querySelector('input[name="q-feedback-mode"][value="general"]');
      if (defaultRadio) defaultRadio.checked = true;
      document.getElementById('q-active').checked = true;
    }

    syncFeedbackModeUI();
    qModal.classList.remove('hidden');
  }

  container.querySelectorAll('.btn-add-q-inline').forEach((btn) => {
    btn.addEventListener('click', () => {
      expandedThemes.add(btn.dataset.id);
      openQuestionModal({ presetSubjectId: btn.dataset.id });
    });
  });

  document.getElementById('btn-close-q-modal').addEventListener('click', () => qModal.classList.add('hidden'));
  document.getElementById('btn-cancel-q').addEventListener('click', () => qModal.classList.add('hidden'));

  container.querySelectorAll('.btn-edit-q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = allQuestions.find((item) => item.id === btn.dataset.id);
      if (q) openQuestionModal({ question: q });
    });
  });

  container.querySelectorAll('.btn-dup-q').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await apiRequest(`/api/admin/questions/${btn.dataset.id}/duplicate`, { method: 'POST' });
      renderContentManager(container);
    });
  });

  container.querySelectorAll('.btn-toggle-q').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const active = btn.dataset.active === 'true';
      await apiRequest(`/api/admin/questions/${btn.dataset.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !active }),
      });
      renderContentManager(container);
    });
  });

  container.querySelectorAll('.btn-del-q').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Deseja excluir esta pergunta? Respostas já registradas em tentativas passadas serão preservadas nos relatórios.')) return;
      await apiRequest(`/api/admin/questions/${btn.dataset.id}`, { method: 'DELETE' });
      renderContentManager(container);
    });
  });

  qForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('q-id').value;
    const errBox = document.getElementById('q-form-error');
    const saveBtn = document.getElementById('btn-save-q');

    errBox.classList.add('hidden');
    saveBtn.disabled = true;

    const mode = getSelectedFeedbackMode();
    const correctOpt = document.getElementById('q-correct').value;

    const payload = {
      subject_id: document.getElementById('q-subject').value,
      statement: document.getElementById('q-statement').value,
      option_a: document.getElementById('q-opt-a').value,
      option_b: document.getElementById('q-opt-b').value,
      option_c: document.getElementById('q-opt-c').value,
      option_d: document.getElementById('q-opt-d').value,
      correct_option: correctOpt,
      feedback_correct: document.getElementById('q-fb-correct').value,
      feedback_mode: mode,
      feedback_incorrect: mode === 'general' ? document.getElementById('q-fb-incorrect').value : '',
      feedback_incorrect_a: mode === 'individual' && correctOpt !== 'A' ? document.getElementById('q-fb-ind-a').value : null,
      feedback_incorrect_b: mode === 'individual' && correctOpt !== 'B' ? document.getElementById('q-fb-ind-b').value : null,
      feedback_incorrect_c: mode === 'individual' && correctOpt !== 'C' ? document.getElementById('q-fb-ind-c').value : null,
      feedback_incorrect_d: mode === 'individual' && correctOpt !== 'D' ? document.getElementById('q-fb-ind-d').value : null,
      is_active: document.getElementById('q-active').checked,
    };

    try {
      if (id) {
        await apiRequest(`/api/admin/questions/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/admin/questions', { method: 'POST', body: JSON.stringify(payload) });
      }
      expandedThemes.add(payload.subject_id);
      qModal.classList.add('hidden');
      renderContentManager(container);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
    }
  });

  // Ordenação Persistente por Botões (Subir / Descer) + Drag & Drop (Mouse e Touch)
  let isSavingOrder = false;
  async function saveNewOrder(orderedList) {
    if (isSavingOrder || !orderedList || orderedList.length === 0) return;
    isSavingOrder = true;
    try {
      const items = orderedList.map((q, index) => ({
        id: q.id,
        display_order: index + 1,
      }));
      await apiRequest('/api/admin/questions/reorder', {
        method: 'PUT',
        body: JSON.stringify({ items }),
      });
      await renderContentManager(container);
    } catch (err) {
      alert(`Erro ao salvar nova ordem: ${err.message}`);
    } finally {
      isSavingOrder = false;
    }
  }

  container.querySelectorAll('.btn-move-up').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const subjId = btn.dataset.subjectId;
      const idx = parseInt(btn.dataset.index, 10);
      const list = [...(questionsBySubject[subjId] || [])];
      if (idx <= 0) return;
      [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
      await saveNewOrder(list);
    });
  });

  container.querySelectorAll('.btn-move-down').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const subjId = btn.dataset.subjectId;
      const idx = parseInt(btn.dataset.index, 10);
      const list = [...(questionsBySubject[subjId] || [])];
      if (idx >= list.length - 1) return;
      [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
      await saveNewOrder(list);
    });
  });

  container.querySelectorAll('.sortable-questions-group').forEach((groupEl) => {
    let draggedCard = null;
    const subjId = groupEl.dataset.subjectId;

    const persistDomOrder = async () => {
      const domIds = Array.from(groupEl.querySelectorAll('.question-item-card')).map((el) => el.dataset.id);
      const list = questionsBySubject[subjId] || [];
      const currentIds = list.map((q) => q.id);
      const changed = domIds.some((id, i) => id !== currentIds[i]);
      if (!changed) return;
      const reordered = domIds.map((id) => list.find((q) => q.id === id)).filter(Boolean);
      await saveNewOrder(reordered);
    };

    groupEl.querySelectorAll('.question-item-card').forEach((card) => {
      // Desktop HTML5 Drag & Drop
      card.addEventListener('dragstart', () => {
        draggedCard = card;
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', async () => {
        card.classList.remove('dragging');
        draggedCard = null;
        await persistDomOrder();
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedCard || draggedCard === card) return;
        const rect = card.getBoundingClientRect();
        const after = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        groupEl.insertBefore(draggedCard, after ? card.nextSibling : card);
      });

      // Touch Drag & Drop via .drag-handle para dispositivos móveis
      const handle = card.querySelector('.drag-handle');
      if (handle) {
        handle.addEventListener(
          'touchstart',
          () => {
            draggedCard = card;
            card.classList.add('dragging');
          },
          { passive: true }
        );

        handle.addEventListener(
          'touchmove',
          (e) => {
            if (!draggedCard || !e.touches || e.touches.length === 0) return;
            e.preventDefault();
            const touchY = e.touches[0].clientY;
            const cards = Array.from(groupEl.querySelectorAll('.question-item-card'));
            for (const targetCard of cards) {
              if (targetCard === draggedCard) continue;
              const rect = targetCard.getBoundingClientRect();
              if (touchY >= rect.top && touchY <= rect.bottom) {
                const after = (touchY - rect.top) / (rect.bottom - rect.top) > 0.5;
                groupEl.insertBefore(draggedCard, after ? targetCard.nextSibling : targetCard);
                break;
              }
            }
          },
          { passive: false }
        );

        handle.addEventListener('touchend', async () => {
          if (!draggedCard) return;
          card.classList.remove('dragging');
          draggedCard = null;
          await persistDomOrder();
        });
      }
    });
  });

  // ==================== IMPORTAÇÃO VIA WORD (.DOCX) ====================
  const docxModal = document.getElementById('docx-import-modal');
  document.getElementById('btn-open-docx-import').addEventListener('click', () => {
    document.getElementById('docx-preview-container').innerHTML = '';
    document.getElementById('docx-file-input').value = '';
    docxModal.classList.remove('hidden');
  });
  document.getElementById('btn-close-docx-modal').addEventListener('click', () => {
    docxModal.classList.add('hidden');
  });

  document.getElementById('btn-analyze-docx').addEventListener('click', async () => {
    const fileInput = document.getElementById('docx-file-input');
    const overrideSubj = document.getElementById('docx-override-subject').value;
    const previewContainer = document.getElementById('docx-preview-container');

    if (!fileInput.files[0]) {
      alert('Selecione um arquivo Word (.docx) primeiro.');
      return;
    }

    previewContainer.innerHTML = '<p>Lendo documento Word e verificando correspondências...</p>';

    try {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      if (overrideSubj) formData.append('override_subject_id', overrideSubj);

      const preview = await apiRequest('/api/admin/questions/import/docx/preview', {
        method: 'POST',
        body: formData,
      });

      const { theme, summary, questions } = preview;

      if (!theme.is_valid) {
        previewContainer.innerHTML = `
          <div class="alert-banner">
            Não foi possível identificar o nome do tema no documento. Certifique-se de incluir a linha <strong>TEMA: Nome do Tema</strong> no Word ou selecione um tema de destino acima.
          </div>
        `;
        return;
      }

      const displayThemeName = theme.existing_subject ? theme.existing_subject.name : theme.detected_name;

      previewContainer.innerHTML = `
        <div style="padding: 1rem; background: var(--color-surface-subtle); border: 1px solid var(--color-border); border-radius: 10px; margin-bottom: 1rem;">
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.65rem;">
            <div>
              <span style="font-size: 0.85rem; color: var(--color-text-secondary);">Tema identificado:</span>
              <h4 style="font-size: 1.15rem;">${escapeHtml(displayThemeName)}</h4>
            </div>
            ${
              theme.status === 'existing'
                ? '<span class="badge badge-active">Tema já existente no sistema (será reutilizado)</span>'
                : '<span class="badge badge-warning">Novo tema (será criado automaticamente)</span>'
            }
          </div>
          <div style="font-size: 0.9rem; display: flex; flex-wrap: wrap; gap: 1rem;">
            <span><strong>Total encontradas:</strong> ${summary.total_found}</span>
            <span style="color: var(--color-success);"><strong>Novas:</strong> ${summary.new_count}</span>
            <span><strong>Já existentes:</strong> ${summary.exact_match_count}</span>
            ${summary.ambiguous_count > 0 ? `<span style="color: var(--color-warning);"><strong>Revisão necessária:</strong> ${summary.ambiguous_count}</span>` : ''}
            ${summary.invalid_count > 0 ? `<span style="color: var(--color-error);"><strong>Incompletas/Inválidas:</strong> ${summary.invalid_count}</span>` : ''}
          </div>
        </div>

        <div class="table-responsive" style="max-height: 340px; margin-bottom: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Enunciado</th>
                <th>Correta</th>
                <th>Situação</th>
                <th>Ação na importação</th>
              </tr>
            </thead>
            <tbody>
              ${questions
                .map((q, idx) => {
                  if (q.match_status === 'invalid') {
                    return `
                      <tr>
                        <td>${q.question_number}</td>
                        <td>${escapeHtml(q.statement || '(Enunciado vazio)')}</td>
                        <td>${escapeHtml(q.correct_option || '-')}</td>
                        <td><span class="badge badge-error">Inválida: ${escapeHtml(q.errors.join('; '))}</span></td>
                        <td><span style="color: var(--color-muted); font-size: 0.85rem;">Ignorada</span></td>
                      </tr>`;
                  }

                  if (q.match_status === 'exact_match') {
                    return `
                      <tr>
                        <td>${q.question_number}</td>
                        <td>
                          <strong>${escapeHtml(q.statement)}</strong>
                          <div style="font-size: 0.8rem; color: var(--color-text-secondary);">Corresponde a uma pergunta já cadastrada neste tema.</div>
                        </td>
                        <td><strong>${q.correct_option}</strong></td>
                        <td><span class="badge badge-warning">Já existente</span></td>
                        <td>
                          <select class="form-control docx-row-action" data-idx="${idx}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem;">
                            <option value="update" selected>Atualizar pergunta existente</option>
                            <option value="skip">Manter atual (não alterar)</option>
                          </select>
                        </td>
                      </tr>`;
                  }

                  if (q.match_status === 'ambiguous') {
                    return `
                      <tr>
                        <td>${q.question_number}</td>
                        <td>
                          <strong>${escapeHtml(q.statement)}</strong>
                          <div style="font-size: 0.8rem; color: var(--color-warning);">
                            Similar (${q.similarity}%) à existente: "${escapeHtml(q.matched_statement.slice(0, 70))}..."
                          </div>
                        </td>
                        <td><strong>${q.correct_option}</strong></td>
                        <td><span class="badge badge-warning">Revisar dúvida</span></td>
                        <td>
                          <select class="form-control docx-row-action" data-idx="${idx}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem;">
                            <option value="create" selected>Criar como nova pergunta</option>
                            <option value="update">Atualizar a pergunta similar</option>
                            <option value="skip">Ignorar esta questão</option>
                          </select>
                        </td>
                      </tr>`;
                  }

                  return `
                    <tr>
                      <td>${q.question_number}</td>
                      <td>${escapeHtml(q.statement)}</td>
                      <td><strong>${q.correct_option}</strong></td>
                      <td><span class="badge badge-active">Nova pergunta</span></td>
                      <td>
                        <select class="form-control docx-row-action" data-idx="${idx}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem;">
                          <option value="create" selected>Cadastrar nova</option>
                          <option value="skip">Ignorar</option>
                        </select>
                      </td>
                    </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <div id="docx-confirm-error" class="alert-banner hidden" style="margin-bottom: 0.85rem;"></div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-docx-preview">Cancelar</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-docx-import">Confirmar importação</button>
        </div>
      `;

      document.getElementById('btn-cancel-docx-preview').addEventListener('click', () => {
        docxModal.classList.add('hidden');
      });

      document.getElementById('btn-confirm-docx-import').addEventListener('click', async () => {
        const confirmBtn = document.getElementById('btn-confirm-docx-import');
        const confirmErr = document.getElementById('docx-confirm-error');
        confirmErr.classList.add('hidden');

        const actionSelects = previewContainer.querySelectorAll('.docx-row-action');
        const actionByIdx = {};
        actionSelects.forEach((sel) => {
          actionByIdx[Number(sel.dataset.idx)] = sel.value;
        });

        const payloadQuestions = questions
          .map((q, idx) => {
            if (q.match_status === 'invalid') return null;
            const chosenAction = actionByIdx[idx] || 'skip';
            if (chosenAction === 'skip') return null;
            return {
              ...q,
              action: chosenAction,
              target_question_id: q.matched_question_id || null,
            };
          })
          .filter(Boolean);

        if (payloadQuestions.length === 0) {
          confirmErr.textContent = 'Nenhuma pergunta válida selecionada para gravar.';
          confirmErr.classList.remove('hidden');
          return;
        }

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Salvando no banco...';

        try {
          const result = await apiRequest('/api/admin/questions/import/docx/confirm', {
            method: 'POST',
            body: JSON.stringify({
              theme_name: theme.detected_name,
              theme_description: theme.detected_description,
              existing_subject_id: theme.existing_subject ? theme.existing_subject.id : null,
              questions: payloadQuestions,
            }),
          });

          if (result.subject_id) {
            expandedThemes.add(result.subject_id);
          }

          docxModal.classList.add('hidden');
          alert(
            `Importação concluída!
` +
              `• Perguntas criadas: ${result.created_count}
` +
              `• Perguntas atualizadas: ${result.updated_count}`
          );
          renderContentManager(container);
        } catch (err) {
          confirmErr.textContent = err.message;
          confirmErr.classList.remove('hidden');
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirmar importação';
        }
      });
    } catch (err) {
      previewContainer.innerHTML = `<div class="alert-banner">${escapeHtml(err.message)}</div>`;
    }
  });
}
