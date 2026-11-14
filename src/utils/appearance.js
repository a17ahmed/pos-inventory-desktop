// App appearance: light/dark/system mode, the shop's accent colour, sidebar style,
// table density. Colours themselves live in src/index.css (one CSS block per accent);
// this file only lists the choices and where they are stored.
// See design/02-foundations.md §2 and design/ROADMAP.md Stage 2.

export const MODES = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'System' },
];

// `swatch` is only for drawing the picker (the light-theme accent of each preset);
// the real colours come from the matching [data-accent] block in index.css.
export const ACCENTS = [
    { id: 'steel', label: 'Steel blue', swatch: 'oklch(0.545 0.125 242)' },
    { id: 'teal', label: 'Teal', swatch: 'oklch(0.515 0.125 195)' },
    { id: 'green', label: 'Green', swatch: 'oklch(0.525 0.125 155)' },
    { id: 'violet', label: 'Violet', swatch: 'oklch(0.545 0.125 295)' },
    { id: 'gold', label: 'Gold', swatch: 'oklch(0.545 0.125 75)' },
    { id: 'rose', label: 'Rose', swatch: 'oklch(0.545 0.125 12)' },
];

export const SIDEBARS = ['navy', 'light'];
export const DENSITIES = ['compact', 'default', 'comfortable'];

export const DEFAULT_APPEARANCE = { accent: 'steel', sidebar: 'navy' };

// localStorage keys. `theme` keeps its old name so existing devices keep their choice.
export const KEYS = {
    mode: 'theme', //            'light' | 'dark' | 'system'
    accent: 'ds.accent', //       accent in use (read at start-up so the app never flashes the wrong colour)
    deviceAccent: 'ds.accent.device', // chosen on this computer when the server can't store it
    sidebar: 'ds.sidebar', //    sidebar in use (read at start-up, like accent)
    deviceSidebar: 'ds.sidebar.device', // chosen on this computer when the server can't store it
    density: 'ds.density',
};

const valid = (list, v, fallback) => (list.some((x) => (x.id || x) === v) ? v : fallback);
export const validMode = (v) => valid(MODES, v, 'system');
export const validAccent = (v) => valid(ACCENTS, v, null);
export const validSidebar = (v) => valid(SIDEBARS, v, null);
export const validDensity = (v) => valid(DENSITIES, v, 'default');

export const readStored = (key) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

export const writeStored = (key, value) => {
    try {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch {
        /* storage blocked — the choice still applies for this session */
    }
};
