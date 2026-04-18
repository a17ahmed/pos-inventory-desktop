/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                },
                // Dark mode palette from CSS variables
                d: {
                    bg: 'var(--d-bg)',
                    card: 'var(--d-card)',
                    elevated: 'var(--d-elevated)',
                    accent: 'var(--d-accent)',
                    'accent-s': 'var(--d-accent-secondary)',
                    heading: 'var(--d-heading)',
                    text: 'var(--d-text)',
                    muted: 'var(--d-muted)',
                    faint: 'var(--d-faint)',
                    green: 'var(--d-green)',
                    blue: 'var(--d-blue)',
                    red: 'var(--d-red)',
                },
            },
            borderColor: {
                'd-border': 'var(--d-border)',
                'd-border-hover': 'var(--d-border-hover)',
            },
            backgroundColor: {
                'd-glass': 'var(--d-glass)',
                'd-glass-hover': 'var(--d-glass-hover)',
            },
        },
    },
    plugins: [],
};
