import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isDesktopApp } from '../utils/platform';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { useTheme } from '../context/ThemeContext';
import { useMoneyBook } from '../context/MoneyBookContext';
import { PaymentDueBanner } from './AccountStatus';
import { Sidebar } from './shell/Sidebar';
import { TopBar } from './shell/TopBar';
import { buildNav, breadcrumbFor } from './shell/nav';
import { TopLoadingBar } from './ui/TopLoadingBar';

// App shell (design/ROADMAP.md Stage 5): Sidebar + TopBar + the page. Which pages a person
// sees is decided in shell/nav.js with the same rules as before.

const COLLAPSED_KEY = 'ds.nav.collapsed';
const readCollapsed = () => {
    try {
        const v = localStorage.getItem(COLLAPSED_KEY);
        if (v === '1') return true;
        if (v === '0') return false;
    } catch {
        /* storage blocked */
    }
    return window.innerWidth < 1280; // first run: small screens start with the icon rail
};

// A CSS colour (any format the browser knows, e.g. oklch) → #rrggbb, for the Windows title bar
const toHex = (cssColor) => {
    try {
        const c = document.createElement('canvas');
        c.width = c.height = 1;
        const ctx = c.getContext('2d');
        ctx.fillStyle = cssColor;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
    } catch {
        return null;
    }
};

const Layout = ({ children }) => {
    const { user, logout, isAdmin, isEmployee, permissions } = useAuth();
    const { business, config } = useBusiness();
    const { isDark, toggleTheme, accent } = useTheme();
    const { isOn: moneyBookOn, canViewBook } = useMoneyBook();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(readCollapsed);

    const groups = useMemo(
        () =>
            buildNav({
                isAdmin,
                isEmployee,
                permissions,
                labels: {
                    items: config?.itemsLabel,
                    staff: config?.staffLabel,
                    cashBook: moneyBookOn && canViewBook ? 'Money Book' : 'Cash Book',
                },
            }),
        [isAdmin, isEmployee, permissions, config?.itemsLabel, config?.staffLabel, moneyBookOn, canViewBook]
    );
    const crumbs = useMemo(() => breadcrumbFor(location.pathname, groups), [location.pathname, groups]);
    const canSee = (path) => groups.some((g) => g.items.some((i) => i.path === path));

    // Only the desktop app has a frameless window (traffic lights / title bar overlay)
    const isMac = isDesktopApp && (navigator.userAgentData?.platform === 'macOS' || /Mac/i.test(navigator.userAgent));
    const isWin = isDesktopApp && (navigator.userAgentData?.platform === 'Windows' || /Win/i.test(navigator.userAgent));

    // Windows title-bar buttons take the top bar's colours
    useEffect(() => {
        if (!isWin || !window.electronAPI?.setTitleBarColors) return;
        const css = getComputedStyle(document.documentElement);
        // design-ok: fallbacks only if the token can't be read; Electron needs plain hex here
        const bg = toHex(css.getPropertyValue('--background').trim()) || (isDark ? '#16181d' : '#f5f7fa'); // design-ok
        const fg = toHex(css.getPropertyValue('--foreground').trim()) || (isDark ? '#e8ecf2' : '#334155'); // design-ok
        window.electronAPI.setTitleBarColors(bg, fg);
    }, [isDark, accent, isWin]);

    const toggleSidebar = () =>
        setCollapsed((v) => {
            try {
                localStorage.setItem(COLLAPSED_KEY, v ? '0' : '1');
            } catch {
                /* storage blocked */
            }
            return !v;
        });

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // The cashier's checkout keeps a slim top bar (design 5.5)
    const isCheckout = isEmployee && (location.pathname === '/dashboard' || location.pathname === '/');

    return (
        <div className="flex h-screen bg-background print:h-auto print:bg-card">
            <Sidebar
                groups={groups}
                collapsed={collapsed}
                user={user}
                business={business}
                subtitle={`${config?.label || 'Retail'} · POS`}
                onLogout={handleLogout}
                onProfile={isEmployee ? () => navigate('/profile') : undefined}
                onSettings={canSee('/settings') ? () => navigate('/settings') : undefined}
                macInset={isMac}
            />

            <div className="flex-1 min-w-0 flex flex-col">
                <TopBar
                    crumbs={crumbs}
                    collapsed={collapsed}
                    onToggleSidebar={toggleSidebar}
                    isDark={isDark}
                    onToggleTheme={toggleTheme}
                    winInset={isWin}
                    slim={isCheckout}
                />
                <PaymentDueBanner />
                <div className="relative flex-1 min-h-0 flex flex-col">
                    {/* thin bar while the app is talking to the server */}
                    <TopLoadingBar />
                    <main className="flex-1 overflow-y-auto print:overflow-visible relative">{children}</main>
                </div>
            </div>
        </div>
    );
};

export default Layout;
