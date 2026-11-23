export class PrecisionCountdown {
  constructor({ durationSeconds, onTick, onExpire }) {
    this.durationMs = Math.max(1, Number(durationSeconds) || 1) * 1000;
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.endTime = null;
    this.intervalId = null;
    this.expired = false;
  }

  start(customStartTimeMs = Date.now()) {
    this.stop();
    this.expired = false;
    this.endTime = customStartTimeMs + this.durationMs;
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 250);
  }

  tick() {
    if (!this.endTime || this.expired) return;
    const remainingMs = this.endTime - Date.now();
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

    if (this.onTick) {
      this.onTick(remainingSec);
    }

    if (remainingMs <= 0) {
      this.expired = true;
      this.stop();
      if (this.onExpire) {
        this.onExpire();
      }
    }
  }

  getElapsedSeconds() {
    if (!this.endTime) return 0;
    const startTime = this.endTime - this.durationMs;
    return Math.max(0, Math.round((Date.now() - startTime) / 1000));
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export class InactivityMonitor {
  constructor({
    timeoutSeconds,
    warningSeconds = 15,
    onWarningShow,
    onWarningTick,
    onWarningHide,
    onTimeout,
    onActivity,
  }) {
    this.timeoutMs = 90000;
    this.warningMs = 15000;
    this.setDurations(timeoutSeconds, warningSeconds);

    this.onWarningShow = onWarningShow;
    this.onWarningTick = onWarningTick;
    this.onWarningHide = onWarningHide;
    this.onTimeout = onTimeout;
    this.onActivity = onActivity;

    this.timerId = null;
    this.heartbeatId = null;
    this.enabled = false;
    this.lastActivityAt = Date.now();
    this.warningActive = false;
    this.triggered = false;

    // Apenas interações diretas e genuínas do aluno antes de o aviso abrir
    this.interactionEvents = [
      'pointerdown',
      'touchstart',
      'touchmove',
      'mousedown',
      'click',
      'keydown',
      'input',
    ];

    this.boundActivity = (event) => {
      if (event && event.isTrusted === false) return;
      // Quando o aviso "Você está aí?" está visível, exige confirmação explícita no botão "Sim, continuar"
      if (this.warningActive) return;
      this.recordActivity();
    };
    this.boundVisibility = () => this.checkElapsedNow();
  }

  setDurations(timeoutSeconds, warningSeconds) {
    const totalSec = Math.max(10, Number(timeoutSeconds) || 90);
    const rawWarnSec = Math.max(3, Number(warningSeconds) || 15);
    const safeWarnSec = rawWarnSec < totalSec ? rawWarnSec : Math.max(1, totalSec - 1);
    this.timeoutMs = totalSec * 1000;
    this.warningMs = safeWarnSec * 1000;
  }

  isRunning() {
    return this.enabled && !this.triggered;
  }

  isWarningActive() {
    return this.warningActive;
  }

  updateTimeout(timeoutSeconds, warningSeconds = null) {
    const nextWarn = warningSeconds !== null ? warningSeconds : Math.round(this.warningMs / 1000);
    this.setDurations(timeoutSeconds, nextWarn);
    if (this.enabled && !this.triggered) {
      this.checkElapsedNow();
      if (this.enabled && !this.triggered) {
        this.scheduleNextCheck();
      }
    }
  }

  getLastActivityAt() {
    return this.lastActivityAt;
  }

  start(customLastActivityAt = Date.now()) {
    this.lastActivityAt = customLastActivityAt;
    this.triggered = false;

    if (!this.enabled) {
      this.enabled = true;
      this.interactionEvents.forEach((evt) => {
        window.addEventListener(evt, this.boundActivity, { capture: true, passive: true });
      });
      document.addEventListener('visibilitychange', this.boundVisibility);
      window.addEventListener('focus', this.boundVisibility);
      window.addEventListener('pageshow', this.boundVisibility);
    }

    this.checkElapsedNow();
    if (this.enabled && !this.triggered) {
      this.scheduleNextCheck();
    }
  }

  stop() {
    this.enabled = false;
    this.triggered = false;
    if (this.warningActive) {
      this.warningActive = false;
      if (this.onWarningHide) this.onWarningHide();
    }
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.heartbeatId) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
    this.interactionEvents.forEach((evt) => {
      window.removeEventListener(evt, this.boundActivity, { capture: true });
    });
    document.removeEventListener('visibilitychange', this.boundVisibility);
    window.removeEventListener('focus', this.boundVisibility);
    window.removeEventListener('pageshow', this.boundVisibility);
  }

  /**
   * Chamado exclusivamente quando o aluno confirma "Sim, continuar" no aviso de inatividade.
   */
  confirmContinue() {
    if (!this.enabled || this.triggered) return;
    if (this.warningActive) {
      this.warningActive = false;
      if (this.onWarningHide) {
        this.onWarningHide();
      }
    }
    this.lastActivityAt = Date.now();
    this.scheduleNextCheck();
    if (this.onActivity) {
      this.onActivity(this.lastActivityAt);
    }
  }

  recordActivity() {
    if (!this.enabled || this.triggered || this.warningActive) return;
    this.lastActivityAt = Date.now();
    this.scheduleNextCheck();
    if (this.onActivity) {
      this.onActivity(this.lastActivityAt);
    }
  }

  checkElapsedNow() {
    if (!this.enabled || this.triggered) return;
    const elapsed = Date.now() - this.lastActivityAt;

    // 1. Limite total atingido: encerra a sessão imediatamente
    if (elapsed >= this.timeoutMs) {
      this.triggered = true;
      if (this.warningActive) {
        this.warningActive = false;
        if (this.onWarningHide) this.onWarningHide();
      }
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
      if (this.heartbeatId) {
        clearInterval(this.heartbeatId);
        this.heartbeatId = null;
      }
      if (this.onTimeout) {
        this.onTimeout();
      }
      return;
    }

    // 2. Momento de exibição do aviso = Tempo total - Antecedência do aviso
    const warningThresholdMs = Math.max(0, this.timeoutMs - this.warningMs);
    if (elapsed >= warningThresholdMs) {
      const remainingSec = Math.max(0, Math.ceil((this.timeoutMs - elapsed) / 1000));
      if (!this.warningActive) {
        this.warningActive = true;
        if (this.onWarningShow) {
          this.onWarningShow(remainingSec);
        }
      }
      if (this.onWarningTick) {
        this.onWarningTick(remainingSec);
      }
    } else if (this.warningActive) {
      this.warningActive = false;
      if (this.onWarningHide) {
        this.onWarningHide();
      }
    }
  }

  scheduleNextCheck() {
    if (!this.enabled || this.triggered) return;
    if (this.timerId) clearTimeout(this.timerId);
    if (this.heartbeatId) clearInterval(this.heartbeatId);

    const elapsed = Date.now() - this.lastActivityAt;
    const warningThresholdMs = Math.max(0, this.timeoutMs - this.warningMs);
    const nextTargetMs = elapsed < warningThresholdMs ? warningThresholdMs : this.timeoutMs;
    const delay = Math.max(100, nextTargetMs - elapsed);

    this.timerId = setTimeout(() => {
      this.checkElapsedNow();
      if (this.enabled && !this.triggered) {
        this.scheduleNextCheck();
      }
    }, delay);

    // Heartbeat de 250ms baseado em relógio real para precisão na contagem regressiva e resistência a throttling
    this.heartbeatId = setInterval(() => {
      this.checkElapsedNow();
    }, 250);
  }
}
