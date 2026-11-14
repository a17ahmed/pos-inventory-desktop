import React, { createContext, useContext, useState, useLayoutEffect, useEffect, useCallback, useMemo } from 'react';
import {
    KEYS,
    DEFAULT_APPEARANCE,
    readStored,
    writeStored,
    validMode,
    validAccent,
    validSidebar,
    validDensity,
} from '../utils/appearance';

const ThemeContext = createContext(null);

const systemPrefersDark = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

// Everything is set on <html>; the CSS in index.css does the rest.
const applyToDocument = ({ dark, accent, sidebar, density }) => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.setAttribute('data-accent', accent);
    root.setAttribute('data-sidebar', sidebar);
    root.setAttribute('data-density', density);
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

/**
 * Appearance for the whole app.
 * - mode (light / dark / system) and density are per computer.
 * - accent and sidebar style belong to the shop (business.settings.appearance, set by the
 *   admin). BusinessContext passes them in with setShopAppearance(). If the shop has none
 *   (or the server can't store it yet), the accent chosen on this computer is used.
 */
export const ThemeProvider = ({ children }) => {
    const [mode, setModeState] = useState(() => validMode(readStored(KEYS.mode)));
    const [systemDark, setSystemDark] = useState(systemPrefersDark);
    const [shopAppearance, setShopAppearanceState] = useState(null); // { accent, sidebar } from the server
    const [deviceAccent, setDeviceAccentState] = useState(() => validAccent(readStored(KEYS.deviceAccent)));
    const [deviceSidebar, setDeviceSidebarState] = useState(() => validSidebar(readStored(KEYS.deviceSidebar)));
    const [previewAccent, setPreviewAccent] = useState(null); // while the admin is picking
    const [density, setDensityState] = useState(() => validDensity(readStored(KEYS.density)));

    // Follow the OS when mode = system
    useEffect(() => {
        const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (!mq) return undefined;
        const onChange = (e) => setSystemDark(e.matches);
        mq.addEventListener?.('change', onChange);
        return () => mq.removeEventListener?.('change', onChange);
    }, []);

    const isDark = mode === 'system' ? systemDark : mode === 'dark';
    const shopAccent = validAccent(shopAppearance?.accent);
    const accent = previewAccent || shopAccent || deviceAccent || DEFAULT_APPEARANCE.accent;
    const shopSidebar = validSidebar(shopAppearance?.sidebar);
    const sidebar = shopSidebar || deviceSidebar || validSidebar(readStored(KEYS.sidebar)) || DEFAULT_APPEARANCE.sidebar;

    useLayoutEffect(() => {
        applyToDocument({ dark: isDark, accent, sidebar, density });
        // Cache what is in use so index.html can apply it before React starts (no colour flash)
        writeStored(KEYS.accent, accent);
        writeStored(KEYS.sidebar, sidebar);
    }, [isDark, accent, sidebar, density]);

    const setMode = useCallback((next) => {
        const m = validMode(next);
        writeStored(KEYS.mode, m);
        setModeState(m);
    }, []);

    // Old API, kept for the sidebar button and Settings switch
    const toggleTheme = useCallback(() => setMode(isDark ? 'light' : 'dark'), [isDark, setMode]);
    const setIsDark = useCallback((dark) => setMode(dark ? 'dark' : 'light'), [setMode]);

    const setShopAppearance = useCallback((appearance) => {
        setShopAppearanceState(appearance && typeof appearance === 'object' ? appearance : null);
    }, []);

    // Accent stored on this computer only (used when the shop has no accent saved)
    const setDeviceAccent = useCallback((id) => {
        const a = validAccent(id);
        writeStored(KEYS.deviceAccent, a);
        setDeviceAccentState(a);
    }, []);

    // Sidebar style stored on this computer only (used when the shop has none saved)
    const setDeviceSidebar = useCallback((id) => {
        const v = validSidebar(id);
        writeStored(KEYS.deviceSidebar, v);
        setDeviceSidebarState(v);
    }, []);

    const setDensity = useCallback((next) => {
        const d = validDensity(next);
        writeStored(KEYS.density, d);
        setDensityState(d);
    }, []);

    const value = useMemo(
        () => ({
            mode,
            setMode,
            isDark,
            toggleTheme,
            setIsDark,
            accent,
            shopAccent,
            deviceAccent,
            sidebar,
            shopSidebar,
            setDeviceSidebar,
            setShopAppearance,
            setDeviceAccent,
            setPreviewAccent,
            density,
            setDensity,
        }),
        [mode, setMode, isDark, toggleTheme, setIsDark, accent, shopAccent, deviceAccent, sidebar, shopSidebar, setDeviceSidebar, setShopAppearance, setDeviceAccent, density, setDensity]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeContext;
