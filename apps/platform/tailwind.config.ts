import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        primaryHover: 'var(--color-primary-hover)',
        'primary-hover': 'var(--color-primary-hover)',
        primaryDark: 'var(--color-primary-dark)',
        'primary-dark': 'var(--color-primary-dark)',
        primaryLight: 'var(--color-primary-light)',
        'primary-light': 'var(--color-primary-light)',
        accent: 'var(--color-accent)',
        cta: 'var(--color-cta)',
        ctaHover: 'var(--color-cta-hover)',
        'cta-hover': 'var(--color-cta-hover)',
        ink: 'var(--color-ink)',
        inkMuted: 'var(--color-ink-muted)',
        'ink-muted': 'var(--color-ink-muted)',
        inkInverse: 'var(--color-ink-inverse)',
        'ink-inverse': 'var(--color-ink-inverse)',
        bgPage: 'var(--color-bg-page)',
        'bg-page': 'var(--color-bg-page)',
        bgMist: 'var(--color-bg-mist)',
        'bg-mist': 'var(--color-bg-mist)',
        border: 'var(--color-border)',
        danger: 'var(--color-danger)',
        dangerLight: 'var(--color-danger-light)',
        'danger-light': 'var(--color-danger-light)',
        info: 'var(--color-info)',
        infoLight: 'var(--color-info-light)',
        'info-light': 'var(--color-info-light)',
        statusActive: 'var(--color-status-active)',
        'status-active': 'var(--color-status-active)',
        statusEndingSoon: 'var(--color-status-ending-soon)',
        'status-ending-soon': 'var(--color-status-ending-soon)',
        statusCritical: 'var(--color-status-critical)',
        'status-critical': 'var(--color-status-critical)',
        statusEnded: 'var(--color-status-ended)',
        'status-ended': 'var(--color-status-ended)',
        statusDraft: 'var(--color-status-draft)',
        'status-draft': 'var(--color-status-draft)',
        statusScheduled: 'var(--color-status-scheduled)',
        'status-scheduled': 'var(--color-status-scheduled)',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      spacing: {
        '2xs': 'var(--space-2xs)',
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: '64px',
        '2xl': '96px',
        '3xl': '128px',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        button: 'var(--radius-button)',
        input: 'var(--radius-input)',
        hero: '16px',
        modal: '16px',
        pill: '9999px',
      },
      boxShadow: {
        // Var-based with root defaults matching today's public rendering; the
        // (admin) token scope (admin.css) redefines the vars with the demo
        // values, mirroring the fontSize/radius pattern.
        card: 'var(--shadow-card, 0 2px 12px rgba(22, 56, 42, 0.08))',
        'card-hover':
          'var(--shadow-card-hover, 0 2px 8px rgba(22, 56, 42, 0.12), 0 8px 24px rgba(22, 56, 42, 0.08))',
        modal:
          'var(--shadow-modal, 0 4px 16px rgba(22, 56, 42, 0.12), 0 16px 48px rgba(22, 56, 42, 0.1))',
      },
      fontSize: {
        h1: ['48px', { lineHeight: '1.15' }],
        h2: ['36px', { lineHeight: '1.2' }],
        h3: ['24px', { lineHeight: '1.25' }],
        h4: ['var(--font-size-h4)', { lineHeight: 'var(--line-height-h4)' }],
        body: [
          'var(--font-size-body)',
          { lineHeight: 'var(--line-height-body)' },
        ],
        bodySm: [
          'var(--font-size-body-sm)',
          { lineHeight: 'var(--line-height-body-sm)' },
        ],
        label: [
          'var(--font-size-label)',
          { lineHeight: 'var(--line-height-label)' },
        ],
        count: [
          'var(--font-size-count)',
          { lineHeight: 'var(--line-height-count)' },
        ],
      },
      maxWidth: {
        'container-xl': 'var(--layout-container-xl)',
        'container-sm': '720px',
        sidebar: '280px',
      },
      gridTemplateColumns: {
        '12': 'repeat(12, minmax(0, 1fr))',
      },
      gap: {
        gutter: '24px',
      },
      transitionDuration: {
        hover: 'var(--motion-hover-duration)',
        reveal: 'var(--motion-reveal-duration)',
        dropdown: 'var(--motion-dropdown-duration)',
        'modal-entry': 'var(--motion-modal-entry-duration)',
        toast: 'var(--motion-toast-duration)',
        'page-transition': 'var(--motion-page-transition-duration)',
        'countdown-pulse': 'var(--motion-countdown-pulse-duration)',
        'anti-snipe-extend': 'var(--motion-anti-snipe-extend-duration)',
      },
      transitionTimingFunction: {
        hover: 'var(--motion-hover-easing)',
        reveal: 'var(--motion-reveal-easing)',
        dropdown: 'var(--motion-dropdown-easing)',
        'modal-entry': 'var(--motion-modal-entry-easing)',
        toast: 'var(--motion-toast-easing)',
        'page-transition': 'var(--motion-page-transition-easing)',
        'countdown-pulse': 'var(--motion-countdown-pulse-easing)',
        'anti-snipe-extend': 'var(--motion-anti-snipe-extend-easing)',
      },
    },
  },
  plugins: [],
}

export default config