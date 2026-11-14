/** Tailwind CSS 3.4 theme for the Pedant look. Pair with globals.css (defines every --token).
 *
 *  Colours resolve through CSS variables, so light/dark is just the `.dark` class on <html>
 *  (darkMode: 'class'). `c()` keeps Tailwind's opacity modifiers working (bg-primary/10) by
 *  mixing the variable with transparent; Chromium 120 (Electron 28) supports color-mix().
 *  NOTE: derived from the Tailwind 4 theme in pedant-web/src/styles/index.css; the opacity
 *  helper and the v3 spacing additions are this handoff's translation, not copied code. */
const plugin = require('tailwindcss/plugin');

const c = (name) => `color-mix(in oklab, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
    'background': c('background'),
    'foreground': c('foreground'),
    'card': c('card'),
    'card-foreground': c('card-foreground'),
    'popover': c('popover'),
    'popover-foreground': c('popover-foreground'),
    'muted': c('muted'),
    'muted-foreground': c('muted-foreground'),
    'placeholder': c('placeholder'),
    'border': c('border'),
    'hairline': c('hairline'),
    'input': c('input'),
    'ring': c('ring'),
    'primary': c('primary'),
    'primary-foreground': c('primary-foreground'),
    'secondary': c('secondary'),
    'secondary-foreground': c('secondary-foreground'),
    'brand-secondary': c('brand-secondary'),
    'brand-secondary-foreground': c('brand-secondary-foreground'),
    'brand-accent': c('brand-accent'),
    'brand-accent-foreground': c('brand-accent-foreground'),
    'accent': c('accent'),
    'accent-foreground': c('accent-foreground'),
    'destructive': c('destructive'),
    'destructive-foreground': c('destructive-foreground'),
    'destructive-chip': c('destructive-chip'),
    'destructive-chip-foreground': c('destructive-chip-foreground'),
    'warning': c('warning'),
    'warning-foreground': c('warning-foreground'),
    'warning-chip': c('warning-chip'),
    'warning-chip-foreground': c('warning-chip-foreground'),
    'success': c('success'),
    'success-foreground': c('success-foreground'),
    'success-chip': c('success-chip'),
    'success-chip-foreground': c('success-chip-foreground'),
    'info': c('info'),
    'info-foreground': c('info-foreground'),
    'info-chip': c('info-chip'),
    'info-chip-foreground': c('info-chip-foreground'),
    'sidebar': c('sidebar'),
    'sidebar-foreground': c('sidebar-foreground'),
    'sidebar-primary': c('sidebar-primary'),
    'sidebar-primary-foreground': c('sidebar-primary-foreground'),
    'sidebar-accent': c('sidebar-accent'),
    'sidebar-accent-foreground': c('sidebar-accent-foreground'),
    'sidebar-border': c('sidebar-border'),
    'sidebar-ring': c('sidebar-ring'),
    'sidebar-quiet': c('sidebar-quiet'),
    'sidebar-quiet-foreground': c('sidebar-quiet-foreground'),
    'sidebar-quiet-border': c('sidebar-quiet-border'),
    'sidebar-quiet-accent': c('sidebar-quiet-accent'),
    'sidebar-quiet-accent-foreground': c('sidebar-quiet-accent-foreground'),
    'sidebar-tinted': c('sidebar-tinted'),
    'sidebar-tinted-foreground': c('sidebar-tinted-foreground'),
    'sidebar-tinted-border': c('sidebar-tinted-border'),
    'sidebar-tinted-accent': c('sidebar-tinted-accent'),
    'sidebar-tinted-accent-foreground': c('sidebar-tinted-accent-foreground'),
    'sidebar-inverted': c('sidebar-inverted'),
    'sidebar-inverted-foreground': c('sidebar-inverted-foreground'),
    'sidebar-inverted-border': c('sidebar-inverted-border'),
    'sidebar-inverted-accent': c('sidebar-inverted-accent'),
    'sidebar-inverted-accent-foreground': c('sidebar-inverted-accent-foreground'),
    'surface-1': c('surface-1'),
    'surface-2': c('surface-2'),
    'surface-tint': c('surface-tint'),
    'chart-1': c('chart-1'),
    'chart-2': c('chart-2'),
    'chart-3': c('chart-3'),
    'chart-4': c('chart-4'),
    'chart-5': c('chart-5'),
    'chart-6': c('chart-6'),
      },
      fontFamily: {
        sans: ["'Inter'", 'ui-sans-serif', 'system-ui', '-apple-system', "'Segoe UI'", 'sans-serif'],
        heading: ["'Inter Tight'", "'Inter'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // The type ladder: one role = size + line-height (+ tracking + weight where the role fixes one).
      fontSize: {
        micro: ['10px', { lineHeight: '13px' }],
        caption: ['11.5px', { lineHeight: '17px' }],
        'body-sm': ['12.5px', { lineHeight: '18px' }],
        body: ['13px', { lineHeight: '19px' }],
        'body-lg': ['14px', { lineHeight: '21px' }],
        lead: ['15px', { lineHeight: '22px' }],
        label: ['11px', { lineHeight: '16px', letterSpacing: '1px', fontWeight: '600' }],
        h5: ['15px', { lineHeight: '20px', letterSpacing: '-0.2px', fontWeight: '600' }],
        h4: ['16px', { lineHeight: '21px', letterSpacing: '-0.3px', fontWeight: '600' }],
        h3: ['17px', { lineHeight: '22px', letterSpacing: '-0.3px', fontWeight: '600' }],
        h2: ['24px', { lineHeight: '30px', letterSpacing: '-0.7px', fontWeight: '600' }],
        h1: ['30px', { lineHeight: '36px', letterSpacing: '-0.8px', fontWeight: '600' }],
        display: ['clamp(26px, 2.7vw, 40px)', { lineHeight: '1.14', letterSpacing: '-1.2px', fontWeight: '600' }],
        overline: ['9.5px', { lineHeight: '14px', letterSpacing: '1px' }],
        'overline-md': ['10px', { lineHeight: '13px', letterSpacing: '1px' }],
        'overline-lg': ['10.5px', { lineHeight: '15px', letterSpacing: '1.4px' }],
        'overline-xl': ['11px', { lineHeight: '16px', letterSpacing: '1.2px', fontWeight: '500' }],
        'mono-2xs': ['10.5px', { lineHeight: '15px' }],
        'mono-xs': ['11px', { lineHeight: '16px' }],
        'mono-sm': ['12.5px', { lineHeight: '19px' }],
        mono: ['13.5px', { lineHeight: '20px' }],
        'mono-lg': ['16px', { lineHeight: '22px', letterSpacing: '-0.2px' }],
        th: ['10px', { lineHeight: '14px', letterSpacing: '0.5px' }],
      },
      // --radius is 1rem; the ladder is derived from it (see globals.css :root).
      borderRadius: {
        '2xs': 'calc(var(--radius) - 12px)', // 4px  control glyphs, checkbox
        xs: 'calc(var(--radius) - 6px)', //      10px rows, chips, tags
        sm: 'calc(var(--radius) - 4px)', //      12px buttons, inputs
        md: 'calc(var(--radius) - 2px)', //      14px menus, dialogs, alerts
        lg: 'var(--radius)', //                  16px cards, panels
        xl: 'calc(var(--radius) + 4px)', //      20px
      },
      boxShadow: {
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        knob: 'var(--knob-shadow)',
      },
      // Tailwind 4 derives any number from a 0.25rem step; v3 only ships some of them.
      spacing: { 1.25: '0.3125rem', 6.5: '1.625rem', 10.5: '2.625rem', 15: '3.75rem' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        spin: 'pedant-spin 0.7s linear infinite',
        pulse: 'pedant-pulse 1.1s ease-in-out infinite',
        'toast-in': 'pedant-toast-in 0.18s ease-out',
        fade: 'pedant-fade 0.12s ease-out',
        'screen-in': 'pedant-screen-in 0.26s ease-out',
        bar: 'pedant-bar 1.15s ease-in-out infinite',
                'drawer-in': 'pedant-drawer-in 0.26s ease-out', // AppHeader's phone nav drawer: animate-[pedant-drawer-in_0.26s_ease-out]
      },
    },
  },
  plugins: [
    // v4-only variants the source uses (pointer-coarse:, not-disabled:, aria-busy: exists in v3).
    plugin(({ addVariant }) => {
      addVariant('pointer-coarse', '@media (pointer: coarse)');
      addVariant('not-disabled', '&:not(:disabled)');
      addVariant('not-aria-busy', '&:not([aria-busy="true"])');
    }),
    // npm i -D @tailwindcss/container-queries   (KpiStrip uses @4xl: / @max-4xl:)
    // require('@tailwindcss/container-queries'),
    // npm i -D tailwindcss-animate               (Radix data-[state=open]:animate-in / fade-in-0 / zoom-in-95)
    // require('tailwindcss-animate'),
  ],
};
