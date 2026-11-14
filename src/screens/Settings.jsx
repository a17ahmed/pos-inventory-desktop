import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiLogOut,
    FiBriefcase,
    FiPrinter,
    FiLock,
    FiDownload,
    FiAlertTriangle,
    FiPlusSquare,
    FiInfo,
    FiEdit2,
    FiUser,
    FiRefreshCw,
    FiFileText,
} from 'react-icons/fi';
import {
    PageHeader,
    SectionCard,
    Button,
    IconButton,
    Dialog,
    Field,
    Input,
    Textarea,
    Select,
    Switch,
    SegmentedControl,
    StatusChip,
    cn,
} from '../components/ui';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { updateBusiness, updateAdmin, changeAdminPassword, updateBusinessSettings } from '../services/api/business';
import AppearanceSettings from '../components/AppearanceSettings';
import { buildReceiptHTML } from '../utils/receiptTemplate';
import { printReceipt as printReceiptUtil, PRINTER_NAME_KEY, PAPER_WIDTH_KEY } from '../utils/printReceipt';
import { appAlert, appConfirm } from '../components/AppDialog';
import { isDesktopApp } from '../utils/platform';

const CURRENCIES = [
    ['PKR', 'PKR — Pakistani Rupee'],
    ['USD', 'USD — US Dollar'],
    ['EUR', 'EUR — Euro'],
    ['GBP', 'GBP — British Pound'],
    ['AED', 'AED — UAE Dirham'],
    ['SAR', 'SAR — Saudi Riyal'],
];

const initialsOf = (name = '') =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('') || '?';

/** One line of a settings card: icon tile · title + help text · the control on the right. */
function SettingRow({ icon: Icon, tone = 'neutral', title, description, children, className }) {
    const TILE = {
        neutral: 'bg-muted text-muted-foreground',
        accent: 'bg-accent text-accent-foreground',
        warning: 'bg-warning-chip text-warning-chip-foreground',
        destructive: 'bg-destructive-chip text-destructive-chip-foreground',
    };
    return (
        <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 last:pb-0', className)}>
            {Icon ? (
                <span className={cn('w-9 h-9 shrink-0 rounded-xl inline-flex items-center justify-center', TILE[tone])}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                </span>
            ) : null}
            <div className="flex-1 min-w-[200px]">
                <p className="text-body-lg font-medium text-foreground">{title}</p>
                {description ? <p className="mt-0.5 text-body-sm text-muted-foreground">{description}</p> : null}
            </div>
            {children ? <div className="flex items-center gap-2 shrink-0">{children}</div> : null}
        </div>
    );
}

/** A label over a control + a button on one line (Field wraps a single control only). */
const LabelledRow = ({ id, label, hint, children }) => (
    <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-body-sm font-medium text-foreground">
            {label}
        </label>
        <div className="flex gap-2">{children}</div>
        {hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
    </div>
);

/** Label/value pairs shown in a card (read-only view of what the edit dialog changes). */
const DetailGrid = ({ items }) => (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {items.map(([label, value]) => (
            <div key={label} className="min-w-0">
                <dt className="text-caption text-muted-foreground">{label}</dt>
                <dd className={cn('mt-0.5 text-body break-words', value ? 'text-foreground' : 'text-muted-foreground')}>{value || 'Not set'}</dd>
            </div>
        ))}
    </dl>
);

const Settings = () => {
    const navigate = useNavigate();
    const { user, logout, isAdmin } = useAuth();
    const { business, refreshBusiness } = useBusiness();

    const [activeModal, setActiveModal] = useState(null); // 'profile' | 'business' | 'receipt' | 'password' | 'about'
    const [appVersion, setAppVersion] = useState('');
    const [updateLabel, setUpdateLabel] = useState('');
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [savingBusiness, setSavingBusiness] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '' });
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordError, setPasswordError] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [bizForm, setBizForm] = useState({}); // the fields of the open Business / Receipt dialog
    const setBiz = (patch) => setBizForm((f) => ({ ...f, ...patch }));
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [previewMode, setPreviewMode] = useState('cash');
    const [printers, setPrinters] = useState([]);
    const [selectedPrinter, setSelectedPrinter] = useState(() => {
        try { return localStorage.getItem(PRINTER_NAME_KEY) || ''; } catch (e) { return ''; }
    });
    const [paperWidth, setPaperWidth] = useState(() => {
        try { return localStorage.getItem(PAPER_WIDTH_KEY) || '42'; } catch (e) { return '42'; }
    });
    const [printingTest, setPrintingTest] = useState(false);

    const showToast = (message, error = false) =>
        toast(message, { id: 'settings', tone: error ? 'error' : 'success', duration: 3000 });

    const handleSelectPaperWidth = (w) => {
        setPaperWidth(w);
        try { localStorage.setItem(PAPER_WIDTH_KEY, w); } catch (e) { /* ignore */ }
    };

    const handlePrintWidthTest = async () => {
        if (!window.electronAPI?.printWidthTest) return;
        setPrintingTest(true);
        try {
            const res = await window.electronAPI.printWidthTest({
                printerName: (() => { try { return localStorage.getItem(PRINTER_NAME_KEY) || undefined; } catch (e) { return undefined; } })(),
            });
            if (!res?.success) appAlert(res?.error || 'Could not print the width test.', { title: 'Printing failed', danger: true });
        } catch (e) {
            appAlert(e?.message || 'Could not print the width test.', { title: 'Printing failed', danger: true });
        } finally {
            setPrintingTest(false);
        }
    };

    // Load installed printers (Windows/Mac) so the user can pick their thermal printer.
    const loadPrinters = () => {
        window.electronAPI?.getPrinters?.().then((list) => setPrinters(Array.isArray(list) ? list : [])).catch(() => {});
    };

    const handleSelectPrinter = (name) => {
        setSelectedPrinter(name);
        try {
            if (name) localStorage.setItem(PRINTER_NAME_KEY, name);
            else localStorage.removeItem(PRINTER_NAME_KEY);
        } catch (e) { /* ignore */ }
    };

    useEffect(() => {
        window.electronAPI?.getAppVersion?.().then((v) => setAppVersion(v || ''));
        window.electronAPI?.onUpdateStatus?.((data) => {
            setCheckingUpdate(false);
            if (data.status === 'up-to-date') setUpdateLabel(`You're up to date (v${data.version})`);
            else if (data.status === 'available') setUpdateLabel(`Downloading v${data.version}…`);
            else if (data.status === 'downloading') setUpdateLabel(`Downloading… ${data.percent || 0}%`);
            else if (data.status === 'ready') setUpdateLabel('Update ready — restart the app to use it');
            else if (data.status === 'error') setUpdateLabel('The download failed — it will try again by itself');
        });
    }, []);

    const handleCheckUpdate = () => {
        setCheckingUpdate(true);
        setUpdateLabel('Checking…');
        window.electronAPI?.checkForUpdates?.().catch(() => {
            setCheckingUpdate(false);
            setUpdateLabel("Couldn't check for updates");
        });
    };

    // Business-wide: may a customer's special rate sell an item below cost?
    // Off = server rejects below-cost lines even with a limit override.
    const allowSellBelowCost = business?.settings?.allowSellBelowCost === true;
    const [savingBelowCost, setSavingBelowCost] = useState(false);
    const handleToggleSellBelowCost = async () => {
        const next = !allowSellBelowCost;
        if (next && !(await appConfirm(
            'Cashiers with the "Sell beyond discount limit" permission will be able to sell items below cost price at a customer\'s special rate.',
            { title: 'Allow selling below cost?', confirmText: 'Allow', danger: true }
        ))) return;
        setSavingBelowCost(true);
        try {
            await updateBusinessSettings({ ...(business?.settings || {}), allowSellBelowCost: next });
            await refreshBusiness();
        } catch (err) {
            appAlert('Failed to save: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingBelowCost(false);
        }
    };

    // Business-wide: may the POS add items to a customer's credit bill from today?
    const allowBillAmend = business?.settings?.allowBillAmend === true;
    const [savingBillAmend, setSavingBillAmend] = useState(false);
    const handleToggleBillAmend = async () => {
        setSavingBillAmend(true);
        try {
            await updateBusinessSettings({ ...(business?.settings || {}), allowBillAmend: !allowBillAmend });
            await refreshBusiness();
        } catch (err) {
            appAlert('Failed to save: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingBillAmend(false);
        }
    };

    // Business-wide: print the receipt automatically after a bill is saved?
    // Missing = on (backend default). Optimistic: flip now, roll back if the save fails.
    const [autoPrintOverride, setAutoPrintOverride] = useState(null);
    const autoPrint = autoPrintOverride ?? (business?.settings?.autoPrint !== false);
    const [savingAutoPrint, setSavingAutoPrint] = useState(false);
    const handleToggleAutoPrint = async () => {
        const next = !autoPrint;
        setAutoPrintOverride(next);
        setSavingAutoPrint(true);
        try {
            // Backend merges settings, so only autoPrint is sent.
            await updateBusinessSettings({ autoPrint: next });
            await refreshBusiness(); // updates context + cached business so the POS sees it now
            showToast(next ? 'Auto print turned on' : 'Auto print turned off');
        } catch (err) {
            showToast('Failed to save: ' + (err.response?.data?.message || err.message), true);
        } finally {
            setAutoPrintOverride(null); // fall back to the saved value (rolls back on failure)
            setSavingAutoPrint(false);
        }
    };

    const openBusiness = () => {
        setBizForm({
            name: business?.name || '',
            phone: business?.phone || '',
            email: business?.email || '',
            currency: business?.currency || 'PKR',
            address: { ...(business?.address || {}), street: business?.address?.street || '', city: business?.address?.city || '' },
        });
        setActiveModal('business');
    };

    const openReceipt = () => {
        setBizForm({
            receiptFooter: business?.receiptFooter ?? 'Thank you for your business!',
            receiptNote: business?.receiptNote || '',
            showCustomerPhone: !!business?.showCustomerPhone,
            showCustomerAddress: !!business?.showCustomerAddress,
        });
        loadPrinters();
        setActiveModal('receipt');
    };

    const handleSaveBusiness = async () => {
        if (activeModal === 'business' && !bizForm.name?.trim()) return;
        setSavingBusiness(true);
        try {
            const id = business?._id || business?.id;
            await updateBusiness(id, bizForm);
            await refreshBusiness();
            setActiveModal(null);
            showToast(activeModal === 'receipt' ? 'Receipt settings saved' : 'Shop details saved');
        } catch (err) {
            appAlert('Failed to save: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingBusiness(false);
        }
    };

    // Fixed sample data so the three payment modes are directly comparable.
    const buildSampleOpts = (mode, store) => {
        const items = [
            { name: 'Basmati Rice 5kg', qty: 2, price: 1450, discountAmount: 100 },
            { name: 'Cooking Oil 1L', qty: 1, price: 650, discountAmount: 0 },
            { name: 'Sugar 1kg', qty: 3, price: 180, discountAmount: 20 },
        ];
        const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
        const itemDiscounts = items.reduce((s, it) => s + it.discountAmount, 0);
        const billDiscount = 50;
        const total = subtotal - itemDiscounts - billDiscount;

        const base = {
            store,
            currency: business?.currency || 'Rs.',
            billNumber: 'PRV-1042',
            date: new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }),
            customerName: 'John Smith',
            customerPhone: '0300-1234567',
            customerAddress: '45-B, Model Town, Lahore',
            cashierName: 'Ali Raza',
            items,
            subtotal,
            tax: 0,
            itemDiscounts,
            billDiscount,
            total,
        };

        if (mode === 'partial') {
            const paid = Math.round(total * 0.6);
            return { ...base, paymentMethod: 'cash', amountPaid: paid, amountDue: total - paid, cashGiven: paid, change: 0, customerBalanceBefore: 500 };
        }
        if (mode === 'credit') {
            return { ...base, paymentMethod: 'credit', amountPaid: 0, amountDue: total, cashGiven: 0, change: 0, customerBalanceBefore: 1200 };
        }
        const cashGiven = Math.ceil(total / 100) * 100 + 500;
        return { ...base, paymentMethod: 'cash', amountPaid: total, amountDue: 0, cashGiven, change: cashGiven - total, customerBalanceBefore: 0 };
    };

    // The preview shows the unsaved receipt text
    const previewStore = { ...(business || {}), ...bizForm };
    const handlePrintSampleReceipt = () => printReceiptUtil(buildSampleOpts(previewMode, previewStore));

    const handleSaveProfile = async () => {
        if (!profileForm.name.trim()) return;
        setSavingProfile(true);
        try {
            const id = user?.id || user?._id;
            await updateAdmin(id, profileForm);
            setActiveModal(null);
            window.location.reload();
        } catch (err) {
            appAlert('Failed to save: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingProfile(false);
        }
    };

    const handleLogout = async () => {
        if (await appConfirm('You will need your password to sign in again.', { title: 'Sign out?', confirmText: 'Sign out', danger: true })) {
            await logout();
            navigate('/login');
        }
    };

    const handleChangePassword = async () => {
        setPasswordError('');
        if (!passwordForm.currentPassword || !passwordForm.newPassword) return setPasswordError('Fill in all three boxes.');
        if (passwordForm.newPassword.length < 8) return setPasswordError('The new password needs at least 8 characters.');
        if (passwordForm.newPassword !== passwordForm.confirmPassword) return setPasswordError("The two new passwords don't match.");
        setSavingPassword(true);
        try {
            await changeAdminPassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            });
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setActiveModal(null);
            showToast('Password changed');
        } catch (err) {
            setPasswordError(err.response?.data?.message || "Couldn't change the password.");
        } finally {
            setSavingPassword(false);
        }
    };

    const address = [business?.address?.street, business?.address?.city].filter(Boolean).join(', ');
    const close = () => setActiveModal(null);

    return (
        <div className="p-6 animate-fadeIn max-w-3xl mx-auto">
            <PageHeader title="Settings" subtitle="Your shop, receipts, how the app looks, and your account." />

            <div className="flex flex-col gap-4">
                {/* ── You ── */}
                <SectionCard>
                    <div className="flex flex-wrap items-center gap-4">
                        <span
                            aria-hidden="true"
                            className="w-14 h-14 shrink-0 rounded-full bg-accent text-accent-foreground inline-flex items-center justify-center font-heading text-h4"
                        >
                            {initialsOf(user?.name)}
                        </span>
                        <div className="flex-1 min-w-[200px]">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="font-heading text-h3 text-foreground">{user?.name || (isAdmin ? 'Admin' : 'Staff')}</h2>
                                <StatusChip size="sm" tone={isAdmin ? 'accent' : 'neutral'} label={isAdmin ? 'Admin' : 'Staff'} />
                            </div>
                            <p className="mt-0.5 text-body text-muted-foreground break-all">
                                {isAdmin ? user?.email || 'No email' : `Signs in as ${user?.employeeId || '—'}`}
                                {business?.name ? ` · ${business.name}` : ''}
                            </p>
                        </div>
                        {isAdmin ? (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                        setPasswordError('');
                                        setActiveModal('password');
                                    }}
                                >
                                    <FiLock aria-hidden="true" />
                                    Change password
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setProfileForm({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
                                        setActiveModal('profile');
                                    }}
                                >
                                    <FiEdit2 aria-hidden="true" />
                                    Edit
                                </Button>
                            </div>
                        ) : (
                            <Button variant="outline" onClick={() => navigate('/profile')}>
                                <FiUser aria-hidden="true" />
                                My profile & password
                            </Button>
                        )}
                    </div>
                </SectionCard>

                {/* ── Shop ── */}
                <SectionCard
                    title="Shop"
                    description="Printed on every receipt and shown on statements."
                    actions={
                        <Button variant="outline" size="xs" onClick={openBusiness}>
                            <FiEdit2 aria-hidden="true" />
                            Edit
                        </Button>
                    }
                >
                    <DetailGrid
                        items={[
                            ['Shop name', business?.name],
                            ['Currency', business?.currency || 'PKR'],
                            ['Phone', business?.phone],
                            ['Email', business?.email],
                            ['Address', address],
                        ]}
                    />
                </SectionCard>

                {/* ── Receipts and printing ── */}
                <SectionCard title="Receipts and printing" bodyClassName="divide-y divide-[var(--hairline)] -mt-2">
                    <SettingRow
                        icon={FiFileText}
                        title="Receipt text and printer"
                        description={
                            [
                                business?.receiptFooter ? `“${business.receiptFooter}”` : null,
                                business?.receiptNote ? 'with a note' : null,
                                selectedPrinter ? `Printer: ${selectedPrinter}` : null,
                            ]
                                .filter(Boolean)
                                .join(' · ') || 'Thank-you message, note, printer and paper width'
                        }
                    >
                        <Button variant="outline" size="xs" onClick={openReceipt}>
                            Open
                        </Button>
                    </SettingRow>
                    {isAdmin ? (
                        <SettingRow
                            icon={FiPrinter}
                            title="Print the receipt by itself"
                            description={
                                isDesktopApp
                                    ? 'After each sale. When off, press Print on the sale screen.'
                                    : 'After each sale, in the desktop app. On the web, press Print.'
                            }
                        >
                            <Switch checked={autoPrint} onChange={handleToggleAutoPrint} disabled={savingAutoPrint} label="Print the receipt by itself after each sale" />
                        </SettingRow>
                    ) : null}
                </SectionCard>

                {/* ── Selling rules (admin) ── */}
                {isAdmin ? (
                    <SectionCard title="Selling rules" description="For the whole shop, on every counter." bodyClassName="divide-y divide-[var(--hairline)] -mt-2">
                        <SettingRow
                            icon={FiPlusSquare}
                            title="Add to today's bill"
                            description={
                                allowBillAmend
                                    ? "On — a customer's new items can go on their credit bill from today."
                                    : 'Off — every visit makes a new bill.'
                            }
                        >
                            <Switch
                                checked={allowBillAmend}
                                onChange={handleToggleBillAmend}
                                disabled={savingBillAmend}
                                label="Allow adding items to a customer's credit bill from today"
                            />
                        </SettingRow>
                        <SettingRow
                            icon={FiAlertTriangle}
                            tone={allowSellBelowCost ? 'destructive' : 'neutral'}
                            title="Selling below cost"
                            description={
                                allowSellBelowCost
                                    ? "On — a customer's special rate may go below cost price."
                                    : 'Off — nothing can be sold below its cost price.'
                            }
                        >
                            <Switch
                                checked={allowSellBelowCost}
                                onChange={handleToggleSellBelowCost}
                                disabled={savingBelowCost}
                                label="Allow selling below cost price"
                            />
                        </SettingRow>
                    </SectionCard>
                ) : null}

                {/* Theme, accent colour, sidebar */}
                <AppearanceSettings />

                {/* ── App ── */}
                <SectionCard title="App" bodyClassName="divide-y divide-[var(--hairline)] -mt-2">
                    {isDesktopApp ? (
                        <SettingRow
                            icon={FiDownload}
                            title="Updates"
                            description={updateLabel || `Version ${appVersion || '…'} — updates download by themselves.`}
                        >
                            <Button variant="outline" size="xs" onClick={handleCheckUpdate} loading={checkingUpdate}>
                                {!checkingUpdate && <FiRefreshCw aria-hidden="true" />}
                                Check now
                            </Button>
                        </SettingRow>
                    ) : null}
                    <SettingRow icon={FiInfo} title="About" description={isDesktopApp ? `POS Desktop · version ${appVersion || '…'}` : 'POS · web app'}>
                        <Button variant="ghost" size="xs" onClick={() => setActiveModal('about')}>
                            Details
                        </Button>
                    </SettingRow>
                </SectionCard>

                <div className="flex justify-end">
                    <Button variant="outline" onClick={handleLogout}>
                        <span className="inline-flex items-center gap-2 text-destructive">
                            <FiLogOut aria-hidden="true" />
                            Sign out
                        </span>
                    </Button>
                </div>
            </div>

            {/* ── Edit profile (admin) ── */}
            <Dialog
                open={activeModal === 'profile'}
                onClose={savingProfile ? undefined : close}
                title="Your details"
                description="Your name shows on receipts you make and in reports."
                footerBar
                footer={
                    <>
                        <Button variant="ghost" onClick={close} disabled={savingProfile}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveProfile} loading={savingProfile} disabled={!profileForm.name.trim()}>
                            Save
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label="Name" required>
                        <Input data-autofocus value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} />
                    </Field>
                    <Field label="Email" hint="This is how you sign in. It can't be changed here.">
                        <Input type="email" value={profileForm.email} readOnly />
                    </Field>
                    <Field label="Phone" optional>
                        <Input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
                    </Field>
                </div>
            </Dialog>

            {/* ── Shop details ── */}
            <Dialog
                open={activeModal === 'business'}
                onClose={savingBusiness ? undefined : close}
                title="Shop details"
                description="Printed at the top of receipts and statements."
                footerBar
                footer={
                    <>
                        <Button variant="ghost" onClick={close} disabled={savingBusiness}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveBusiness} loading={savingBusiness} disabled={!bizForm.name?.trim()}>
                            Save
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label="Shop name" required>
                        <Input data-autofocus value={bizForm.name || ''} onChange={(e) => setBiz({ name: e.target.value })} />
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Phone" optional>
                            <Input type="tel" value={bizForm.phone || ''} onChange={(e) => setBiz({ phone: e.target.value })} />
                        </Field>
                        <Field label="Email" optional>
                            <Input type="email" value={bizForm.email || ''} onChange={(e) => setBiz({ email: e.target.value })} />
                        </Field>
                    </div>
                    <Field label="Currency" hint="Used for every amount in the app and on receipts.">
                        <Select value={bizForm.currency || 'PKR'} onChange={(e) => setBiz({ currency: e.target.value })}>
                            {CURRENCIES.map(([v, l]) => (
                                <option key={v} value={v}>
                                    {l}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Street address" optional>
                        <Input
                            value={bizForm.address?.street || ''}
                            onChange={(e) => setBiz({ address: { ...bizForm.address, street: e.target.value } })}
                        />
                    </Field>
                    <Field label="City" optional>
                        <Input value={bizForm.address?.city || ''} onChange={(e) => setBiz({ address: { ...bizForm.address, city: e.target.value } })} />
                    </Field>
                </div>
            </Dialog>

            {/* ── Change password (admin) ── */}
            <Dialog
                open={activeModal === 'password'}
                onClose={savingPassword ? undefined : close}
                title="Change password"
                size="sm"
                footerBar
                footer={
                    <>
                        <Button variant="ghost" onClick={close} disabled={savingPassword}>
                            Cancel
                        </Button>
                        <Button onClick={handleChangePassword} loading={savingPassword}>
                            Change password
                        </Button>
                    </>
                }
            >
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleChangePassword();
                    }}
                >
                    <Field label="Current password">
                        <Input
                            data-autofocus
                            type="password"
                            autoComplete="current-password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                        />
                    </Field>
                    <Field label="New password" hint="At least 8 characters.">
                        <Input
                            type="password"
                            autoComplete="new-password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                        />
                    </Field>
                    <Field label="New password again" error={passwordError || undefined}>
                        <Input
                            type="password"
                            autoComplete="new-password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                        />
                    </Field>
                    <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
                </form>
            </Dialog>

            {/* ── Receipt settings ── */}
            <Dialog
                open={activeModal === 'receipt'}
                onClose={savingBusiness ? undefined : close}
                title="Receipt text and printer"
                size="lg"
                footerBar
                footer={
                    <>
                        <Button
                            variant="outline"
                            className="mr-auto"
                            onClick={() => {
                                setPreviewMode('cash');
                                setShowReceiptPreview(true);
                            }}
                        >
                            <FiPrinter aria-hidden="true" />
                            Preview
                        </Button>
                        <Button variant="ghost" onClick={close} disabled={savingBusiness}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveBusiness} loading={savingBusiness}>
                            Save
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-5">
                    {window.electronAPI?.getPrinters || window.electronAPI?.printWidthTest ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {window.electronAPI?.getPrinters ? (
                                <LabelledRow id="rcpt-printer" label="Receipt printer" hint="Saved on this computer only.">
                                    <Select id="rcpt-printer" className="flex-1" value={selectedPrinter} onChange={(e) => handleSelectPrinter(e.target.value)}>
                                        <option value="">Find it by itself</option>
                                        {printers.map((p) => (
                                            <option key={p.name} value={p.name}>
                                                {p.name}
                                                {p.isDefault ? ' (default)' : ''}
                                            </option>
                                        ))}
                                    </Select>
                                    <IconButton variant="outline" label="Look for printers again" onClick={loadPrinters}>
                                        <FiRefreshCw />
                                    </IconButton>
                                </LabelledRow>
                            ) : null}
                            {window.electronAPI?.printWidthTest ? (
                                <LabelledRow id="rcpt-width" label="Paper width" hint="If bills wrap, print a test and pick the widest that fits on one line.">
                                    <Select id="rcpt-width" className="flex-1" value={paperWidth} onChange={(e) => handleSelectPaperWidth(e.target.value)}>
                                        <option value="32">58 mm (32 letters)</option>
                                        <option value="42">80 mm narrow (42 letters)</option>
                                        <option value="48">80 mm standard (48 letters)</option>
                                    </Select>
                                    <Button variant="outline" onClick={handlePrintWidthTest} loading={printingTest}>
                                        Print test
                                    </Button>
                                </LabelledRow>
                            ) : null}
                        </div>
                    ) : null}
                    {window.electronAPI?.openLogsFolder ? (
                        <Button variant="link" className="self-start -mt-2" onClick={() => window.electronAPI.openLogsFolder()}>
                            Open the print log (for fixing printer problems)
                        </Button>
                    ) : null}

                    <Field label="Thank-you message" hint={`${(bizForm.receiptFooter || '').length} / 110`}>
                        <Input
                            maxLength={110}
                            value={bizForm.receiptFooter || ''}
                            onChange={(e) => setBiz({ receiptFooter: e.target.value })}
                            placeholder="e.g. Thank you for shopping with us!"
                        />
                    </Field>
                    <Field label="Note at the bottom" optional hint={`${(bizForm.receiptNote || '').length} / 110 — leave empty to print nothing`}>
                        <Textarea
                            maxLength={110}
                            rows={2}
                            className="resize-none"
                            value={bizForm.receiptNote || ''}
                            onChange={(e) => setBiz({ receiptNote: e.target.value })}
                            placeholder="e.g. Frozen items can't be returned. Exchange within 7 days."
                        />
                    </Field>

                    <div className="divide-y divide-[var(--hairline)] border-y border-hairline">
                        <SettingRow title="Customer's phone" description="Print the customer's phone number on their receipt." className="py-2.5">
                            <Switch checked={!!bizForm.showCustomerPhone} onChange={(v) => setBiz({ showCustomerPhone: v })} label="Print the customer's phone on the receipt" />
                        </SettingRow>
                        <SettingRow title="Customer's address" description="Print the customer's address on their receipt." className="py-2.5">
                            <Switch checked={!!bizForm.showCustomerAddress} onChange={(v) => setBiz({ showCustomerAddress: v })} label="Print the customer's address on the receipt" />
                        </SettingRow>
                    </div>
                </div>
            </Dialog>

            {/* ── Receipt preview ── */}
            <Dialog
                open={showReceiptPreview}
                onClose={() => setShowReceiptPreview(false)}
                title="Receipt preview"
                description="Sample sale, not a real bill. Shows your unsaved changes."
                zIndex={60}
                footerBar
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowReceiptPreview(false)}>
                            Close
                        </Button>
                        <Button onClick={handlePrintSampleReceipt}>
                            <FiPrinter aria-hidden="true" />
                            Print sample
                        </Button>
                    </>
                }
            >
                <SegmentedControl
                    label="Sample payment"
                    value={previewMode}
                    onChange={setPreviewMode}
                    className="mb-4"
                    options={[
                        { value: 'cash', label: 'Paid in cash' },
                        { value: 'partial', label: 'Part paid' },
                        { value: 'credit', label: 'On credit' },
                    ]}
                />
                <div className="rounded-xl bg-muted/60 p-4">
                    {/* Paper stays white in dark mode: it's what will print */}
                    <div
                        style={{
                            width: '72mm',
                            margin: '0 auto',
                            fontFamily: "'Courier New', monospace",
                            fontSize: '11px',
                            color: '#000', // design-ok: receipt paper is always white
                            background: '#fff', // design-ok
                            padding: '4mm 2mm',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                        }}
                        dangerouslySetInnerHTML={{ __html: buildReceiptHTML(buildSampleOpts(previewMode, previewStore)) }}
                    />
                </div>
            </Dialog>

            {/* ── About ── */}
            <Dialog open={activeModal === 'about'} onClose={close} size="sm" closeOnScrim title="About">
                <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-xl bg-accent text-accent-foreground inline-flex items-center justify-center">
                        <FiBriefcase className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div>
                        <p className="text-body-lg font-medium text-foreground">POS Desktop</p>
                        <p className="text-body-sm text-muted-foreground">{isDesktopApp ? `Version ${appVersion || '…'}` : 'Web app'}</p>
                    </div>
                </div>
                <p className="mt-4 text-body text-muted-foreground">Point of sale, stock, customers and money for your shop.</p>
            </Dialog>
        </div>
    );
};

export default Settings;
