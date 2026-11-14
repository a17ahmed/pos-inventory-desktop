/** @type {import('tailwindcss').Config} */

// Design tokens (design/02-foundations.md). Every colour is a CSS variable from
// src/index.css, so light/dark and the shop's accent colour switch without
// touching components. color-mix() keeps opacity modifiers working
// (`bg-primary/10`); Electron 28 (Chromium 120) supports it.
const token = (name) => `color-mix(in oklab, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // ── Semantic tokens (use these in new code) ──
                background: token('background'),
                foreground: token('foreground'),
                card: { DEFAULT: token('card'), foreground: token('card-foreground') },
                popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
                muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
                placeholder: token('placeholder'),
                border: token('border'),
                hairline: token('hairline'),
                input: token('input'),
                ring: token('ring'),
                secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
                accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
                destructive: { DEFAULT: token('destructive'), foreground: token('destructive-foreground'), chip: token('destructive-chip'), 'chip-foreground': token('destructive-chip-foreground') },
                warning: { DEFAULT: token('warning'), foreground: token('warning-foreground'), chip: token('warning-chip'), 'chip-foreground': token('warning-chip-foreground') },
                success: { DEFAULT: token('success'), foreground: token('success-foreground'), chip: token('success-chip'), 'chip-foreground': token('success-chip-foreground') },
                info: { DEFAULT: token('info'), foreground: token('info-foreground'), chip: token('info-chip'), 'chip-foreground': token('info-chip-foreground') },
                sidebar: {
                    DEFAULT: token('sidebar'),
                    foreground: token('sidebar-foreground'),
                    primary: token('sidebar-primary'),
                    'primary-foreground': token('sidebar-primary-foreground'),
                    accent: token('sidebar-accent'),
                    'accent-foreground': token('sidebar-accent-foreground'),
                    border: token('sidebar-border'),
                },
                'surface-tint': token('surface-tint'),
                'chart-1': token('chart-1'),
                'chart-2': token('chart-2'),
                'chart-3': token('chart-3'),
                'chart-4': token('chart-4'),
                'chart-5': token('chart-5'),
                'chart-6': token('chart-6'),

                primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
            },
            borderColor: {
                // A bare `border` is a card edge in this app → the soft hairline
                DEFAULT: 'var(--hairline)',
            },
            fontFamily: {
                sans: ["'Inter'", 'ui-sans-serif', 'system-ui', '-apple-system', "'Segoe UI'", 'sans-serif'],
                heading: ["'Inter Tight'", "'Inter'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ["'JetBrains Mono'", 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
            },
            // Type roles (design/02-foundations.md §3). Tailwind's own text-xs/sm/base
            // stay available until each screen is migrated.
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
            // Tailwind's corner names already match the design (xl = 12px controls,
            // 2xl = 16px cards); two extra steps from the design:
            borderRadius: {
                row: '10px', // rows, small chips, icon tiles
                pop: '14px', // menus, dialogs, alerts, tooltips
            },
            // Quiet elevation: cards = shadow-1, floating layers = shadow-2.
            // The old heavy shadows are re-pointed so nothing glows.
            boxShadow: {
                1: 'var(--shadow-1)',
                2: 'var(--shadow-2)',
                knob: 'var(--knob-shadow)',
                sm: 'var(--shadow-1)',
                DEFAULT: 'var(--shadow-1)',
                md: 'var(--shadow-1)',
                lg: 'var(--shadow-2)',
                xl: 'var(--shadow-2)',
                '2xl': 'var(--shadow-2)',
            },
            animation: {
                'ds-spin': 'ds-spin .7s linear infinite',
                'ds-pulse': 'ds-pulse 1.1s ease-in-out infinite',
                'ds-toast-in': 'ds-toast-in .18s ease-out',
                'ds-fade': 'ds-fade .12s ease-out',
                'ds-screen-in': 'ds-screen-in .26s ease-out',
                'ds-drawer-in': 'ds-drawer-in .26s ease-out',
                'ds-dialog-in': 'ds-dialog-in .16s ease-out',
                'ds-menu-in': 'ds-menu-in .12s ease-out',
                'ds-bar': 'ds-bar 1.15s ease-in-out infinite',
            },
        },
    },
    plugins: [],
};
