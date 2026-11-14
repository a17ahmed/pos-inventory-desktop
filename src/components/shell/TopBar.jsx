import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSidebar, FiSun, FiMoon, FiChevronRight } from 'react-icons/fi';
import { cn } from '../ui/cn';
import { IconButton } from '../ui/Button';

// DESIGN_HANDOFF "Top bar": breadcrumb left; status, theme and the sidebar switch. The page's
// H1 is drawn by the page header band, not here. The bar is also the window's drag strip
// (frameless desktop window), so every control in it is marked app-no-drag.

const useOnline = () => {
    const [online, setOnline] = useState(navigator.onLine);
    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => {
            window.removeEventListener('online', on);
            window.removeEventListener('offline', off);
        };
    }, []);
    return online;
};

/**
 * props: crumbs [{ label, to? }], collapsed, onToggleSidebar, isDark, onToggleTheme,
 *        (one sun / moon button; "follow this computer" lives in Settings → Appearance)
 *        winInset (leave room for the Windows title-bar buttons), slim (cashier checkout)
 */
export function TopBar({ crumbs = [], collapsed, onToggleSidebar, isDark, onToggleTheme, winInset, slim }) {
    const online = useOnline();
    return (
        <div
            className={cn(
                'flex-none flex items-center gap-3 border-b border-hairline bg-background app-drag-region print:hidden',
                slim ? 'h-12 px-3' : 'h-14 px-4',
                winInset && 'pr-[150px]'
            )}
        >
            <div className="app-no-drag">
                <IconButton label={collapsed ? 'Show the menu' : 'Hide the menu'} size="xs" onClick={onToggleSidebar} aria-expanded={!collapsed}>
                    <FiSidebar />
                </IconButton>
            </div>

            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                <ol className="flex items-center gap-1.5 text-body min-w-0">
                    {crumbs.map((c, i) => {
                        const last = i === crumbs.length - 1;
                        return (
                            <li key={`${c.label}-${i}`} className={cn('flex items-center gap-1.5', last ? 'min-w-0' : 'flex-none')}>
                                {i > 0 && <FiChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-none" aria-hidden="true" />}
                                {c.to && !last ? (
                                    <Link to={c.to} className="app-no-drag text-muted-foreground hover:text-foreground rounded-sm">
                                        {c.label}
                                    </Link>
                                ) : (
                                    <span aria-current={last ? 'page' : undefined} className={cn('truncate', last ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                                        {c.label}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </nav>

            <div className="app-no-drag flex items-center gap-3">
                <span
                    role="status"
                    className={cn(
                        'hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 text-body-sm font-medium',
                        online ? 'bg-success-chip text-success-chip-foreground' : 'bg-destructive-chip text-destructive-chip-foreground'
                    )}
                >
                    <span className={cn('w-1.5 h-1.5 rounded-full', online ? 'bg-success animate-ds-pulse' : 'bg-destructive')} aria-hidden="true" />
                    {online ? 'Online' : 'Offline'}
                </span>
                <IconButton
                    label={isDark ? 'Dark theme — switch to light' : 'Light theme — switch to dark'}
                    size="xs"
                    onClick={onToggleTheme}
                >
                    {isDark ? <FiMoon /> : <FiSun />}
                </IconButton>
            </div>
        </div>
    );
}

export default TopBar;
