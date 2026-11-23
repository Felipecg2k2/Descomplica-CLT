import { apiRequest } from '../shared/api.js';
import { escapeHtml, formatSeconds } from '../shared/utils.js';
import { PrecisionCountdown, InactivityMonitor } from './timer.js';
import { saveTotemSession, loadTotemSession, clearTotemSession } from './storage.js';
import { renderBrandHeader } from '/assets/brand/brandConfig.js';

const state = {
  screen: 'welcome',
  studentName: '',
  subjects: [],
  selectedSubject: null,
  attempt: null,
  questions: [],
  currentIndex: 0,
  questionStartedAtMs: null,
  resultStartedAtMs: null,
  lastActivityAt: null,
  lastFeedback: null,
  finalResult: null,
  timersConfig: {
    question_time_seconds: 60,
    feedback_time_seconds: 30,
    inactivity_time_seconds: 90,
    inactivity_warning_seconds: 15,
    result_time_seconds: 60,
    auto_timeout_enabled: true,
  },
  isSubmitting: false,
  isExitingQuiz: false,
};

let activeCountdown = null;
let inactivityMonitor = null;

const screens = {
  welcome: document.getElementById('screen-welcome'),
  identify: document.getElementById('screen-identify'),
  subjects: document.getElementById('screen-subjects'),
  intro: document.getElementById('screen-intro'),
  question: document.getElementById('screen-question'),
  feedback: document.getElementById('screen-feedback'),
  result: document.getElementById('screen-result'),
};

const studentPill = document.getElementById('header-student-pill');
const abandonModal = document.getElementById('abandon-modal');
const inactivityWarningModal = document.getElementById('inactivity-warning-modal');
const inactivityWarningCountdownEl = document.getElementById('inactivity-warning-countdown');

function stopActiveCountdown() {
  if (activeCountdown) {
    activeCountdown.stop();
    activeCountdown = null;
  }
}

function closeAbandonModal() {
  if (abandonModal) {
    abandonModal.classList.add('hidden');
  }
}

function openAbandonModal() {
  if (abandonModal && state.screen === 'question') {
    abandonModal.classList.remove('hidden');
  }
}

function showInactivityWarningModal(remainingSec) {
  if (!inactivityWarningModal) return;
  if (inactivityWarningCountdownEl) {
    inactivityWarningCountdownEl.textContent = formatSeconds(remainingSec);
  }
  inactivityWarningModal.classList.remove('hidden');
}

function updateInactivityWarningCountdown(remainingSec) {
  if (inactivityWarningCountdownEl) {
    inactivityWarningCountdownEl.textContent = formatSeconds(remainingSec);
  }
}

function hideInactivityWarningModal() {
  if (inactivityWarningModal) {
    inactivityWarningModal.classList.add('hidden');
  }
}

function hasActiveStudentSession() {
  return Boolean(state.studentName && state.studentName.trim().length >= 2);
}

/**
 * Inicia a contagem global de inatividade uma única vez no início da sessão do aluno.
 * Mudanças de tela NÃO reiniciam essa contagem.
 */
function startGlobalInactivitySession(customStartMs = Date.now()) {
  state.lastActivityAt = customStartMs;
  if (!inactivityMonitor) return;
  if (!state.timersConfig.auto_timeout_enabled) {
    inactivityMonitor.stop();
    return;
  }
  inactivityMonitor.updateTimeout(state.timersConfig.inactivity_time_seconds, state.timersConfig.inactivity_warning_seconds);
  inactivityMonitor.start(customStartMs);
}

function showScreen(name) {
  state.screen = name;
  closeAbandonModal();

  Object.entries(screens).forEach(([key, el]) => {
    if (el) el.classList.toggle('hidden', key !== name);
  });

  if (hasActiveStudentSession() && name !== 'welcome' && name !== 'identify') {
    studentPill.textContent = `Aluno(a): ${state.studentName}`;
    studentPill.classList.remove('hidden');
  } else {
    studentPill.classList.add('hidden');
  }

  // Garante que o monitor global continue ativo durante todas as etapas da sessão sem resetar o tempo
  const sessionScreens = ['subjects', 'intro', 'question', 'feedback', 'result'];
  if (hasActiveStudentSession() && sessionScreens.includes(name)) {
    if (state.timersConfig.auto_timeout_enabled && inactivityMonitor && !inactivityMonitor.isRunning()) {
      inactivityMonitor.start(state.lastActivityAt || Date.now());
    }
  } else if (name === 'welcome' || name === 'identify') {
    if (inactivityMonitor) inactivityMonitor.stop();
  }

  persistState();
}

function persistState() {
  if (state.screen === 'welcome' || !hasActiveStudentSession()) {
    clearTotemSession();
    return;
  }
  saveTotemSession({
    screen: state.screen,
    studentName: state.studentName,
    selectedSubject: state.selectedSubject,
    attempt: state.attempt,
    questions: state.questions,
    currentIndex: state.currentIndex,
    questionStartedAtMs: state.questionStartedAtMs,
    resultStartedAtMs: state.resultStartedAtMs,
    lastFeedback: state.lastFeedback,
    finalResult: state.finalResult,
    timersConfig: state.timersConfig,
    lastActivityAt: inactivityMonitor ? inactivityMonitor.getLastActivityAt() : Date.now(),
  });
}

async function terminateAttemptAsAbandoned() {
  if (state.attempt && state.attempt.status === 'in_progress') {
    const attemptId = state.attempt.id;
    state.attempt.status = 'abandoned';
    try {
      await apiRequest(`/api/public/quiz/${attemptId}/finish`, {
        method: 'POST',
        body: JSON.stringify({ abandoned: true }),
      });
    } catch (err) {
      console.warn('Falha ao registrar interrupção da tentativa no servidor:', err.message);
    }
  }
}

async function handleInactivityExpiration() {
  if (state.isExitingQuiz) return;
  state.isExitingQuiz = true;

  stopActiveCountdown();
  closeAbandonModal();
  hideInactivityWarningModal();
  await terminateAttemptAsAbandoned();
  resetAllAndGoWelcome();
}

async function handleVoluntaryAbandonConfirm() {
  if (state.isExitingQuiz) return;
  state.isExitingQuiz = true;

  const confirmBtn = document.getElementById('btn-abandon-confirm');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Encerrando...';
  }

  stopActiveCountdown();
  closeAbandonModal();
  hideInactivityWarningModal();
  await terminateAttemptAsAbandoned();
  resetAllAndGoWelcome();

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Sair do quiz';
  }
}

function resetAllAndGoWelcome() {
  stopActiveCountdown();
  closeAbandonModal();
  hideInactivityWarningModal();
  if (inactivityMonitor) inactivityMonitor.stop();

  state.studentName = '';
  state.selectedSubject = null;
  state.attempt = null;
  state.questions = [];
  state.currentIndex = 0;
  state.questionStartedAtMs = null;
  state.resultStartedAtMs = null;
  state.lastFeedback = null;
  state.finalResult = null;
  state.isSubmitting = false;
  state.isExitingQuiz = false;

  const nameInput = document.getElementById('input-student-name');
  if (nameInput) nameInput.value = '';

  clearTotemSession();
  showScreen('welcome');
}

async function loadPublicSettings() {
  try {
    const settings = await apiRequest('/api/public/settings');
    state.timersConfig = {
      question_time_seconds: settings.question_time_seconds ?? 60,
      feedback_time_seconds: settings.feedback_time_seconds ?? 30,
      inactivity_time_seconds: settings.inactivity_time_seconds ?? 90,
      inactivity_warning_seconds: settings.inactivity_warning_seconds ?? 15,
      result_time_seconds: settings.result_time_seconds ?? 60,
      auto_timeout_enabled: settings.auto_timeout_enabled !== false,
    };
  } catch (err) {
    console.warn('Usando tempos padrão:', err.message);
  }
}

async function loadSubjectsAndRender() {
  const container = document.getElementById('subjects-list');
  const errorBox = document.getElementById('subjects-error');
  errorBox.classList.add('hidden');
  container.innerHTML = '<p>Carregando temas disponíveis...</p>';

  showScreen('subjects');

  try {
    const subjects = await apiRequest('/api/public/subjects');
    state.subjects = subjects;

    if (!subjects || subjects.length === 0) {
      container.innerHTML = `
        <div class="intro-card">
          <h3>Nenhum tema disponível no momento</h3>
          <p>Peça à professora para publicar um tema com perguntas ativas no painel administrativo.</p>
          <button type="button" class="btn btn-secondary btn-totem-full" id="btn-empty-back">Voltar ao início</button>
        </div>
      `;
      document.getElementById('btn-empty-back').addEventListener('click', resetAllAndGoWelcome);
      return;
    }

    container.innerHTML = subjects
      .map(
        (subj) => `
        <button type="button" class="subject-card-totem" data-subject-id="${subj.id}">
          <img
            src="${subj.image_url ? escapeHtml(subj.image_url) : '/assets/placeholder-subject.svg'}"
            alt="${escapeHtml(subj.name)}"
            class="subject-card-img"
            onerror="this.src='/assets/placeholder-subject.svg'"
          />
          <div class="subject-card-info">
            <h3>${escapeHtml(subj.name)}</h3>
            ${subj.description ? `<p>${escapeHtml(subj.description)}</p>` : ''}
            <div class="subject-card-meta">${subj.question_count} ${subj.question_count === 1 ? 'questão' : 'questões'}</div>
          </div>
        </button>
      `
      )
      .join('');

    container.querySelectorAll('.subject-card-totem').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-subject-id');
        const chosen = state.subjects.find((s) => s.id === id);
        if (chosen) {
          state.selectedSubject = chosen;
          renderActivityIntro();
        }
      });
    });
  } catch (err) {
    container.innerHTML = '';
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  }
}

function renderActivityIntro() {
  const subj = state.selectedSubject;
  document.getElementById('intro-subject-name').textContent = subj.name;
  const descEl = document.getElementById('intro-subject-desc');
  if (subj.description) {
    descEl.textContent = subj.description;
    descEl.classList.remove('hidden');
  } else {
    descEl.classList.add('hidden');
  }

  document.getElementById('intro-q-time').textContent = `${state.timersConfig.question_time_seconds} segundos`;
  document.getElementById('intro-f-time').textContent = `${state.timersConfig.feedback_time_seconds} segundos`;
  document.getElementById('intro-q-count').textContent = `${subj.question_count} ${subj.question_count === 1 ? 'pergunta' : 'perguntas'}`;

  showScreen('intro');
}

async function startQuiz() {
  const btnStart = document.getElementById('btn-start-quiz');
  const errBox = document.getElementById('intro-error');
  errBox.classList.add('hidden');
  btnStart.disabled = true;
  btnStart.textContent = 'Preparando quiz...';

  try {
    const payload = await apiRequest('/api/public/quiz/start', {
      method: 'POST',
      body: JSON.stringify({
        student_name: state.studentName,
        subject_id: state.selectedSubject.id,
      }),
    });

    state.attempt = payload.attempt;
    state.questions = payload.questions;
    state.timersConfig = {
      ...state.timersConfig,
      ...payload.timers,
    };
    if (inactivityMonitor) {
      inactivityMonitor.updateTimeout(state.timersConfig.inactivity_time_seconds, state.timersConfig.inactivity_warning_seconds);
    }
    state.currentIndex = 0;
    state.questionStartedAtMs = Date.now();

    renderCurrentQuestion();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
  } finally {
    btnStart.disabled = false;
    btnStart.textContent = 'Começar quiz';
  }
}

function renderCurrentQuestion(resumeStartTimeMs = null) {
  stopActiveCountdown();
  closeAbandonModal();
  state.isSubmitting = false;

  const q = state.questions[state.currentIndex];
  const total = state.questions.length;
  const currentNum = state.currentIndex + 1;

  document.getElementById('quiz-subject-name').textContent = state.selectedSubject.name;
  document.getElementById('quiz-counter').textContent = `Questão ${currentNum} de ${total}`;

  const progressPct = ((currentNum - 1) / total) * 100;
  document.getElementById('quiz-progress-fill').style.width = `${progressPct}%`;
  document.getElementById('quiz-statement').textContent = q.statement;

  const optionsContainer = document.getElementById('quiz-options');
  const opts = [
    { key: 'A', text: q.option_a },
    { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c },
    { key: 'D', text: q.option_d },
  ];

  optionsContainer.innerHTML = opts
    .map(
      (opt) => `
      <button type="button" class="option-btn" data-option="${opt.key}">
        <span class="option-letter">${opt.key}</span>
        <span>${escapeHtml(opt.text)}</span>
      </button>
    `
    )
    .join('');

  optionsContainer.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const selected = btn.getAttribute('data-option');
      handleAnswerSubmission(selected, false);
    });
  });

  const timerDisplay = document.getElementById('quiz-timer-value');
  timerDisplay.classList.remove('timer-urgent');

  state.questionStartedAtMs = resumeStartTimeMs || Date.now();
  showScreen('question');

  activeCountdown = new PrecisionCountdown({
    durationSeconds: state.timersConfig.question_time_seconds,
    onTick: (sec) => {
      timerDisplay.textContent = formatSeconds(sec);
      timerDisplay.classList.toggle('timer-urgent', sec <= 10);
    },
    onExpire: () => {
      closeAbandonModal();
      handleAnswerSubmission(null, true);
    },
  });

  activeCountdown.start(state.questionStartedAtMs);
}

async function handleAnswerSubmission(selectedOption, isTimeout) {
  if (state.isSubmitting || state.isExitingQuiz) return;
  state.isSubmitting = true;

  const elapsedSeconds = activeCountdown
    ? activeCountdown.getElapsedSeconds()
    : state.timersConfig.question_time_seconds;

  stopActiveCountdown();
  closeAbandonModal();

  document.querySelectorAll('#quiz-options .option-btn').forEach((b) => {
    b.disabled = true;
  });

  const currentQuestion = state.questions[state.currentIndex];

  try {
    const feedback = await apiRequest(`/api/public/quiz/${state.attempt.id}/answer`, {
      method: 'POST',
      body: JSON.stringify({
        question_id: currentQuestion.id,
        selected_option: selectedOption,
        is_timeout: isTimeout,
        response_time_seconds: elapsedSeconds,
      }),
    });

    state.lastFeedback = feedback;
    renderFeedbackScreen(feedback);
  } catch (err) {
    alert(`Erro ao registrar resposta: ${err.message}`);
    state.isSubmitting = false;
  }
}

function renderFeedbackScreen(feedback) {
  stopActiveCountdown();
  closeAbandonModal();

  const card = document.getElementById('feedback-card');
  const titleEl = document.getElementById('feedback-title');
  const correctEl = document.getElementById('feedback-correct-text');
  const expEl = document.getElementById('feedback-explanation');
  const btnNext = document.getElementById('btn-feedback-next');
  const timerEl = document.getElementById('feedback-timer-value');

  card.classList.remove('is-correct', 'is-incorrect', 'is-timeout');

  const feedbackMessage = feedback.feedback_text || feedback.explanation || '';

  if (feedback.is_unanswered) {
    card.classList.add('is-timeout');
    titleEl.textContent = 'Tempo esgotado! Você não respondeu a tempo.';
    correctEl.classList.remove('hidden');
    correctEl.textContent = `Alternativa correta: ${feedback.correct_option}) ${feedback.correct_option_text}`;
    expEl.textContent = feedbackMessage;
  } else if (feedback.is_correct) {
    card.classList.add('is-correct');
    titleEl.textContent = 'Resposta correta! Muito bem!';
    correctEl.classList.remove('hidden');
    correctEl.textContent = `Alternativa selecionada: ${feedback.correct_option}) ${feedback.correct_option_text}`;
    expEl.textContent = feedbackMessage;
  } else {
    card.classList.add('is-incorrect');
    titleEl.textContent = 'Resposta incorreta. Veja a explicação:';
    correctEl.classList.remove('hidden');
    correctEl.textContent = `Alternativa correta: ${feedback.correct_option}) ${feedback.correct_option_text}`;
    expEl.textContent = feedbackMessage;
  }

  const isLastQuestion = state.currentIndex >= state.questions.length - 1;
  btnNext.textContent = isLastQuestion ? 'Ver resultado final' : 'Próxima pergunta';

  showScreen('feedback');

  activeCountdown = new PrecisionCountdown({
    durationSeconds: state.timersConfig.feedback_time_seconds,
    onTick: (sec) => {
      timerEl.textContent = formatSeconds(sec);
    },
    onExpire: () => {
      advanceAfterFeedback();
    },
  });
  activeCountdown.start();
}

async function advanceAfterFeedback() {
  if (state.isExitingQuiz) return;
  stopActiveCountdown();

  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex += 1;
    state.lastFeedback = null;
    renderCurrentQuestion();
  } else {
    await finalizeQuiz();
  }
}

async function finalizeQuiz() {
  try {
    const result = await apiRequest(`/api/public/quiz/${state.attempt.id}/finish`, {
      method: 'POST',
      body: JSON.stringify({ abandoned: false }),
    });

    state.attempt = result;
    state.finalResult = result;
    state.resultStartedAtMs = Date.now();
    renderResultScreen(result, state.resultStartedAtMs);
  } catch (err) {
    alert(`Erro ao finalizar quiz: ${err.message}`);
  }
}

function renderResultScreen(result, resumeResultStartMs = null) {
  stopActiveCountdown();

  document.getElementById('result-student-name').textContent = result.student_name;
  document.getElementById('result-subject-name').textContent = result.subject_name_snapshot;
  const pct = Number(result.accuracy_percentage) || 0;
  document.getElementById('result-accuracy').textContent = `${pct.toFixed(0)}%`;
  const ringEl = document.getElementById('result-accuracy-ring');
  if (ringEl) {
    const circumference = 351.86;
    const clampedPct = Math.min(100, Math.max(0, pct));
    ringEl.style.strokeDashoffset = circumference - (clampedPct / 100) * circumference;
  }
  document.getElementById('result-total').textContent = result.total_questions;
  document.getElementById('result-correct').textContent = result.correct_answers;
  document.getElementById('result-incorrect').textContent = result.incorrect_answers;
  document.getElementById('result-unanswered').textContent = result.unanswered_questions;

  const resultTimerEl = document.getElementById('result-timer-value');
  state.resultStartedAtMs = resumeResultStartMs || Date.now();

  showScreen('result');

  // Temporizador independente de exibição do resultado final (não reinicia com interações)
  activeCountdown = new PrecisionCountdown({
    durationSeconds: state.timersConfig.result_time_seconds,
    onTick: (sec) => {
      if (resultTimerEl) {
        resultTimerEl.textContent = formatSeconds(sec);
      }
    },
    onExpire: () => {
      resetAllAndGoWelcome();
    },
  });
  activeCountdown.start(state.resultStartedAtMs);
}

function initEventListeners() {
  document.getElementById('btn-welcome-start').addEventListener('click', async () => {
    await loadPublicSettings();
    showScreen('identify');
    setTimeout(() => document.getElementById('input-student-name').focus(), 100);
  });

  document.getElementById('form-identify').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-student-name');
    const errEl = document.getElementById('identify-error');
    const name = input.value.trim();

    if (name.length < 2) {
      errEl.textContent = 'Por favor, digite seu nome completo para continuar.';
      errEl.classList.remove('hidden');
      return;
    }

    errEl.classList.add('hidden');
    state.studentName = name;

    // Inicia o temporizador global de inatividade imediatamente após o aluno informar seu nome
    startGlobalInactivitySession(Date.now());
    await loadSubjectsAndRender();
  });

  document.getElementById('btn-identify-back').addEventListener('click', resetAllAndGoWelcome);

  document.getElementById('btn-subjects-back').addEventListener('click', () => {
    showScreen('identify');
  });

  document.getElementById('btn-intro-back').addEventListener('click', loadSubjectsAndRender);
  document.getElementById('btn-start-quiz').addEventListener('click', startQuiz);
  document.getElementById('btn-feedback-next').addEventListener('click', advanceAfterFeedback);

  // Botão de confirmação no Aviso de Inatividade ("Você está aí?")
  document.getElementById('btn-inactivity-continue').addEventListener('click', () => {
    if (inactivityMonitor) {
      inactivityMonitor.confirmContinue();
    } else {
      hideInactivityWarningModal();
    }
  });

  // Botão e Modal de Saída Voluntária do Quiz
  document.getElementById('btn-abandon-quiz').addEventListener('click', openAbandonModal);
  document.getElementById('btn-abandon-cancel').addEventListener('click', closeAbandonModal);
  document.getElementById('btn-abandon-confirm').addEventListener('click', handleVoluntaryAbandonConfirm);

  document.getElementById('btn-result-retry').addEventListener('click', async () => {
    stopActiveCountdown();
    state.attempt = null;
    state.questions = [];
    state.currentIndex = 0;
    state.lastFeedback = null;
    state.finalResult = null;
    state.resultStartedAtMs = null;
    await loadPublicSettings();
    if (inactivityMonitor) {
      inactivityMonitor.updateTimeout(state.timersConfig.inactivity_time_seconds, state.timersConfig.inactivity_warning_seconds);
    }
    await loadSubjectsAndRender();
  });

  document.getElementById('btn-result-exit').addEventListener('click', resetAllAndGoWelcome);
}

async function bootstrap() {
  renderBrandHeader(document.getElementById('totem-brand-mount'));
  renderBrandHeader(document.getElementById('welcome-brand-mount'));

  await loadPublicSettings();

  inactivityMonitor = new InactivityMonitor({
    timeoutSeconds: state.timersConfig.inactivity_time_seconds,
    warningSeconds: state.timersConfig.inactivity_warning_seconds,
    onWarningShow: (remainingSec) => showInactivityWarningModal(remainingSec),
    onWarningTick: (remainingSec) => updateInactivityWarningCountdown(remainingSec),
    onWarningHide: () => hideInactivityWarningModal(),
    onTimeout: handleInactivityExpiration,
    onActivity: (ts) => {
      state.lastActivityAt = ts;
      persistState();
    },
  });

  initEventListeners();

  const saved = loadTotemSession();
  if (saved && saved.studentName) {
    Object.assign(state, saved);
    state.timersConfig = {
      question_time_seconds: saved.timersConfig?.question_time_seconds ?? state.timersConfig.question_time_seconds,
      feedback_time_seconds: saved.timersConfig?.feedback_time_seconds ?? state.timersConfig.feedback_time_seconds,
      inactivity_time_seconds: saved.timersConfig?.inactivity_time_seconds ?? state.timersConfig.inactivity_time_seconds,
      inactivity_warning_seconds: saved.timersConfig?.inactivity_warning_seconds ?? state.timersConfig.inactivity_warning_seconds,
      result_time_seconds: saved.timersConfig?.result_time_seconds ?? state.timersConfig.result_time_seconds,
      auto_timeout_enabled: saved.timersConfig?.auto_timeout_enabled !== false,
    };

    const timeoutMs = (state.timersConfig.inactivity_time_seconds || 90) * 1000;
    const savedLastActivity = saved.lastActivityAt || Date.now();
    const elapsedSinceLastActivity = Date.now() - savedLastActivity;

    if (state.timersConfig.auto_timeout_enabled && elapsedSinceLastActivity >= timeoutMs) {
      await handleInactivityExpiration();
      return;
    }

    // Restaura o monitor global preservando exatamente o timestamp da última interação
    if (state.screen !== 'welcome' && state.screen !== 'identify') {
      startGlobalInactivitySession(savedLastActivity);
    }

    if (state.screen === 'question' && state.attempt && state.questions.length > 0) {
      renderCurrentQuestion(state.questionStartedAtMs);
      return;
    }
    if (state.screen === 'feedback' && state.lastFeedback) {
      renderFeedbackScreen(state.lastFeedback);
      return;
    }
    if (state.screen === 'result' && state.finalResult) {
      renderResultScreen(state.finalResult, state.resultStartedAtMs);
      return;
    }
    if (state.screen === 'subjects') {
      await loadSubjectsAndRender();
      return;
    }
  }

  showScreen('welcome');
}

bootstrap();
