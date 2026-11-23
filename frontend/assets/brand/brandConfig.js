/**
 * ==========================================================================
 * CONFIGURAÇÃO CENTRALIZADA DE IDENTIDADE VISUAL — DESCOMPLICA CLT
 * ==========================================================================
 */
export const BRAND_CONFIG = {
  name: 'Descomplica CLT',
  tagline: 'Quiz Interativo • Direitos Trabalhistas',
  adminSubtitle: 'Painel Administrativo',
  useImageLogo: true,
  logoUrl: '/assets/brand/logo-horizontal-dark.png',
  logos: {
    horizontalDark: '/assets/brand/logo-horizontal-dark.png',
    horizontalLight: '/assets/brand/logo-horizontal-light.png',
    verticalDark: '/assets/brand/logo-vertical-dark.png',
    symbolDark: '/assets/brand/logo-symbol-dark.png',
    badge: '/assets/brand/brand-badge.png',
  },
  logoAlt: 'Logo Descomplica CLT',
};

export function renderBrandHeader(containerEl, { showSubtitle = false, subtitleText = '', variant = 'auto' } = {}) {
  if (!containerEl) return;

  let chosenLogo = BRAND_CONFIG.logoUrl;
  if (variant === 'vertical' || containerEl.id === 'welcome-brand-mount') {
    chosenLogo = BRAND_CONFIG.logos.verticalDark;
  } else if (variant === 'light' || containerEl.closest('.admin-login-card')) {
    chosenLogo = BRAND_CONFIG.logos.horizontalLight;
  } else if (variant === 'symbol') {
    chosenLogo = BRAND_CONFIG.logos.symbolDark;
  } else {
    chosenLogo = BRAND_CONFIG.logos.horizontalDark;
  }

  if (BRAND_CONFIG.useImageLogo && chosenLogo) {
    containerEl.innerHTML = `
      <div class="brand-logo-wrapper" style="display: flex; align-items: center; gap: 0.75rem;">
        <img
          src="${chosenLogo}"
          alt="${BRAND_CONFIG.logoAlt}"
          class="brand-logo-img"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"
        />
        <span class="brand-title" style="display:none;">${BRAND_CONFIG.name}</span>
      </div>
      ${showSubtitle && subtitleText ? `<span class="brand-subtitle">${subtitleText}</span>` : ''}
    `;
  } else {
    containerEl.innerHTML = `
      <div class="brand-logo-slot" data-logo-placeholder="true">
        <span class="brand-title">${BRAND_CONFIG.name}</span>
      </div>
      ${showSubtitle && subtitleText ? `<span class="brand-subtitle">${subtitleText}</span>` : ''}
    `;
  }
}
