import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { useTheme } from '../context/ThemeContext';
import {
    FiHome,
    FiPackage,
    FiRotateCcw,
    FiBarChart2,
    FiUser,
    FiLogOut,
    FiSun,
    FiMoon,
    FiUsers,
    FiFileText,
    FiDollarSign,
    FiSettings,
    FiPieChart,
    FiTruck,
    FiUserPlus,
    FiLayers,
    FiBook,
} from 'react-icons/fi';

const Layout = ({ children }) => {
    const { user, logout, isAdmin, isEmployee, permissions } = useAuth();
    const { business, config } = useBusiness();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [sidebarExpanded, setSidebarExpanded] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Admin navigation items
    const adminNavItems = [
        { path: '/dashboard', icon: FiHome, label: 'Dashboard', module: 'dashboard' },
        { path: '/products', icon: FiPackage, label: config?.itemsLabel || 'Products', module: 'products' },
        { path: '/employees', icon: FiUsers, label: config?.staffLabel || 'Employees', module: 'employees' },
        { path: '/customers', icon: FiUserPlus, label: 'Customers', module: 'customers' },
        { path: '/receipts', icon: FiFileText, label: 'Receipts', module: 'pos' },
        { path: '/returns', icon: FiRotateCcw, label: 'Returns', module: 'returns' },
        { path: '/expenses', icon: FiDollarSign, label: 'Expenses', module: 'expenses' },
        { path: '/cashbook', icon: FiBook, label: 'Cash Book', module: 'cashbook' },
        { path: '/vendors', icon: FiTruck, label: 'Vendors', module: 'vendors' },
        { path: '/inventory', icon: FiLayers, label: 'Inventory', module: 'products' },
        { path: '/reports', icon: FiPieChart, label: 'Reports', module: 'reports' },
        { path: '/settings', icon: FiSettings, label: 'Settings', module: 'settings' },
    ];

    // Employee navigation — "Home" is the POS selling screen (controlled by pos permission)
    const allEmployeeNavItems = [
        { path: '/dashboard', icon: FiHome, label: 'Home', module: 'pos' },
        { path: '/analytics', icon: FiBarChart2, label: 'Dashboard', module: 'dashboard' },
        { path: '/products', icon: FiPackage, label: config?.itemsLabel || 'Products', module: 'products' },
        { path: '/employees', icon: FiUsers, label: config?.staffLabel || 'Employees', module: 'employees' },
        { path: '/customers', icon: FiUserPlus, label: 'Customers', module: 'customers' },
        { path: '/receipts', icon: FiFileText, label: 'Receipts', module: 'pos' },
        { path: '/returns', icon: FiRotateCcw, label: 'Returns', module: 'returns' },
        { path: '/expenses', icon: FiDollarSign, label: 'Expenses', module: 'expenses' },
        { path: '/cashbook', icon: FiBook, label: 'Cash Book', module: 'cashbook' },
        { path: '/vendors', icon: FiTruck, label: 'Vendors', module: 'vendors' },
        { path: '/inventory', icon: FiLayers, label: 'Inventory', module: 'products' },
        { path: '/reports', icon: FiPieChart, label: 'Reports', module: 'reports' },
        { path: '/settings', icon: FiSettings, label: 'Settings', module: 'settings' },
        { path: '/profile', icon: FiUser, label: 'Profile', module: null },
    ];

    // Filter employee nav by permissions
    const employeeNavItems = isEmployee
        ? allEmployeeNavItems.filter(item => {
            if (!item.module) return true; // Profile always visible
            if (!permissions) return item.module === 'pos';
            return permissions[item.module]?.view === true;
        })
        : [];

    // Check if running on macOS for safe area
    const isMac = navigator.userAgentData?.platform === 'macOS' || /Mac/i.test(navigator.userAgent);

    // Slim Sidebar Nav Item (Icon only, tooltip on hover)
    const SlimNavItem = ({ item }) => (
        <NavLink
            to={item.path}
            className={({ isActive }) =>
                `group relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 ${
                    isActive
                        ? isDark
                            ? 'bg-[rgba(255,210,100,0.1)] text-d-accent border border-[rgba(255,210,100,0.22)]'
                            : 'bg-amber-100 text-amber-600 border border-amber-200'
                        : isDark
                            ? 'text-d-faint hover:bg-[rgba(255,210,100,0.1)] hover:text-d-accent'
                            : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                }`
            }
        >
            {({ isActive }) => (
                <>
                    <item.icon size={17} />
                    {item.badge > 0 && (
                        <span className={`absolute -top-1 -right-1 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${isDark ? 'bg-d-accent text-d-bg shadow-[0_2px_8px_rgba(255,200,60,0.4)]' : 'bg-amber-500 text-white shadow-sm'}`}>
                            {item.badge}
                        </span>
                    )}
                    {isActive && (
                        <div className={`absolute right-[-1px] top-[25%] h-[50%] w-[2px] rounded-l bg-gradient-to-b ${isDark ? 'from-d-accent to-d-accent-s shadow-[0_0_10px_#ffd264]' : 'from-amber-500 to-amber-600'}`} />
                    )}
                    {/* Tooltip */}
                    <span className={`absolute left-[calc(100%+14px)] text-[11px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 pointer-events-none transition-all duration-150 z-50 tracking-wide group-hover:opacity-100 group-hover:translate-x-1 ${isDark ? 'bg-d-card border border-[rgba(255,210,100,0.22)] text-[#f0f2f8] shadow-[0_8px_24px_rgba(0,0,0,0.5)]' : 'bg-slate-800 text-white shadow-lg'}`}>
                        {item.label}
                    </span>
                </>
            )}
        </NavLink>
    );

    // Expanded Sidebar Nav Item
    const ExpandedNavItem = ({ item }) => (
        <NavLink
            to={item.path}
            className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative select-none ${
                    isActive
                        ? 'bg-gradient-to-r from-amber-100 to-amber-50 dark:from-[rgba(255,210,100,0.13)] dark:to-[rgba(255,185,50,0.06)] text-amber-600 dark:text-d-accent font-medium border border-amber-200 dark:border-[rgba(255,210,100,0.18)]'
                        : 'text-slate-600 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass hover:text-slate-800 dark:hover:text-d-text'
                }`
            }
        >
            {({ isActive }) => (
                <>
                    <item.icon size={16} className={isActive ? 'text-amber-600 dark:text-d-accent' : ''} />
                    <span className="text-sm whitespace-nowrap">{item.label}</span>
                    {item.badge > 0 && (
                        <span className="ml-auto bg-amber-500 dark:bg-d-accent text-white dark:text-d-card text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm dark:shadow-[0_2px_8px_rgba(255,200,60,0.4)]">
                            {item.badge}
                        </span>
                    )}
                    {isActive && (
                        <div className="absolute right-0 top-[20%] h-[60%] w-[3px] rounded-l-full bg-gradient-to-b from-amber-500 to-amber-600 dark:from-d-accent dark:to-d-accent-s shadow-sm dark:shadow-[0_0_8px_#ffd264]" />
                    )}
                </>
            )}
        </NavLink>
    );

    // For admin, use slim sidebar (both light and dark mode)
    const useSlimSidebar = isAdmin;

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-d-bg dark:bg-ambient print:h-auto print:bg-white">
            {/* Slim Sidebar (Admin) - Pushes content when expanded */}
            {useSlimSidebar ? (
                <aside
                    className={`${isDark ? 'bg-[#0d0f17]' : 'bg-white'} border-r ${isDark ? 'border-[rgba(255,255,255,0.06)]' : 'border-slate-200'} flex flex-col items-center py-5 relative z-10 flex-shrink-0 overflow-hidden print:hidden`}
                    style={{
                        width: sidebarExpanded ? '200px' : '66px',
                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onMouseEnter={() => setSidebarExpanded(true)}
                    onMouseLeave={() => setSidebarExpanded(false)}
                >
                    {/* macOS Traffic Light Safe Area */}
                    {isMac && <div className="h-5 flex-shrink-0 app-drag-region w-full" />}

                    {/* Logo */}
                    <div
                        className="flex items-center gap-3 mb-5 w-full"
                        style={{
                            paddingLeft: sidebarExpanded ? '16px' : '13px',
                            paddingRight: sidebarExpanded ? '16px' : '13px',
                            transition: 'padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center flex-shrink-0 cursor-pointer ${isDark ? 'shadow-[0_0_20px_rgba(255,200,60,0.4),0_0_50px_rgba(255,200,60,0.1)]' : 'shadow-md'}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke={isDark ? 'var(--d-bg)' : 'white'} strokeWidth="2.5" className="w-[19px] h-[19px]">
                                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                                <line x1="3" y1="6" x2="21" y2="6"/>
                                <path d="M16 10a4 4 0 01-8 0"/>
                            </svg>
                        </div>
                        <div
                            className="flex flex-col gap-0.5 overflow-hidden whitespace-nowrap"
                            style={{
                                opacity: sidebarExpanded ? 1 : 0,
                                transform: sidebarExpanded ? 'translateX(0)' : 'translateX(-10px)',
                                transition: 'opacity 0.3s ease, transform 0.3s ease',
                                transitionDelay: sidebarExpanded ? '0.1s' : '0s'
                            }}
                        >
                            <span className={`font-display text-[17px] font-semibold tracking-[0.01em] ${isDark ? 'text-d-heading' : 'text-slate-800'}`}>
                                {business?.name || 'Histore'}
                            </span>
                            <span className={`text-[11px] font-light tracking-[0.04em] ${isDark ? 'text-d-muted' : 'text-slate-500'}`}>
                                {config?.label || 'Retail'} · POS
                            </span>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav
                        className="flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden dark-scrollbar w-full"
                        style={{
                            paddingLeft: sidebarExpanded ? '16px' : '12px',
                            paddingRight: sidebarExpanded ? '16px' : '12px',
                            transition: 'padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        {sidebarExpanded ? (
                            // Expanded view
                            <div className="space-y-1">
                                {adminNavItems.map((item, index) => (
                                    <div
                                        key={item.path}
                                        style={{
                                            opacity: sidebarExpanded ? 1 : 0,
                                            transform: sidebarExpanded ? 'translateX(0)' : 'translateX(-10px)',
                                            transition: 'opacity 0.3s ease, transform 0.3s ease',
                                            transitionDelay: `${0.05 + index * 0.02}s`
                                        }}
                                    >
                                        <ExpandedNavItem item={item} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            // Slim view
                            <>
                                {adminNavItems.slice(0, 3).map((item) => (
                                    <SlimNavItem key={item.path} item={item} />
                                ))}
                                <div className={`w-[26px] h-[1px] my-2 mx-auto ${isDark ? 'bg-[rgba(255,255,255,0.06)]' : 'bg-slate-200'}`} />
                                {adminNavItems.slice(3, 6).map((item) => (
                                    <SlimNavItem key={item.path} item={item} />
                                ))}
                                <div className={`w-[26px] h-[1px] my-2 mx-auto ${isDark ? 'bg-[rgba(255,255,255,0.06)]' : 'bg-slate-200'}`} />
                                {adminNavItems.slice(6).map((item) => (
                                    <SlimNavItem key={item.path} item={item} />
                                ))}
                            </>
                        )}
                    </nav>

                    {/* Footer */}
                    <div className={`mt-auto flex flex-col items-center gap-2 pt-4 border-t w-full ${isDark ? 'border-[rgba(255,255,255,0.06)]' : 'border-slate-200'} ${sidebarExpanded ? 'px-4' : 'px-3'}`}>
                        {sidebarExpanded ? (
                            <>
                                {/* Theme Toggle */}
                                <button
                                    onClick={toggleTheme}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isDark ? 'text-d-muted hover:bg-d-glass hover:text-d-text' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                                >
                                    {isDark ? <FiSun size={15} /> : <FiMoon size={15} />}
                                    <span className="text-[13px]">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                                    <div className={`ml-auto w-9 h-5 rounded-full relative transition-all duration-300 ${isDark ? 'bg-d-accent' : 'bg-slate-300'}`}>
                                        <div className={`absolute top-[3px] w-[14px] h-[14px] rounded-full transition-all duration-300 ${isDark ? 'left-[18px] bg-white' : 'left-[3px] bg-white'}`} />
                                    </div>
                                </button>

                                {/* User Card */}
                                <div className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${isDark ? 'hover:bg-d-glass' : 'hover:bg-slate-100'}`}>
                                    <div className={`w-[34px] h-[34px] rounded-full bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${isDark ? 'shadow-[0_4px_12px_rgba(91,156,246,0.35)]' : 'shadow-md'}`}>
                                        {user?.name?.charAt(0) || 'A'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[13px] font-medium truncate ${isDark ? 'text-d-text' : 'text-slate-800'}`}>
                                            {user?.name || 'Admin'}
                                        </p>
                                        <p className={`text-[11px] truncate ${isDark ? 'text-d-muted' : 'text-slate-500'}`}>
                                            {user?.email || 'admin'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className={`transition-colors ${isDark ? 'text-d-faint hover:text-d-muted' : 'text-slate-400 hover:text-slate-600'}`}
                                        title="Logout"
                                    >
                                        <FiLogOut size={15} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Slim Theme Toggle */}
                                <button
                                    onClick={toggleTheme}
                                    className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${isDark ? 'text-d-faint hover:bg-[rgba(255,210,100,0.1)] hover:text-d-accent' : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'}`}
                                >
                                    {isDark ? <FiSun size={17} /> : <FiMoon size={17} />}
                                    <span className={`absolute left-[calc(100%+14px)] text-[11px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 pointer-events-none transition-all duration-150 z-50 tracking-wide group-hover:opacity-100 group-hover:translate-x-1 ${isDark ? 'bg-d-card border border-[rgba(255,210,100,0.22)] text-[#f0f2f8] shadow-[0_8px_24px_rgba(0,0,0,0.5)]' : 'bg-slate-800 text-white shadow-lg'}`}>
                                        {isDark ? 'Light Mode' : 'Dark Mode'}
                                    </span>
                                </button>

                                {/* Slim User Avatar */}
                                <div
                                    className={`w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center text-sm font-bold text-white cursor-pointer mt-2 ${isDark ? 'shadow-[0_4px_16px_rgba(91,156,246,0.3)] border-2 border-d-glass-hover' : 'shadow-md border-2 border-slate-200'}`}
                                    onClick={handleLogout}
                                    title="Logout"
                                >
                                    {user?.name?.charAt(0) || 'A'}
                                </div>
                            </>
                        )}
                    </div>
                </aside>
            ) : (
                /* Standard Sidebar (Employee or Light Mode) */
                <aside className="w-60 bg-white dark:bg-d-card border-r border-slate-200 dark:border-d-border flex flex-col animate-fade-slide-left relative z-10 flex-shrink-0 print:hidden">
                    {/* macOS Traffic Light Safe Area */}
                    {isMac && <div className="h-8 flex-shrink-0 app-drag-region" />}

                    {/* Brand */}
                    <div className="flex items-center gap-3 px-4 py-4 pb-6">
                        <div className="w-[42px] h-[42px] rounded-[13px] bg-gradient-to-br from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s flex items-center justify-center shadow-md dark:shadow-[0_0_0_1px_rgba(255,210,100,0.3),0_8px_28px_rgba(255,185,50,0.35)] flex-shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5 dark:stroke-d-card">
                                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                                <line x1="3" y1="6" x2="21" y2="6"/>
                                <path d="M16 10a4 4 0 01-8 0"/>
                            </svg>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="font-display text-[17px] font-semibold tracking-[0.01em] text-slate-800 dark:text-d-heading">
                                {business?.name || 'Histore'}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-d-muted font-light tracking-[0.04em]">
                                {config?.label || 'Retail'} · POS System
                            </span>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 overflow-y-auto dark-scrollbar">
                        {isEmployee ? (
                            <div className="space-y-1">
                                {employeeNavItems.map((item) => (
                                    <ExpandedNavItem key={item.path} item={item} />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {adminNavItems.map((item) => (
                                    <ExpandedNavItem key={item.path} item={item} />
                                ))}
                            </div>
                        )}
                    </nav>

                    {/* Footer */}
                    <div className="border-t border-slate-200 dark:border-d-border p-4 space-y-1">
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass hover:text-slate-800 dark:hover:text-d-text transition-all duration-200"
                        >
                            {isDark ? <FiSun size={15} /> : <FiMoon size={15} />}
                            <span className="text-[13px]">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                            <div className={`ml-auto w-9 h-5 rounded-full relative transition-all duration-300 ${isDark ? 'bg-amber-500 dark:bg-d-accent' : 'bg-slate-300 dark:bg-d-faint'}`}>
                                <div className={`absolute top-[3px] w-[14px] h-[14px] rounded-full transition-all duration-300 ${isDark ? 'left-[18px] bg-white' : 'left-[3px] bg-white dark:bg-d-muted'}`} />
                            </div>
                        </button>

                        {/* User Card */}
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-d-glass transition-all duration-200 cursor-pointer">
                            <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-blue-500 to-emerald-400 dark:from-d-blue dark:to-d-green flex items-center justify-center text-sm font-bold text-white shadow-md dark:shadow-[0_4px_12px_rgba(91,156,246,0.35)] flex-shrink-0">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-slate-800 dark:text-d-text truncate">
                                    {user?.name || 'User'}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-d-muted truncate">
                                    {isEmployee ? user?.employeeId || 'Staff' : user?.email || 'admin'}
                                </p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="text-slate-400 dark:text-d-faint hover:text-slate-600 dark:hover:text-d-muted transition-colors"
                                title="Logout"
                            >
                                <FiLogOut size={15} />
                            </button>
                        </div>
                    </div>
                </aside>
            )}

            {/* Main content */}
            <main className={`flex-1 overflow-y-auto print:overflow-visible relative z-5 ${isMac ? 'pt-8' : ''}`}>
                {children}
            </main>
        </div>
    );
};

export default Layout;
