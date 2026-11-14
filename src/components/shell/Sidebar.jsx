import React from 'react';
import { NavLink } from 'react-router-dom';
import { FiMoreVertical, FiLogOut, FiUser, FiSettings } from 'react-icons/fi';
import { cn } from '../ui/cn';
import { Tooltip } from '../ui/Tooltip';
import { Menu } from '../ui/Menu';

// DESIGN_HANDOFF "Sidebar": navy column (or light — Settings → Appearance), group labels in
// mono, active row = sidebar-accent fill + a 2px bar on the left, no glow. Collapses to a 64px
// icon rail with tooltips. The colours come from --sidebar-* (index.css), so they follow the
// shop's accent and the navy/light choice.

export const SIDEBAR_WIDTH = { expanded: 240, collapsed: 64 };

const initials = (name = '') =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('') || 'U';

const Logo = () => (
    <div className="w-9 h-9 flex-none rounded-xl bg-sidebar-primary text-sidebar-primary-foreground inline-flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" className="w-[18px] h-[18px]" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
        </svg>
    </div>
);

const NavItem = ({ item, collapsed }) => {
    const link = (
        <NavLink
            to={item.path}
            end={item.path === '/dashboard'}
            aria-label={collapsed ? item.label : undefined}
            className={({ isActive }) =>
                cn(
                    'relative flex items-center rounded-row text-body select-none outline-none',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-primary',
                    collapsed ? 'w-10 h-10 justify-center mx-auto' : 'h-9 gap-3 px-3',
                    isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium before:absolute before:left-0 before:inset-y-1.5 before:w-0.5 before:rounded-full before:bg-sidebar-primary'
                        : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground'
                )
            }
        >
            <item.icon className="w-4 h-4 flex-none" aria-hidden="true" />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && item.badge > 0 && (
                <span className="ml-auto text-caption font-semibold tabular-nums rounded-full px-1.5 bg-sidebar-primary text-sidebar-primary-foreground">{item.badge}</span>
            )}
        </NavLink>
    );
    return collapsed ? (
        <Tooltip content={item.label} side="right" delay={150}>
            {link}
        </Tooltip>
    ) : (
        link
    );
};

/**
 * props: groups (from buildNav), collapsed, user, business, subtitle, onLogout, onProfile,
 *        onSettings, macInset (leave room for the macOS window buttons)
 */
export function Sidebar({ groups, collapsed, user, business, subtitle, onLogout, onProfile, onSettings, macInset }) {
    const userMenu = [
        ...(onProfile ? [{ label: 'Profile', icon: FiUser, onSelect: onProfile }] : []),
        ...(onSettings ? [{ label: 'Settings', icon: FiSettings, onSelect: onSettings }] : []),
        ...(onProfile || onSettings ? [{ separator: true }] : []),
        { label: 'Log out', icon: FiLogOut, danger: true, onSelect: onLogout },
    ];
    const name = user?.name || 'User';
    const sub = user?.employeeId || user?.email || '';

    return (
        <aside
            aria-label="Main navigation"
            className="flex-none h-full flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border/30 print:hidden transition-[width] duration-200 ease-out"
            style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
        >
            {/* macOS: the window's traffic-light buttons sit over this strip */}
            {macInset && <div className="h-7 flex-none app-drag-region" />}

            {/* Shop */}
            <div className={cn('flex items-center gap-3 flex-none', collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3', macInset ? '' : 'pt-4')}>
                <Logo />
                {!collapsed && (
                    <div className="min-w-0">
                        <p className="font-heading text-body-lg font-semibold truncate text-sidebar-foreground">{business?.name || 'POS'}</p>
                        <p className="font-mono text-mono-2xs text-sidebar-foreground/60 truncate">{subtitle}</p>
                    </div>
                )}
            </div>

            {/* Pages */}
            <nav className={cn('flex-1 min-h-0 overflow-y-auto overflow-x-hidden dark-scrollbar pb-3', collapsed ? 'px-3' : 'px-3')}>
                {groups.map((g, gi) => (
                    <div key={g.id} className="flex flex-col gap-0.5">
                        {collapsed ? (
                            gi > 0 && <div className="mx-auto my-2.5 w-6 h-px bg-sidebar-border/35" aria-hidden="true" />
                        ) : (
                            <p className="px-3 pt-4 pb-1.5 font-mono text-overline-lg uppercase text-sidebar-foreground/50">{g.label}</p>
                        )}
                        {g.items.map((item) => (
                            <NavItem key={item.path} item={item} collapsed={collapsed} />
                        ))}
                    </div>
                ))}
            </nav>

            {/* Person */}
            <div className={cn('flex-none border-t border-sidebar-border/30', collapsed ? 'p-3' : 'p-3')}>
                <Menu
                    label="Account"
                    side={collapsed ? 'right' : 'top'}
                    align={collapsed ? 'end' : 'start'}
                    items={userMenu}
                    trigger={
                        <button
                            type="button"
                            aria-label={`${name} — account menu`}
                            className={cn(
                                'w-full flex items-center gap-2.5 rounded-xl text-left outline-none hover:bg-sidebar-accent/55',
                                'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-primary',
                                collapsed ? 'justify-center p-1' : 'p-1.5'
                            )}
                        >
                            <span className="w-8 h-8 flex-none rounded-full bg-sidebar-accent text-sidebar-accent-foreground inline-flex items-center justify-center text-caption font-semibold">
                                {initials(name)}
                            </span>
                            {!collapsed && (
                                <>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-body font-medium truncate text-sidebar-foreground">{name}</span>
                                        <span className="block text-body-sm truncate text-sidebar-foreground/60">{sub}</span>
                                    </span>
                                    <FiMoreVertical className="w-4 h-4 flex-none text-sidebar-foreground/60" aria-hidden="true" />
                                </>
                            )}
                        </button>
                    }
                />
            </div>
        </aside>
    );
}

export default Sidebar;
