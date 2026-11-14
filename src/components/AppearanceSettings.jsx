import React, { useState } from 'react';
import { FiSun, FiMoon, FiMonitor, FiCheck, FiDroplet, FiSidebar } from 'react-icons/fi';
import { SegmentedControl } from './ui/Choice';
import { useTheme } from '../context/ThemeContext';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { updateBusinessSettings } from '../services/api/business';
import { MODES, ACCENTS, DEFAULT_APPEARANCE } from '../utils/appearance';

const MODE_ICONS = { light: FiSun, dark: FiMoon, system: FiMonitor };

/**
 * Settings → Appearance.
 * - Theme (light / dark / system): this computer only, for everyone.
 * - Accent colour: the whole shop, changed by the admin (business.settings.appearance).
 *   If the server can't store it yet (older backend → 400), it is kept on this computer.
 * Written with the new design tokens only (design/02-foundations.md).
 */
const AppearanceSettings = () => {
    const { mode, setMode, accent, shopAccent, sidebar, shopSidebar, setPreviewAccent, setDeviceAccent, setDeviceSidebar } = useTheme();
    const { refreshBusiness } = useBusiness();
    const { isAdmin } = useAuth();
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null); // { tone: 'success' | 'warning' | 'error', text }

    const keepOnThisComputer = (id) => {
        setDeviceAccent(id);
        setPreviewAccent(null);
        setStatus({
            tone: 'warning',
            text: "Saved on this computer only — the server doesn't support shop colours yet.",
        });
    };

    const pickAccent = async (id) => {
        if (!isAdmin || saving || id === accent) return;
        setPreviewAccent(id); // show it straight away
        setSaving(true);
        setStatus(null);
        try {
            const res = await updateBusinessSettings({
                appearance: { accent: id, sidebar: sidebar || DEFAULT_APPEARANCE.sidebar },
            });
            if (res.data?.settings?.appearance?.accent === id) {
                await refreshBusiness();
                setPreviewAccent(null);
                setStatus({ tone: 'success', text: 'Saved for the whole shop — every computer gets it at the next sign-in.' });
            } else {
                // The server accepted the request but didn't keep the field
                keepOnThisComputer(id);
            }
        } catch (err) {
            if (err.response?.status === 400 && !shopAccent) {
                keepOnThisComputer(id);
            } else {
                setPreviewAccent(null); // back to the colour in use
                setStatus({ tone: 'error', text: err.response?.data?.message || "Couldn't save the colour. Try again." });
            }
        } finally {
            setSaving(false);
        }
    };

    // Sidebar style: navy or light, for the whole shop (same save as the accent)
    const [sidebarStatus, setSidebarStatus] = useState(null);
    const keepSidebarOnThisComputer = (id) => {
        setDeviceSidebar(id);
        setSidebarStatus({
            tone: 'warning',
            text: "Saved on this computer only — the server doesn't support shop sidebar styles yet.",
        });
    };
    const pickSidebar = async (id) => {
        if (!isAdmin || saving || id === sidebar) return;
        setSaving(true);
        setSidebarStatus(null);
        try {
            const res = await updateBusinessSettings({ appearance: { accent: shopAccent || accent, sidebar: id } });
            if (res.data?.settings?.appearance?.sidebar === id) {
                await refreshBusiness();
                setSidebarStatus({ tone: 'success', text: 'Saved for the whole shop.' });
            } else {
                // The server accepted the request but didn't keep the field
                keepSidebarOnThisComputer(id);
            }
        } catch (err) {
            // Older servers reject the unknown "appearance" field with 400 "Validation failed"
            if (err.response?.status === 400 && !shopSidebar) {
                keepSidebarOnThisComputer(id);
            } else {
                setSidebarStatus({ tone: 'error', text: err.response?.data?.message || "Couldn't save the sidebar style. Try again." });
            }
        } finally {
            setSaving(false);
        }
    };

    const statusClass = {
        success: 'text-success-chip-foreground',
        warning: 'text-warning-chip-foreground',
        error: 'text-destructive',
    };

    return (
        <section aria-labelledby="appearance-title" className="bg-card text-card-foreground border border-hairline rounded-2xl shadow-1 overflow-hidden">
            <header className="px-5 pt-4 pb-2">
                <h3 id="appearance-title" className="font-heading text-h4 text-foreground">Appearance</h3>
                <p className="mt-0.5 text-caption text-muted-foreground">Theme is for this computer; colour and sidebar are for the whole shop.</p>
            </header>
            <div className="divide-y divide-[var(--hairline)] px-5 pb-1.5">
            {/* Theme */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
                    {React.createElement(MODE_ICONS[mode] || FiMonitor, { size: 16 })}
                </div>
                <div className="flex-1 min-w-[180px]">
                    <p className="text-body-lg font-medium text-foreground">Theme</p>
                    <p className="text-body-sm text-muted-foreground">
                        {mode === 'system' ? 'Follows this computer’s light / dark setting' : 'This computer only'}
                    </p>
                </div>
                <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-xl bg-muted p-1 gap-1">
                    {MODES.map((m) => {
                        const Icon = MODE_ICONS[m.id];
                        const active = mode === m.id;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setMode(m.id)}
                                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] text-body font-medium ${
                                    active
                                        ? 'bg-card text-foreground shadow-1'
                                        : 'text-muted-foreground hover:bg-[var(--hover-overlay)] hover:text-foreground'
                                }`}
                            >
                                <Icon size={14} aria-hidden="true" />
                                {m.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Accent colour */}
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3.5">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
                    <FiDroplet size={16} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-[180px]">
                    <p className="text-body-lg font-medium text-foreground">Accent colour</p>
                    <p className="text-body-sm text-muted-foreground">
                        {isAdmin
                            ? 'Buttons, links and highlights — for the whole shop.'
                            : 'Set by the shop admin.'}
                    </p>
                    {status && <p className={`mt-1.5 text-body-sm ${statusClass[status.tone]}`}>{status.text}</p>}
                </div>
                <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2">
                    {ACCENTS.map((a) => {
                        const active = accent === a.id;
                        return (
                            <button
                                key={a.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                aria-label={a.label}
                                title={a.label}
                                disabled={!isAdmin || saving}
                                onClick={() => pickAccent(a.id)}
                                className={`relative w-9 h-9 rounded-full flex items-center justify-center border disabled:cursor-not-allowed ${
                                    active ? 'border-foreground' : 'border-hairline'
                                } ${!isAdmin && !active ? 'opacity-50' : ''}`}
                            >
                                <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: a.swatch }}>
                                    {active && <FiCheck size={14} className="text-white" aria-hidden="true" />}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sidebar style */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-sidebar text-sidebar-foreground border border-hairline flex items-center justify-center">
                    <FiSidebar size={16} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-[180px]">
                    <p className="text-body-lg font-medium text-foreground">Sidebar</p>
                    <p className="text-body-sm text-muted-foreground">
                        {isAdmin ? 'Navy, or light like the pages — for the whole shop.' : 'Set by the shop admin.'}
                    </p>
                    {sidebarStatus && <p className={`mt-1.5 text-body-sm ${statusClass[sidebarStatus.tone]}`}>{sidebarStatus.text}</p>}
                </div>
                <SegmentedControl
                    label="Sidebar style"
                    value={sidebar}
                    onChange={pickSidebar}
                    disabled={!isAdmin || saving}
                    options={[
                        { value: 'navy', label: 'Navy' },
                        { value: 'light', label: 'Light' },
                    ]}
                />
            </div>
            </div>
        </section>
    );
};

export default AppearanceSettings;
