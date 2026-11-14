import React, { useState, useEffect, useRef, useMemo } from 'react';
import { newIdempotencyKey } from '../utils/idempotency';
import { PageHeader, SegmentedControl, Button, IconButton, Input, StatusChip, cn } from '../components/ui';
import { toast, setToastPlacement, dismissToast } from '../components/ui/Toast';
import AdminDashboard from './dashboard/AdminDashboard';
import { toLocalDateStr } from '../utils/date';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getProducts } from '../services/api/products';
import { getReceiptStats } from '../services/api/receipts';
import { createBill, getBill, getOpenBillsForCustomer, addBillItems } from '../services/api/bills';
import { getDashboardSummary } from '../services/api/dashboard';
import { printReceipt as printReceiptUtil } from '../utils/printReceipt';
import { appAlert, appConfirm, appChoose } from '../components/AppDialog';
import { searchCustomers, saveCustomerRate } from '../services/api/customers';
import { getCreditPayments, getPrimaryPaymentMethod } from '../utils/billCredit';
import { useMoneyBook } from '../context/MoneyBookContext';
import AccountPicker from '../components/AccountPicker';
import { apiErrorMessage } from '../utils/moneyBook';
import { formatAmount } from '../utils/money';
import {
    buildRateMap,
    getRateStatus,
    getRateLine,
    describeRateWarnings,
    canSaveCustomerRates,
    canSellBeyondLimit,
} from '../utils/specialRates';
import {
    FiTrendingUp,
    FiShoppingCart,
    FiDollarSign,
    FiArrowUp,
    FiArrowDown,
    FiCalendar,
    FiSearch,
    FiPlus,
    FiMinus,
    FiTrash2,
    FiX,
    FiPause,
    FiCornerUpLeft,
    FiCheck,
    FiCreditCard,
    FiSmartphone,
    FiList,
    FiPhone,
    FiUser,
    FiUserCheck,
    FiPercent,
    FiChevronUp,
    FiChevronDown,
    FiAlertTriangle,
    FiPackage,
    FiActivity,
    FiAward,
    FiAlertCircle,
    FiZap,
    FiUsers,
    FiFileText,
    FiTruck,
    FiBookOpen,
    FiPieChart,
    FiGrid,
    FiPrinter,
    FiPlusCircle,
    FiTag,
} from 'react-icons/fi';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts';

// ==================== EMPLOYEE DASHBOARD (POS checkout) ====================

// A product's initials on a tint of one of the chart colours (picked from the category, so a
// category keeps one colour) — instead of the same 📦 for everything.
const hashText = (t) => [...String(t || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const initialsOf = (name) =>
    String(name || '?')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
const ProductMark = ({ name, category, size = 'md' }) => {
    const color = `var(--chart-${(hashText(category || name) % 6) + 1})`;
    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex-none inline-flex items-center justify-center rounded-row font-semibold tracking-tight',
                size === 'sm' ? 'w-8 h-8 text-caption' : 'w-10 h-10 text-body'
            )}
            style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color: `color-mix(in oklab, ${color} 80%, var(--foreground))` }}
        >
            {initialsOf(name)}
        </span>
    );
};
// The till's dialogs: same surface as the app's Dialog, but the POS keeps its own open/close and
// keyboard handling (Esc, Ctrl+0, scanner focus), so there is no focus trap here.
const PosModal = ({ title, description, icon: Icon, iconTone = 'neutral', onClose, size = 'md', z = 'z-50', children }) => {
    const titleId = React.useId();
    return (
        <div className={cn('fixed inset-0 flex items-center justify-center p-4 bg-[var(--overlay)] animate-ds-fade', z)}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={cn(
                    'relative w-full max-h-[calc(100vh-2rem)] flex flex-col bg-popover text-popover-foreground border border-hairline rounded-pop shadow-2 animate-ds-dialog-in',
                    size === 'sm' ? 'max-w-sm' : 'max-w-md'
                )}
            >
                <div className="flex items-start gap-3 px-5 pt-5 pb-3">
                    {Icon ? (
                        <span
                            className={cn(
                                'flex-none w-10 h-10 rounded-xl inline-flex items-center justify-center',
                                { neutral: 'bg-muted text-muted-foreground', warning: 'bg-warning-chip text-warning-chip-foreground', success: 'bg-success-chip text-success-chip-foreground', info: 'bg-info-chip text-info-chip-foreground' }[iconTone]
                            )}
                        >
                            <Icon size={18} aria-hidden="true" />
                        </span>
                    ) : null}
                    <div className="flex-1 min-w-0">
                        <h2 id={titleId} className="font-heading text-h3 text-foreground">
                            {title}
                        </h2>
                        {description ? <p className="mt-0.5 text-body text-muted-foreground">{description}</p> : null}
                    </div>
                    {onClose ? (
                        <IconButton label="Close" size="2xs" onClick={onClose} className="-mr-1.5 -mt-0.5" data-dialog-close>
                            <FiX />
                        </IconButton>
                    ) : null}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
            </div>
        </div>
    );
};

// Payment method buttons (cash / card / online / credit) — a row of equal tiles
const MethodTiles = ({ options, value, onChange }) => (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Payment method">
        {options.map((m) => {
            const active = value === m.id;
            return (
                <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={m.disabled}
                    title={m.title}
                    onClick={() => !m.disabled && onChange(m.id)}
                    className={cn(
                        'h-[52px] rounded-xl border text-body font-medium inline-flex flex-col items-center justify-center gap-0.5 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-45 disabled:cursor-not-allowed',
                        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground enabled:hover:bg-[var(--hover-overlay)]'
                    )}
                >
                    <m.icon size={16} aria-hidden="true" />
                    {m.label}
                </button>
            );
        })}
    </div>
);

const SumRow = ({ label, value, tone, strong, className }) => (
    <div className={cn('flex justify-between gap-3 text-body', className)}>
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('tabular-nums', strong && 'font-semibold', tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : 'text-foreground')}>{value}</span>
    </div>
);

// The till keeps its product list and today's figure in memory between visits, so going back to
// Home is instant; it refreshes them quietly in the background.
// Keyed by shop + signed-in person, so a different login never sees the previous one's data.
const tillCache = { key: null, products: null, today: null };
const tillCacheFor = (key) => (key && tillCache.key === key ? tillCache : { products: null, today: null });
const buildProductIndex = (list) => {
    const cache = {};
    list.forEach((p) => {
        if (p.barcode) cache[p.barcode] = p;
        if (p.sku) cache[p.sku] = p;
        cache[p._id] = p;
    });
    return cache;
};

const daysAgo = (d) => {
    if (!d) return null;
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (Number.isNaN(days)) return null;
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 60) return `${days} days ago`;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * The customer on this bill, as soon as they're picked: what they owe (or have in credit), how much
 * of their credit limit is used, when they last came, special prices and the shop's note. Everything
 * comes from the customer record the search already returned — no extra wait.
 */
function CustomerCard({ bill, fmt, onChange, onRemove, onOpenLedger }) {
    const info = bill.customerInfo || {};
    const balance = Number(bill.customerBalance) || 0;
    const limit = Number(info.creditLimit) || 0;
    const used = limit > 0 ? Math.max(0, balance) / limit : 0;
    const usedTone = used > 1 ? 'bg-destructive' : used >= 0.8 ? 'bg-warning' : 'bg-primary';
    const rates = Object.keys(bill.customerRates || {}).length;
    const last = daysAgo(info.lastPurchase);
    return (
        <div className="rounded-2xl border border-hairline bg-card shadow-1 overflow-hidden">
            <div className="flex items-start gap-3 px-3.5 pt-3.5">
                <span className="w-10 h-10 rounded-full bg-accent text-accent-foreground inline-flex items-center justify-center font-semibold text-body flex-none">
                    {initialsOf(bill.customerName)}
                </span>
                <div className="flex-1 min-w-0">
                    <p className="text-body-lg font-semibold text-foreground truncate">{bill.customerName}</p>
                    {bill.customerPhone ? <p className="text-body-sm text-muted-foreground tabular-nums">{bill.customerPhone}</p> : null}
                </div>
                <div className="flex -mr-1.5 -mt-1">
                    <IconButton label="Change customer" size="2xs" onClick={onChange}>
                        <FiUsers />
                    </IconButton>
                    <IconButton label="Remove customer" size="2xs" onClick={onRemove}>
                        <FiX />
                    </IconButton>
                </div>
            </div>

            <div className="mx-3.5 mt-3 rounded-xl bg-muted/50 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-body-sm text-muted-foreground">{balance > 0 ? 'Owes' : balance < 0 ? 'Store credit' : 'Balance'}</span>
                    <span className={cn('font-heading text-h3 tabular-nums', balance > 0 ? 'text-destructive' : balance < 0 ? 'text-success' : 'text-foreground')}>
                        {balance === 0 ? 'All paid' : fmt(Math.abs(balance))}
                    </span>
                </div>
                {limit > 0 ? (
                    <div className="mt-2">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={cn('h-full rounded-full', usedTone)} style={{ width: `${Math.min(100, used * 100)}%` }} />
                        </div>
                        <p className={cn('mt-1 text-caption', used > 1 ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                            {used > 1
                                ? `Over the credit limit of ${fmt(limit)}`
                                : `${Math.round(used * 100)}% of ${fmt(limit)} credit limit · ${fmt(Math.max(0, limit - Math.max(0, balance)))} left`}
                        </p>
                    </div>
                ) : null}
            </div>

            <dl className="px-3.5 py-3 grid grid-cols-2 gap-x-3 gap-y-2 text-body-sm">
                <div>
                    <dt className="text-muted-foreground">Last visit</dt>
                    <dd className="text-foreground">{last || 'First visit'}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Bought in all</dt>
                    <dd className="text-foreground tabular-nums">{fmt(info.totalBilled || 0)}</dd>
                </div>
                {info.creditDays ? (
                    <div>
                        <dt className="text-muted-foreground">Pays within</dt>
                        <dd className="text-foreground">{info.creditDays} days</dd>
                    </div>
                ) : null}
                {rates ? (
                    <div>
                        <dt className="text-muted-foreground">Special prices</dt>
                        <dd className="text-foreground">
                            {rates} product{rates === 1 ? '' : 's'}
                        </dd>
                    </div>
                ) : null}
            </dl>

            {info.notes ? (
                <p className="mx-3.5 mb-3 rounded-xl border border-warning/30 bg-warning-chip px-3 py-2 text-body-sm text-warning-chip-foreground whitespace-pre-line break-words">
                    {info.notes}
                </p>
            ) : null}

            {onOpenLedger ? (
                <button
                    type="button"
                    onClick={onOpenLedger}
                    className="w-full flex items-center justify-center gap-1.5 border-t border-hairline py-2.5 text-body font-medium text-primary hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                    <FiBookOpen size={14} aria-hidden="true" />
                    Open their ledger
                </button>
            ) : null}
        </div>
    );
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
const MOD = IS_MAC ? '⌘' : 'Ctrl';
const Kbd = ({ children, className }) => (
    <kbd className={cn('inline-flex items-center h-5 px-1.5 rounded-md border border-hairline bg-muted/60 font-mono text-mono-2xs text-muted-foreground', className)}>{children}</kbd>
);
const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const { user, permissions, isAdmin } = useAuth();
    const { business, refreshBusiness } = useBusiness();
    // Admins bypass all permission checks (permissions is null for them).
    const canViewProfit = !permissions || permissions.pos?.viewProfit === true;
    const canSaveRates = canSaveCustomerRates(isAdmin, permissions);
    const canOpenLedger = isAdmin || permissions?.customers?.view === true;
    const canOverrideLimit = canSellBeyondLimit(isAdmin, permissions);
    // Business setting: off = server rejects below-cost lines even with an override.
    const allowSellBelowCost = business?.settings?.allowSellBelowCost === true;

    // Billing state
    const [billingActive, setBillingActive] = useState(true); // Always show billing view
    const [bills, setBills] = useState([{
        id: '1',
        name: 'Bill 1',
        items: [],
        createdAt: new Date().toISOString(),
        customer: null,
        customerName: '',
        customerPhone: '',
        billDiscountAmount: 0,
        billDiscountReason: '',
    }]);

    // Cart item inline expansion (for profit details + per-item discount)
    const [expandedItemId, setExpandedItemId] = useState(null);

    // Customer picker
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [searchingCustomers, setSearchingCustomers] = useState(false);
    const [showWalkInConfirm, setShowWalkInConfirm] = useState(false);
    const customerPickerRef = useRef(null);
    const [activeBillId, setActiveBillId] = useState('1');
    const [billCounter, setBillCounter] = useState(1);

    // Products
    const cacheKey = `${business?._id || business?.id || ''}:${user?._id || user?.id || ''}`;
    const cached = tillCacheFor(cacheKey);
    const [products, setProducts] = useState(() => cached.products || []);
    const [productsCache, setProductsCache] = useState(() => (cached.products ? buildProductIndex(cached.products) : {}));
    const [productsReady, setProductsReady] = useState(() => !!cached.products);
    const [productsError, setProductsError] = useState(false);
    const pendingScanRef = useRef(''); // a barcode scanned before the product list arrived

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);

    // Stats
    const [todayStats, setTodayStats] = useState(() => cached.today);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashGiven, setCashGiven] = useState('');
    const [creditPaidNow, setCreditPaidNow] = useState('');
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const cashInputRef = useRef(null);


    // "Add to today's bill": offer shown after picking a customer who has an
    // open credit bill from today; payment choices for saving to that bill.
    const [amendOffer, setAmendOffer] = useState(null); // { posBillId, customerName, bills }
    const [amendPayMethod, setAmendPayMethod] = useState('credit'); // credit | cash | card | online
    const [amendPayAmount, setAmendPayAmount] = useState('');
    // Money Book: the account a payment lands in (only when the shop has it on)
    const { isOn: moneyBookOn, moneyFields, handleMoneyError } = useMoneyBook();
    const [posAccountId, setPosAccountId] = useState(null);
    const [amendAccountId, setAmendAccountId] = useState(null);
    // The current "add to bill" save attempt: { key, fingerprint, billId, payMethod, payAmount }.
    // Kept until the server gives a definite answer, so closing and reopening the
    // payment window and saving the same thing again reuses the same idempotency key.
    const amendKeyRef = useRef(null);
    // Keys of saves whose answer never arrived (timeout / connection lost) → fingerprint
    const amendUncertainRef = useRef(new Map());
    // Latest POS tabs, for answers that arrive after the cashier moved on
    const billsRef = useRef(bills);
    billsRef.current = bills;
    const openBillsReqRef = useRef(0); // only the newest "open bills" answer counts
    const amendEnabled = business?.settings?.allowBillAmend === true;
    const canAmendBills = !!isAdmin || (permissions?.pos?.create === true && permissions?.pos?.amendBill !== false);


    useEffect(() => {
        loadData();
        loadSavedBills();
        // Business settings (e.g. allowSellBelowCost) are cached from login; pull the
        // current ones so a change made in Settings applies without re-login.
        refreshBusiness?.().catch(() => {});
    }, []);

    // Debounced customer search
    useEffect(() => {
        if (!showCustomerPicker) return;
        const q = customerQuery.trim();
        if (q.length === 0) {
            setCustomerResults([]);
            return;
        }
        setSearchingCustomers(true);
        const timer = setTimeout(async () => {
            try {
                const res = await searchCustomers(q);
                setCustomerResults(res.data || []);
            } catch (err) {
                console.error('Customer search error:', err);
                setCustomerResults([]);
                const msg = err?.response?.data?.message || 'Failed to search customers';
                showToast(msg);
            } finally {
                setSearchingCustomers(false);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [customerQuery, showCustomerPicker]);

    // Close customer picker on outside click
    useEffect(() => {
        if (!showCustomerPicker) return;
        const handler = (e) => {
            if (customerPickerRef.current && !customerPickerRef.current.contains(e.target)) {
                setShowCustomerPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCustomerPicker]);

    // One POS toast at a time (a new one replaces the last, as before). The old emoji
    // markers now pick the tone: ⚠ warning · 🏷 rate (tag icon) · ➕ info.
    const showToast = (message, icon) =>
        toast(message, {
            id: 'pos',
            duration: 2400,
            tone: icon === '⚠' ? 'warning' : icon === '🏷' || icon === '➕' ? 'info' : 'neutral',
            icon: icon === '🏷' ? FiTag : undefined,
        });


    // Clicking a tile or a +/− button must not pull focus out of the scan box: a barcode scanner
    // types into whatever has focus and ends with Enter (which would press that button again).
    const keepScanFocus = (e) => e.preventDefault();
    const focusScan = () => setTimeout(() => inputRef.current?.focus(), 0);

    // Toasts go to the top while the till is open — the Pay button fills the bottom
    useEffect(() => {
        setToastPlacement('top');
        return () => setToastPlacement('bottom');
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const currentBill = bills.find(b => b.id === activeBillId);
            const hasItems = currentBill?.items?.length > 0;
            const anyModalOpen = showPaymentModal || !!amendOffer;

            // Ctrl+K or Cmd+K - Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                return;
            }

            // Ctrl+0 - Pay
            if ((e.ctrlKey || e.metaKey) && e.key === '0' && hasItems && !anyModalOpen) {
                e.preventDefault();
                openPayment();
                return;
            }

            // Escape - Close modals
            if (e.key === 'Escape') {
                if (showSuccess) { setShowSuccess(false); setSuccessData(null); setTimeout(() => inputRef.current?.focus(), 0); return; }
                if (showPaymentModal) { setShowPaymentModal(false); return; }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [bills, activeBillId, showPaymentModal, showSuccess, amendOffer]);

    // Scanner guard. A barcode scanner is a very fast keyboard that ends every scan with Enter.
    // If the cursor ever sits on a button (e.g. someone pressed Tab), the scan would type into
    // nothing and its Enter would press that button. So, whenever the cursor is NOT in a text box:
    //  • no window open → the first typed character moves the cursor to the scan box and the rest
    //    of the scan (and its Enter) land there as normal. Same on the "Sale complete" screen,
    //    which closes so the next sale can start.
    //  • a window is open → a fast burst ending in Enter is swallowed, so it can't press a button.
    // Space, Tab, arrows, Esc and slow typing are left alone, so keyboard use still works.
    const scanGuardRef = useRef({});
    scanGuardRef.current = {
        blocked: showPaymentModal || !!amendOffer || showWalkInConfirm || showCustomerPicker,
        showSuccess,
        startScan: (ch) => {
            if (showSuccess) { setShowSuccess(false); setSuccessData(null); }
            const input = inputRef.current;
            if (!input) return;
            input.focus();
            handleBarcodeInput({ target: { value: (input.value || '') + ch } });
        },
    };
    useEffect(() => {
        const NOT_TEXT = ['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image'];
        const isTextField = (el) =>
            !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
                (el.tagName === 'INPUT' && !NOT_TEXT.includes((el.type || 'text').toLowerCase())));
        let burst = 0; // characters typed quickly in a row while the cursor is off a text box
        let last = 0;

        const onKey = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || isTextField(document.activeElement)) { burst = 0; return; }
            const now = performance.now();
            const fast = now - last < 50;
            const g = scanGuardRef.current;

            if (e.key === 'Enter') {
                const wasScan = burst >= 3 && fast;
                burst = 0;
                if (wasScan) { e.preventDefault(); e.stopPropagation(); }
                return;
            }
            if (e.key.length !== 1 || e.key === ' ') { burst = 0; return; }

            burst = fast ? burst + 1 : 1;
            last = now;
            if (g.blocked) return;
            e.preventDefault();
            e.stopPropagation();
            burst = 0; // the scan box takes over from here
            g.startScan(e.key);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    // The "… added" toast would sit over the payment window's title
    useEffect(() => {
        if (showPaymentModal) dismissToast('pos');
    }, [showPaymentModal]);

    useEffect(() => {
        if (showPaymentModal && paymentMethod === 'cash') {
            setTimeout(() => cashInputRef.current?.focus(), 100);
        }
    }, [showPaymentModal, paymentMethod]);

    // Nothing waits for this: the till is usable at once; only the search box and the "Today"
    // figure show that their data is still on its way.
    const loadData = async () => {
        const [productRes, statsRes] = await Promise.allSettled([getProducts(), getReceiptStats({ filter: 'today' })]);
        if (productRes.status === 'fulfilled') {
            const productList = productRes.value.data || [];
            if (tillCache.key !== cacheKey) Object.assign(tillCache, { key: cacheKey, today: null });
            tillCache.products = productList;
            setProducts(productList);
            setProductsCache(buildProductIndex(productList));
            setProductsReady(true);
            setProductsError(false);
        } else {
            console.error('Error loading products:', productRes.reason);
            setProductsError(true);
        }
        if (statsRes.status === 'fulfilled') {
            const today = {
                totalSales: statsRes.value.data?.grossRevenue || 0,
                transactions: statsRes.value.data?.totalOrders || 0,
            };
            if (tillCache.key === cacheKey) tillCache.today = today;
            setTodayStats(today);
        }
    };

    const getProductEmoji = (category) => {
        const emojiMap = {
            'Drinks': '🥤',
            'Beverages': '🥤',
            'Snacks': '🍿',
            'Food': '🍔',
            'Electronics': '📱',
            'Stationery': '📝',
            'Misc': '📦',
            'General': '📦',
        };
        return emojiMap[category] || '📦';
    };

    const loadSavedBills = () => {
        try {
            const saved = localStorage.getItem('retailBills');
            const savedActiveId = localStorage.getItem('retailActiveBillId');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0) {
                    setBills(parsed);
                    const maxNum = Math.max(...parsed.map(b => parseInt(b.name.replace('Bill ', '')) || 0));
                    setBillCounter(maxNum);
                    setActiveBillId(savedActiveId && parsed.find(b => b.id === savedActiveId) ? savedActiveId : parsed[0].id);
                    setBillingActive(true);
                }
            }
        } catch (error) {
            console.error('Error loading saved bills:', error);
        }
    };

    const saveBills = (billsToSave, activeId) => {
        try {
            localStorage.setItem('retailBills', JSON.stringify(billsToSave));
            if (activeId !== undefined) {
                localStorage.setItem('retailActiveBillId', activeId || '');
            }
        } catch (error) {
            console.error('Error saving bills:', error);
        }
    };

    const createNewBill = () => {
        const newNum = billCounter + 1;
        const newBill = {
            id: Date.now().toString(),
            name: `Bill ${newNum}`,
            items: [],
            createdAt: new Date().toISOString(),
            customer: null,
            customerName: '',
            customerPhone: '',
            billDiscountAmount: 0,
            billDiscountReason: '',
        };
        setBillCounter(newNum);
        const updated = [...bills, newBill];
        setBills(updated);
        setActiveBillId(newBill.id);
        saveBills(updated, newBill.id);
        showToast('New bill created');
    };

    const switchBill = (billId) => {
        setActiveBillId(billId);
        saveBills(bills, billId);
        const bill = bills.find(b => b.id === billId);
        showToast(`Switched to ${bill?.name || 'Bill'}`);
    };

    const deleteBill = (billId) => {
        if (bills.length === 1) {
            // Reset to empty bill
            const newBill = {
                id: Date.now().toString(),
                name: 'Bill 1',
                items: [],
                createdAt: new Date().toISOString(),
                customer: null,
                customerName: '',
                customerPhone: '',
                billDiscountAmount: 0,
                billDiscountReason: '',
            };
            setBills([newBill]);
            setActiveBillId(newBill.id);
            setBillCounter(1);
            saveBills([newBill], newBill.id);
        } else {
            // Filter out the deleted bill and renumber remaining bills
            const filtered = bills.filter(b => b.id !== billId);
            const updated = filtered.map((bill, index) => ({
                ...bill,
                name: `Bill ${index + 1}`
            }));
            const newActiveId = billId === activeBillId ? updated[0]?.id : activeBillId;
            setBills(updated);
            setActiveBillId(newActiveId);
            setBillCounter(updated.length);
            saveBills(updated, newActiveId);
        }
    };

    const addProductToBill = (product) => {
        if (!activeBillId) return;

        if (product.trackStock && product.stockQuantity <= 0) {
            showToast(`${product.name} is out of stock`);
            return;
        }

        const emoji = product.emoji || getProductEmoji(product.category);

        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === activeBillId) {
                    const existingIndex = bill.items.findIndex(item => item._id === product._id);
                    if (existingIndex >= 0) {
                        const currentQty = bill.items[existingIndex].qty;
                        if (product.trackStock && currentQty >= product.stockQuantity) {
                            showToast(`Only ${product.stockQuantity} in stock`);
                            return bill;
                        }
                        const newItems = [...bill.items];
                        newItems[existingIndex] = { ...newItems[existingIndex], qty: currentQty + 1 };
                        return applyCustomerRates({ ...bill, items: newItems });
                    } else {
                        // Newest item goes on top so the last thing added is first.
                        return applyCustomerRates({
                            ...bill,
                            items: [{
                                _id: product._id,
                                name: product.name,
                                price: product.sellingPrice || product.price,
                                costPrice: product.costPrice || 0,
                                maxDiscountPercent: product.maxDiscountPercent ?? null,
                                gst: product.gst || 0,
                                qty: 1,
                                discountAmount: 0,
                                emoji: emoji,
                                barcode: product.barcode,
                                trackStock: product.trackStock,
                                stockQuantity: product.stockQuantity,
                                category: product.category,
                            }, ...bill.items]
                        });
                    }
                }
                return bill;
            });
            saveBills(updated, activeBillId);
            return updated;
        });

        const bill = bills.find(b => b.id === activeBillId);
        const rate = bill?.customerRates?.[product._id];
        const line = bill?.items.find(i => i._id === product._id);
        const willApplyRate = rate && !(Number(bill.billDiscountAmount) > 0) && !line?.rateDismissed
            && (!line || line.discountSource === 'customerRate' || !(Number(line.discountAmount) > 0));
        // A rate beyond the limit isn't sold at the rate as-is — the limit dialog/toast
        // explains what happens, so don't announce the rate price here.
        const rateBeyondLimit = willApplyRate && getRateLine({
            price: product.sellingPrice || product.price,
            costPrice: product.costPrice,
            maxDiscountPercent: product.maxDiscountPercent,
            qty: (line?.qty || 0) + 1,
        }, rate).beyondLimit;
        if (willApplyRate && !rateBeyondLimit) {
            showToast(`${product.name} added at ${bill.customerName}'s rate ${formatCurrency(rate.rate)}`, '🏷');
        } else {
            showToast(`${product.name} added`);
        }
    };

    const updateQuantity = (itemId, delta) => {
        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === activeBillId) {
                    const newItems = bill.items.map(item => {
                        if (item._id === itemId) {
                            const newQty = item.qty + delta;
                            if (newQty <= 0) return null;
                            if (delta > 0 && item.trackStock && newQty > item.stockQuantity) {
                                showToast(`Only ${item.stockQuantity} in stock`);
                                return item;
                            }
                            return { ...item, qty: newQty };
                        }
                        return item;
                    }).filter(Boolean);
                    return applyCustomerRates({ ...bill, items: newItems });
                }
                return bill;
            });
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    // Set an absolute quantity (from the editable qty field). Empty/invalid → 1;
    // clamped to available stock when the item tracks stock.
    const setItemQuantity = (itemId, rawQty) => {
        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id !== activeBillId) return bill;
                const newItems = bill.items.map(item => {
                    if (item._id !== itemId) return item;
                    let qty = parseInt(rawQty, 10);
                    if (isNaN(qty) || qty < 1) qty = 1;
                    if (item.trackStock && qty > item.stockQuantity) {
                        showToast(`Only ${item.stockQuantity} in stock`);
                        qty = item.stockQuantity;
                    }
                    return { ...item, qty };
                });
                return applyCustomerRates({ ...bill, items: newItems });
            });
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    const removeItem = (itemId) => {
        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === activeBillId) {
                    return { ...bill, items: bill.items.filter(item => item._id !== itemId) };
                }
                return bill;
            });
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    // Mirrors the backend pre-save math so the UI stays consistent with what the
    // server will compute. Returns subtotal (after item discounts), tax, bill
    // discount, total, totalCost, billProfit.
    const getBillTotal = (bill) => {
        const gross = bill.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const itemDiscounts = bill.items.reduce((sum, item) => sum + (Number(item.discountAmount) || 0), 0);
        const subtotal = bill.items.reduce(
            (sum, item) => sum + (item.price * item.qty - (Number(item.discountAmount) || 0)),
            0
        );
        const tax = bill.items.reduce(
            (sum, item) => sum + (item.price * (item.gst || 0) / 100) * item.qty,
            0
        );
        const beforeBillDiscount = subtotal + tax;
        const billDiscount = Math.min(Number(bill.billDiscountAmount) || 0, beforeBillDiscount);
        const total = Math.max(0, beforeBillDiscount - billDiscount);
        const totalCost = bill.items.reduce((sum, item) => sum + (Number(item.costPrice) || 0) * item.qty, 0);
        const billProfit = total - totalCost;
        return {
            gross,
            itemDiscounts,
            subtotal,
            tax,
            billDiscount,
            total,
            totalCost,
            billProfit,
        };
    };

    // Compute per-item profit mirroring the backend (distributes bill-level
    // discount proportionally so profit stays correct either way).
    const getItemProfit = (bill, item) => {
        const lineGross = item.price * item.qty;
        const itemDiscount = Number(item.discountAmount) || 0;
        const lineAfterItemDiscount = Math.max(0, lineGross - itemDiscount);
        const totals = getBillTotal(bill);
        let share = 0;
        if (totals.billDiscount > 0 && totals.subtotal > 0) {
            share = (lineAfterItemDiscount / totals.subtotal) * totals.billDiscount;
        }
        const effectivePrice = (lineAfterItemDiscount - share) / (item.qty || 1);
        const profit = (effectivePrice - (Number(item.costPrice) || 0)) * item.qty;
        const margin = effectivePrice > 0 ? ((effectivePrice - (item.costPrice || 0)) / effectivePrice) * 100 : 0;
        return { effectivePrice, profit, margin, lineAfterItemDiscount };
    };

    // Max discount allowed on a line: maxDiscountPercent is a share of the
    // item's PROFIT, not of the selling price (e.g. Rs 10 profit + 40% cap
    // = Rs 4 max discount). With no cap set, the full profit is available
    // (still never below cost price, since profit itself is the ceiling).
    const getItemDiscountCap = (item) => {
        const profit = Math.max(0, (item.price - (Number(item.costPrice) || 0)) * item.qty);
        const pct = item.maxDiscountPercent;
        if (pct === null || pct === undefined) return profit;
        return Math.max(0, profit * (pct / 100));
    };

    // Keeps customer special-rate discounts in sync with the bill: applies the
    // attached customer's rate to lines with no discount, recomputes rated lines
    // for their current qty, and clears them when the customer is removed, a bill
    // discount is active, or the cashier overrode the line (rateDismissed).
    // A manual discount always wins over a rate.
    // A rate beyond the product's discount limit is sold at the limit price unless
    // the cashier chose the customer's rate (limitChoice 'rate' → limitOverride);
    // until they choose, the line is marked limitPending and the POS asks.
    // A below-cost rate can only be chosen when the business allows it.
    const applyCustomerRates = (bill) => {
        const rates = bill.customerRates || {};
        // New lines on a bill that has a bill discount can't carry item discounts
        const billDiscountActive = (Number(bill.billDiscountAmount) || 0) > 0 || bill.amend?.discountMode === 'bill';
        const items = bill.items.map((item) => {
            const isRated = item.discountSource === 'customerRate';
            const base = { ...item, limitPending: false, limitOverride: false };
            const r = rates[item._id];
            const eligible = r && !billDiscountActive && !item.rateDismissed && Number(r.rate) < Number(item.price);
            if (!eligible) {
                return isRated ? { ...base, discountAmount: 0, discountSource: 'manual', customerRate: null } : base;
            }
            if (!isRated && (Number(item.discountAmount) || 0) > 0) return base;

            const status = getRateStatus(item, r);
            const line = getRateLine(item, r);
            let discountAmount = line.fullDiscount;
            let limitOverride = false;
            let limitPending = false;
            if (line.beyondLimit) {
                // canOverrideLimit is re-checked here: held bills live in localStorage and
                // may be finished by a different cashier than the one who chose 'rate'.
                if (item.limitChoice === 'rate' && canOverrideLimit && (allowSellBelowCost || !status.belowCost)) {
                    limitOverride = true;
                } else {
                    discountAmount = line.cap;
                    limitPending = !item.limitChoice;
                }
            }
            return {
                ...base,
                discountAmount,
                discountSource: 'customerRate',
                customerRate: r.rate,
                ratePriceWhenSaved: r.priceWhenSaved ?? null,
                limitOverride,
                limitPending,
            };
        });
        return { ...bill, items };
    };

    // Per-bill decisions about a customer's rates; reset when the customer changes.
    const resetRateFlags = (item) => ({ ...item, rateDismissed: false, limitChoice: undefined, priceChangeAck: false });

    // Update one line on a specific bill (the bill may no longer be active when an
    // async prompt resolves).
    const updateBillLine = (billId, itemId, patch, billPatch = {}) => {
        setBills((prev) => {
            const updated = prev.map((b) => (b.id !== billId ? b : applyCustomerRates({
                ...b,
                ...billPatch,
                items: b.items.map((i) => (i._id === itemId ? { ...i, ...patch } : i)),
            })));
            saveBills(updated);
            return updated;
        });
    };

    // ── Mutators for new POS features ────────────────────────────
    const updateActiveBill = (updater) => {
        setBills((prev) => {
            const updated = prev.map((b) => (b.id === activeBillId ? applyCustomerRates(updater(b)) : b));
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    const setItemDiscount = (itemId, amount) => {
        if (activeBill?.amend?.discountMode === 'bill') {
            showToast(`Bill #${activeBill.amend.billNumber} has a bill discount — new items can't have their own`);
            return;
        }
        const requested = Math.max(0, Number(amount) || 0);
        updateActiveBill((bill) => {
            const target = bill.items.find((i) => i._id === itemId);
            const cap = target ? getItemDiscountCap(target) : Infinity;
            const amt = Math.min(requested, cap);
            if (amt < requested) showToast(`Discount capped at ${formatCurrency(cap)} for this item`);
            // Enforce: clearing bill-level discount when any item has a discount.
            // Typing on a line makes it a manual discount; don't let the customer's
            // rate re-apply to it for the rest of this bill.
            const newItems = bill.items.map((i) => (i._id === itemId
                ? {
                    ...i,
                    discountAmount: amt,
                    discountSource: 'manual',
                    customerRate: null,
                    rateDismissed: !!bill.customerRates?.[i._id] || i.rateDismissed,
                }
                : i));
            const anyItemHasDiscount = newItems.some((i) => (Number(i.discountAmount) || 0) > 0);
            return {
                ...bill,
                items: newItems,
                billDiscountAmount: anyItemHasDiscount ? 0 : bill.billDiscountAmount,
                billDiscountReason: anyItemHasDiscount ? '' : bill.billDiscountReason,
            };
        });
    };

    const setBillDiscount = (amount, reason) => {
        const requested = Math.max(0, Number(amount) || 0);
        updateActiveBill((bill) => {
            const cap = bill.items.reduce((sum, i) => sum + getItemDiscountCap(i), 0);
            const amt = Math.min(requested, cap);
            if (amt < requested) showToast(`Bill discount capped at ${formatCurrency(cap)}`);
            // Enforce: clear all per-item discounts if setting a bill discount.
            const clearedItems =
                amt > 0
                    ? bill.items.map((i) => ({ ...i, discountAmount: 0, discountSource: 'manual', customerRate: null }))
                    : bill.items;
            return {
                ...bill,
                items: clearedItems,
                billDiscountAmount: amt,
                billDiscountReason: reason ?? bill.billDiscountReason,
            };
        });
    };

    const attachCustomer = (customer) => {
        // A deactivated product can keep its rate on the customer until the rates
        // list is next loaded — only use rates for products the POS has loaded.
        const knownProducts = Object.keys(productsCache).length > 0;
        const customerRates = buildRateMap((customer?.specialRates || [])
            .filter((r) => !knownProducts || productsCache[String(r.product?._id ?? r.product)]));
        const bill = bills.find(b => b.id === activeBillId);
        const appliedCount = bill ? applyCustomerRates({
            ...bill,
            customerRates,
            items: bill.items.map(resetRateFlags),
        }).items.filter((i) => i.discountSource === 'customerRate').length : 0;

        updateActiveBill((bill) => ({
            ...bill,
            customer: customer?._id || null,
            customerName: customer?.name || '',
            customerPhone: customer?.phone || '',
            customerAddress: customer?.address || '',
            customerBalance: customer?.balance || 0,
            customerInfo: customer?._id
                ? {
                      creditLimit: Number(customer.creditLimit) || 0,
                      creditDays: Number(customer.creditDays) || 0,
                      lastPurchase: customer.lastPurchase || null,
                      totalBilled: Number(customer.totalBilled) || 0,
                      notes: customer.notes || '',
                  }
                : null,
            customerRates,
            amend: null, // a different customer → not adding to the old bill any more
            // Decisions about the previous customer's rates don't carry over.
            items: bill.items.map(resetRateFlags),
        }));
        setAmendOffer(null);
        if (customer?._id) checkOpenBills(customer, activeBillId);
        else openBillsReqRef.current++;
        if (appliedCount > 0) {
            showToast(`${appliedCount} special rate${appliedCount > 1 ? 's' : ''} applied for ${customer.name}`, '🏷');
        }
        setShowCustomerPicker(false);
        setCustomerQuery('');
        setCustomerResults([]);
    };

    const detachCustomer = () => {
        updateActiveBill((bill) => ({
            ...bill,
            customer: null,
            customerName: '',
            customerPhone: '',
            customerAddress: '',
            customerBalance: 0,
            customerInfo: null,
            customerRates: {},
            amend: null,
            items: bill.items.map(resetRateFlags),
        }));
        setAmendOffer(null);
        openBillsReqRef.current++; // an answer still on its way is ignored
    };

    // ── Add to today's bill ──────────────────────────────────────
    const toAmendState = (b) => ({
        billId: b.billId,
        billNumber: b.billNumber,
        createdAt: b.createdAt,
        revision: b.revision || 0,
        total: Number(b.total) || 0,
        paid: Number(b.paid) || 0,
        returned: Number(b.returned) || 0,
        due: Number(b.due) || 0,
        discountMode: b.discountMode || 'none',
        items: b.items || [],
    });

    // After picking a registered customer: offer their open credit bill(s) from today.
    const checkOpenBills = async (customer, posBillId) => {
        const req = ++openBillsReqRef.current;
        if (!customer?._id || !amendEnabled || !canAmendBills || !navigator.onLine) return;
        try {
            const res = await getOpenBillsForCustomer(customer._id);
            const data = res.data || {};
            // A slow answer for a customer who's no longer on this tab is ignored
            const posBill = billsRef.current.find((b) => b.id === posBillId);
            if (req !== openBillsReqRef.current || String(posBill?.customer || '') !== String(customer._id)) return;
            // Only bills that can take items are offered (fully paid / returned /
            // before closing aren't shown at all)
            const usable = data.canAmend ? (data.bills || []).filter((b) => b.canAmend) : [];
            if (usable.length === 0) return;
            setAmendOffer({ posBillId, customerId: customer._id, customerName: data.customer?.name || customer.name, bills: usable });
        } catch (err) {
            // Feature off / no permission / offline: just make a new bill as usual.
            console.warn('Open bills check failed:', err?.response?.data?.message || err?.message);
        }
    };

    // A new / ended "add to bill": forget the save attempt and start the payment as credit
    const resetAmendAttempt = () => {
        amendKeyRef.current = null;
        amendUncertainRef.current = new Map();
        setAmendPayMethod('credit');
        setAmendPayAmount('');
    };

    const startAmend = (posBillId, openBill) => {
        // The customer was changed or removed while the box was open
        const posBill = billsRef.current.find((b) => b.id === posBillId);
        if (String(posBill?.customer || '') !== String(amendOffer?.customerId || '')) {
            setAmendOffer(null);
            showToast('The customer changed — this will be a new bill', '⚠');
            return;
        }
        setBills((prev) => {
            const updated = prev.map((b) => (b.id !== posBillId ? b : applyCustomerRates({
                ...b,
                amend: toAmendState(openBill),
                // New lines can't take a bill discount; on a bill-discount bill they
                // can't take item discounts either.
                billDiscountAmount: 0,
                billDiscountReason: '',
                items: openBill.discountMode === 'bill'
                    ? b.items.map((i) => ({ ...i, discountAmount: 0, discountSource: 'manual', customerRate: null }))
                    : b.items,
            })));
            saveBills(updated);
            return updated;
        });
        resetAmendAttempt();
        setAmendOffer(null);
        showToast(`Adding to Bill #${openBill.billNumber} — scan the new items`, '➕');
    };

    const stopAmend = () => {
        updateActiveBill((bill) => ({ ...bill, amend: null }));
        resetAmendAttempt();
    };

    const setPosBillAmend = (posBillId, amend) => {
        setBills((prev) => {
            const updated = prev.map((b) => (b.id !== posBillId ? b : applyCustomerRates({ ...b, amend })));
            saveBills(updated);
            return updated;
        });
    };

    // Save a rate to the attached customer's profile, then refresh the bill's rate map.
    // Returns true on success.
    const saveRateForLine = async (bill, item, rate, linePatch = {}) => {
        if (!navigator.onLine) {
            showToast("Can't save rate while offline", '⚠');
            return false;
        }
        try {
            const note = bill.customerRates?.[item._id]?.note || '';
            const res = await saveCustomerRate(bill.customer, item._id, { rate, note });
            const warn = describeRateWarnings(res.data?.warnings);
            showToast(warn ? `Rate saved — ${warn}` : `Saved ${formatCurrency(rate)} as ${bill.customerName}'s rate`, '🏷');
            updateBillLine(bill.id, item._id, { limitChoice: undefined, priceChangeAck: false, ...linePatch }, {
                customerRates: buildRateMap(res.data?.specialRates),
            });
            return true;
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to save rate', '⚠');
            return false;
        }
    };

    // ⚠ price changed → Keep rate. With permission + online, re-save the same rate
    // so it's confirmed at the new price and the warning goes away for good;
    // otherwise just hide the warning for this bill.
    const keepRateAtNewPrice = async (bill, item) => {
        if (canSaveRates && navigator.onLine) {
            await saveRateForLine(bill, item, item.customerRate);
        } else {
            updateBillLine(bill.id, item._id, { priceChangeAck: true });
        }
    };

    // After the cashier commits a manual line discount (Enter / blur), offer to save
    // the resulting unit price as the customer's rate. Asked once per value per line.
    const ratePromptOpen = useRef(false);
    const offerSaveRate = async (itemId) => {
        const bill = bills.find((b) => b.id === activeBillId);
        const item = bill?.items.find((i) => i._id === itemId);
        if (!bill?.customer || !item || !canSaveRates || ratePromptOpen.current) return;
        if (item.discountSource === 'customerRate' || !(Number(item.discountAmount) > 0)) return;

        const unitPrice = Math.round((item.price - item.discountAmount / (item.qty || 1)) * 100) / 100;
        const saved = bill.customerRates?.[item._id];
        if (saved && Number(saved.rate) === unitPrice) return;
        if (item.ratePromptDeclined === unitPrice) return;
        if (!navigator.onLine) {
            showToast("Can't save rate while offline", '⚠');
            return;
        }

        const name = bill.customerName;
        ratePromptOpen.current = true;
        const choice = await appChoose(
            saved
                ? `${name}'s saved rate for ${item.name} is ${formatCurrency(saved.rate)}.\nReplace it with ${formatCurrency(unitPrice)}?`
                : `Save ${formatCurrency(unitPrice)} as ${name}'s rate for ${item.name}?\n\nNext time ${name} buys it, this price is applied automatically.`,
            {
                title: 'Save customer rate',
                defaultValue: 'no',
                choices: [
                    { label: 'Not now', value: 'no' },
                    { label: `Save ${formatCurrency(unitPrice)} for ${name}`, value: 'yes' },
                ],
            }
        );
        ratePromptOpen.current = false;

        if (choice !== 'yes') {
            updateBillLine(bill.id, item._id, { ratePromptDeclined: unitPrice });
            return;
        }
        // Hand the line back to the rate so it shows the badge; same amount as before.
        await saveRateForLine(bill, item, unitPrice, { rateDismissed: false, discountAmount: 0, discountSource: 'manual' });
    };

    // Click a line's total to type the price the customer pays for that line.
    // The difference from the full price becomes the line's discount, through the
    // same setItemDiscount path (discount cap, bill-discount rules, save-rate prompt).
    const [lineTotalEdit, setLineTotalEdit] = useState({ itemId: null, value: '' });
    const lineTotalCancelRef = useRef(false);
    const [rateOfferFor, setRateOfferFor] = useState(null);
    // Ask about saving the rate after the new discount is in state (next render).
    useEffect(() => {
        if (!rateOfferFor) return;
        setRateOfferFor(null);
        offerSaveRate(rateOfferFor);
    }, [rateOfferFor]);

    const startLineTotalEdit = (item, currentTotal, hasBillDiscount) => {
        if (hasBillDiscount) {
            showToast(activeBill?.amend?.discountMode === 'bill'
                ? `Bill #${activeBill.amend.billNumber} has a bill discount — new items can't have their own`
                : 'Remove the bill discount to change an item price');
            return;
        }
        lineTotalCancelRef.current = false;
        setLineTotalEdit({ itemId: item._id, value: String(Math.round(currentTotal * 100) / 100) });
    };

    const commitLineTotalEdit = (item) => {
        const { value } = lineTotalEdit;
        setLineTotalEdit({ itemId: null, value: '' });
        if (lineTotalCancelRef.current || value.trim() === '') return;
        const entered = Number(value);
        const gross = Math.round(item.price * item.qty * 100) / 100;
        if (!Number.isFinite(entered) || entered < 0) {
            showToast('Enter a valid amount', '⚠');
            return;
        }
        if (entered > gross) {
            showToast(`Amount can't be more than the full price ${formatCurrency(gross)}`, '⚠');
            return;
        }
        const discount = Math.round((gross - entered) * 100) / 100;
        if (discount === Math.round((Number(item.discountAmount) || 0) * 100) / 100) return; // unchanged
        setItemDiscount(item._id, discount); // caps + shows "Discount capped at …" if too low
        // Only offer to save the rate for the price the cashier actually typed,
        // not a capped price they didn't ask for.
        if (discount <= getItemDiscountCap(item)) setRateOfferFor(item._id);
    };

    // Inline "Update rate" input on a price-changed line.
    const [rateEdit, setRateEdit] = useState({ itemId: null, value: '' });
    const submitRateEdit = async (bill, item) => {
        const rate = Number(rateEdit.value);
        if (rateEdit.value === '' || !(rate >= 0) || rate >= item.price) {
            showToast(`Rate must be lower than ${formatCurrency(item.price)}`, '⚠');
            return;
        }
        if (await saveRateForLine(bill, item, rate)) setRateEdit({ itemId: null, value: '' });
    };

    // Ask once per line when a customer's rate is beyond the product's discount
    // limit. Without the sellBeyondLimit permission the limit price is used.
    const limitPromptOpen = useRef(false);
    const [limitPromptTick, setLimitPromptTick] = useState(0); // re-check after a prompt closes
    const pendingLimitLine = bills.find((b) => b.id === activeBillId)?.items.find((i) => i.limitPending);
    useEffect(() => {
        const bill = bills.find((b) => b.id === activeBillId);
        const item = bill?.items.find((i) => i.limitPending);
        const rate = item && bill.customerRates?.[item._id];
        if (!item || !rate || limitPromptOpen.current) return;

        const status = getRateStatus(item, rate);
        const name = bill.customerName;
        const belowCostBlocked = status.belowCost && !allowSellBelowCost;
        if (!canOverrideLimit && !belowCostBlocked) {
            updateBillLine(bill.id, item._id, { limitChoice: 'limit' });
            showToast(`${name}'s rate for ${item.name} is beyond the limit — selling at ${formatCurrency(status.limitPrice)}`, '⚠');
            return;
        }

        limitPromptOpen.current = true;
        let title;
        let message;
        let choices;
        if (belowCostBlocked) {
            // The server rejects below-cost lines while the setting is off, so the
            // customer's rate isn't offered at all.
            title = 'Rate below cost';
            message = `${name}'s rate for ${item.name} is ${formatCurrency(rate.rate)}, below the cost price (${formatCurrency(item.costPrice)}).\n`
                + 'Selling below cost is turned off in Settings.\n\n'
                + `Lowest price the discount limit allows: ${formatCurrency(status.limitPrice)}.`;
            choices = [
                { label: `Sell at ${formatCurrency(status.limitPrice)} (limit)`, value: 'limit' },
                { label: `Remove ${name}'s rate for this bill`, value: 'remove' },
            ];
        } else if (status.belowCost) {
            title = 'Selling below cost';
            message = `${name}'s rate for ${item.name} is ${formatCurrency(rate.rate)}, below the cost price (${formatCurrency(item.costPrice)}).\n`
                + `You will lose ${formatCurrency(status.lossPerUnit)} on each unit.\n\n`
                + `Lowest price the discount limit allows: ${formatCurrency(status.limitPrice)}.`;
            choices = [
                { label: `Sell at ${formatCurrency(status.limitPrice)} (limit)`, value: 'limit' },
                { label: `Sell at ${formatCurrency(rate.rate)} (${name}'s rate)`, value: 'rate', danger: true },
            ];
        } else {
            title = 'Rate beyond discount limit';
            message = `${name}'s rate for ${item.name} is ${formatCurrency(rate.rate)}, beyond the product's discount limit.\n\n`
                + `Lowest price the limit allows: ${formatCurrency(status.limitPrice)}.`;
            choices = [
                { label: `Sell at ${formatCurrency(status.limitPrice)} (limit)`, value: 'limit' },
                { label: `Sell at ${formatCurrency(rate.rate)} (${name}'s rate)`, value: 'rate' },
            ];
        }
        appChoose(message, { title, danger: status.belowCost, defaultValue: 'limit', choices }).then((choice) => {
            limitPromptOpen.current = false;
            updateBillLine(bill.id, item._id, choice === 'remove'
                ? { rateDismissed: true, limitChoice: undefined }
                : { limitChoice: choice });
            setLimitPromptTick((t) => t + 1);
        });
    }, [pendingLimitLine?._id, activeBillId, limitPromptTick]);

    const toBillItemPayload = (item) => ({
        product: item._id,
        name: item.name,
        barcode: item.barcode || '',
        category: item.category || 'General',
        qty: item.qty,
        price: item.price,
        costPrice: Number(item.costPrice) || 0,
        gst: item.gst || 0,
        discountAmount: Number(item.discountAmount) || 0,
        discountSource: item.discountSource === 'customerRate' ? 'customerRate' : 'manual',
        customerRate: item.discountSource === 'customerRate' ? item.customerRate : null,
        limitOverride: !!item.limitOverride,
    });

    // Close a finished POS tab (or reset the only one)
    const removePosBill = (posBillId) => {
        if (bills.length > 1) {
            const updated = bills.filter(b => b.id !== posBillId);
            setBills(updated);
            setActiveBillId(updated[0]?.id);
            saveBills(updated, updated[0]?.id);
        } else {
            const newBill = {
                id: Date.now().toString(),
                name: 'Bill 1',
                items: [],
                createdAt: new Date().toISOString(),
                customer: null,
                customerName: '',
                customerPhone: '',
                billDiscountAmount: 0,
                billDiscountReason: '',
            };
            setBills([newBill]);
            setActiveBillId(newBill.id);
            setBillCounter(1);
            saveBills([newBill], newBill.id);
        }
    };

    const openPayment = () => {
        const bill = bills.find((b) => b.id === activeBillId);
        if (!bill || bill.items.length === 0) return;
        if (bill.amend) {
            // A save whose answer never came: offer the same payment again, so
            // saving again reuses its key and can't add the items twice
            const pending = amendKeyRef.current;
            if (pending && pending.billId === bill.amend.billId) {
                setAmendPayMethod(pending.payMethod);
                setAmendPayAmount(pending.payAmount);
                setAmendAccountId(pending.payAccount || null);
            } else {
                setAmendPayMethod('credit');
                setAmendPayAmount('');
            }
        } else {
            setPaymentMethod('cash');
            setCashGiven('');
            setCreditPaidNow('');
        }
        setShowPaymentModal(true);
    };

    // Updated receipt for a bill with added lines: same bill number, the same
    // product combined into one line, an "Added now" note, total before → after.
    const printAmendedReceipt = (savedBill, change) => {
        const number = change?.number || savedBill.revisionCount || 0;
        const items = (savedBill.items || []).map((it) => ({
            product: it.product?._id || it.product,
            name: it.name,
            qty: it.qty,
            price: it.price,
            discountAmount: it.discountAmount || 0,
            returnedQty: it.returnedQty || 0,
        }));
        const addedItems = (savedBill.items || [])
            .filter((it) => (it.revision || 0) === number)
            .map((it) => ({ product: it.product?._id || it.product, name: it.name, qty: it.qty }));
        printReceiptUtil({
            store: business,
            currency: business?.currency || 'Rs.',
            billNumber: savedBill.billNumber || '-',
            date: new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }),
            customerName: savedBill.customerName || 'Walk-in',
            customerPhone: savedBill.customerPhone || '',
            customerAddress: savedBill.customerAddress || '',
            cashierName: user?.name || '',
            customerBalanceBefore: savedBill.customerBalanceBefore || 0,
            items,
            subtotal: items.reduce((sum, it) => sum + (it.price * it.qty - (Number(it.discountAmount) || 0)), 0),
            tax: savedBill.totalTax || 0,
            itemDiscounts: savedBill.totalItemDiscount || 0,
            billDiscount: savedBill.billDiscountAmount || 0,
            total: savedBill.total || 0,
            paymentMethod: savedBill.paymentStatus === 'unpaid' ? 'credit' : getPrimaryPaymentMethod(savedBill),
            amountPaid: savedBill.amountPaid || 0,
            amountDue: savedBill.amountDue || 0,
            totalRefunded: savedBill.totalRefunded || 0,
            netAmount: (savedBill.total || 0) - (savedBill.totalRefunded || 0),
            creditPayments: getCreditPayments(savedBill),
            title: `SALE INVOICE - UPDATE ${number}`,
            updateLine: change ? `Total ${formatCurrency(change.totalBefore)} → ${formatCurrency(change.totalAfter)}` : '',
            addedItems,
        });
    };

    const finishAmend = (posBill, savedBill, change, key) => {
        const revisions = savedBill?.revisions || [];
        const last = change || (key && revisions.find((r) => r.idempotencyKey === key)) || revisions.slice(-1)[0] || null;
        removePosBill(posBill.id);
        const sData = {
            billNumber: savedBill?.billNumber,
            amended: true,
            change: last,
            savedBill,
            total: last?.addedTotal ?? 0,
            paymentMethod: last?.paymentMethod || 'credit',
            amountPaid: last?.paymentAmount || 0,
        };
        setSuccessData(sData);
        setShowPaymentModal(false);
        setShowSuccess(true);
        resetAmendAttempt();
        // Auto print unless the business turned it off (missing = on); the Print button always works.
        if (business?.settings?.autoPrint !== false) {
            if (window.electronAPI?.printReceipt && savedBill) printAmendedReceipt(savedBill, last);
        }
        loadData();
    };

    // The bill changed under us (someone else added items / took a payment / a
    // return): reload it and let the cashier check before saving again.
    const reloadAmend = async (posBill, message, currentFingerprint) => {
        // Did a save whose answer never arrived go through after all? Then the
        // bill "changed" because of us — finish it instead of letting the cashier
        // save the same items a second time.
        if (amendUncertainRef.current.size > 0) {
            try {
                const res = await getBill(posBill.amend.billId);
                const saved = res.data?.bill || res.data;
                const applied = (saved?.revisions || []).find((r) => amendUncertainRef.current.has(r.idempotencyKey));
                if (applied) {
                    const sameAsNow = amendUncertainRef.current.get(applied.idempotencyKey) === currentFingerprint;
                    finishAmend(posBill, saved, null, applied.idempotencyKey);
                    if (!sameAsNow) {
                        appAlert(`Your earlier save to Bill #${saved.billNumber} went through before the connection dropped (update ${applied.number}).\n\nThe changes you made after that were not saved. Check the bill and add anything missing again.`, { title: 'Already saved' });
                    }
                    return;
                }
            } catch {
                showToast(message || 'This bill was just changed. Try again.', '⚠');
                return; // keep the attempt — we still don't know if it went through
            }
        }
        amendKeyRef.current = null;
        amendUncertainRef.current = new Map();
        try {
            const res = await getOpenBillsForCustomer(posBill.customer);
            const fresh = (res.data?.bills || []).find((b) => String(b.billId) === String(posBill.amend.billId));
            if (fresh?.canAmend) {
                setPosBillAmend(posBill.id, toAmendState(fresh));
                showToast(`Bill #${fresh.billNumber} was just changed — reloaded. Check and save again.`, '⚠');
                return;
            }
            setPosBillAmend(posBill.id, null);
            setShowPaymentModal(false);
            showToast(`${fresh?.blockedReason || message || "This bill can't take more items now"} — this will be a new bill`, '⚠');
        } catch {
            showToast(message || 'This bill was just changed. Try again.', '⚠');
        }
    };

    // The server refused the save. If the bill can't take items any more (not
    // from today, closing done, fully paid / returned, other customer), switch
    // this tab back to a normal new bill — the items stay in the cart.
    const recheckAmendable = async (posBill, message) => {
        try {
            const res = await getOpenBillsForCustomer(posBill.customer);
            const fresh = (res.data?.bills || []).find((b) => String(b.billId) === String(posBill.amend.billId));
            if (res.data?.canAmend && fresh?.canAmend) {
                showToast(message || 'Failed to add items to the bill', '⚠'); // still open: a different problem
                return;
            }
            dropAmend(posBill, fresh?.blockedReason || message);
        } catch {
            showToast(message || 'Failed to add items to the bill', '⚠');
        }
    };

    const dropAmend = (posBill, reason) => {
        setPosBillAmend(posBill.id, null);
        resetAmendAttempt();
        setShowPaymentModal(false);
        // Backend reasons end with "Make a new bill." — the toast already says that
        const why = String(reason || "This bill can't take more items now").replace(/\.?\s*Make a new bill\.?\s*$/i, '');
        showToast(`${why} — this will be a new bill`, '⚠');
    };

    const handleAmendSave = async () => {
        const bill = bills.find((b) => b.id === activeBillId);
        const amend = bill?.amend;
        if (!bill || !amend || bill.items.length === 0 || processing) return;
        if (!navigator.onLine) {
            showToast('Adding to a bill needs an internet connection', '⚠');
            return;
        }
        const newTotal = getBillTotal(bill).total;
        const dueNow = Math.round((amend.due + newTotal) * 100) / 100;
        let payment;
        if (amendPayMethod !== 'credit') {
            const amount = Math.round((parseFloat(amendPayAmount) || 0) * 100) / 100;
            if (!(amount > 0)) { showToast('Enter the amount paid now, or choose Leave as credit'); return; }
            if (amount > dueNow + 0.01) { showToast(`Paid amount is more than the due (${formatCurrency(dueNow)})`); return; }
            payment = { amount, method: amendPayMethod, ...moneyFields({ accountId: amendAccountId }) };
        }
        const itemsPayload = [...bill.items].reverse().map(toBillItemPayload); // saved oldest-first, like a new bill
        const fingerprint = JSON.stringify({ bill: amend.billId, items: itemsPayload, payment: payment || null });
        // Same bill, items and payment as the last unanswered try → same key, so the
        // server can tell it's a repeat. Anything changed → a new key.
        const prev = amendKeyRef.current;
        if (!prev || prev.billId !== amend.billId || prev.fingerprint !== fingerprint) {
            amendKeyRef.current = {
                key: newIdempotencyKey(),
                fingerprint,
                billId: amend.billId,
            };
        }
        Object.assign(amendKeyRef.current, { payMethod: amendPayMethod, payAmount: amendPayAmount, payAccount: amendAccountId });
        const { key } = amendKeyRef.current;
        setProcessing(true);
        try {
            const res = await addBillItems(amend.billId, {
                customer: bill.customer,
                revision: amend.revision,
                idempotencyKey: key,
                items: itemsPayload,
                ...(payment ? { payment } : {}),
            });
            finishAmend(bill, res.data?.bill, res.data?.change);
        } catch (error) {
            const status = error.response?.status;
            const data = error.response?.data || {};
            if (status === 409 && data.alreadyApplied && data.bill) {
                finishAmend(bill, data.bill, null, key); // this save already went through
            } else if (status === 409) {
                await reloadAmend(bill, data.message, fingerprint);
            } else if (status === 403) {
                setPosBillAmend(bill.id, null);
                setShowPaymentModal(false);
                showToast(`${data.message || 'Not allowed'} — this will be a new bill`, '⚠');
            } else if (status === 400 && data.code && /^(INSUFFICIENT_BALANCE|ACCOUNT_|MONEY_BOOK_NOT_READY)/.test(data.code)) {
                // Money Book account problem: keep the window open, fresh account list
                amendKeyRef.current = null;
                handleMoneyError(error);
                showToast(apiErrorMessage(error, 'Failed to add items to the bill'));
            } else if (status === 400 && !data.outOfStock?.length) {
                amendKeyRef.current = null;
                await recheckAmendable(bill, data.message);
            } else if (status === 400 && data.outOfStock?.length) {
                amendKeyRef.current = null;
                appAlert(`${data.message}\n\n${data.outOfStock.map((o) => `• ${o.name}: needs ${o.requested}, only ${o.available} in stock`).join('\n')}`);
            } else if (!error.response || status >= 500) {
                // No answer (timeout / connection lost): it may have been saved. Keep
                // the key so saving again is recognised as a repeat.
                amendUncertainRef.current.set(key, fingerprint);
                showToast('No answer from the server — save again to retry (it won\'t be added twice)', '⚠');
            } else {
                amendKeyRef.current = null; // a definite "no": the next try is a new save
                showToast(data.message || 'Failed to add items to the bill');
            }
        } finally {
            setProcessing(false);
        }
    };

    // Keep (or drop) the sale's idempotency key on a bill tab — saved with the tabs so it
    // survives closing the payment window or restarting the app.
    const setBillSaleKey = (billId, key) => {
        setBills((prev) => {
            const next = prev.map((b) => (b.id === billId ? { ...b, saleKey: key || undefined } : b));
            saveBills(next);
            return next;
        });
    };

    // A sale the server saved (a normal answer, or "already saved" after a lost answer):
    // clear the tab, show the success window, print, refresh.
    const finishSale = (bill, respData, { orderedItems, currentEffectiveTotal, currentChangeAmount, amountPaid, print = true }) => {
        const response = { data: respData || {} };
        // Reset bill
        if (bills.length > 1) {
            const updated = bills.filter(b => b.id !== bill.id);
            setBills(updated);
            setActiveBillId(updated[0]?.id);
            saveBills(updated, updated[0]?.id);
        } else {
            const newBill = {
                id: Date.now().toString(),
                name: 'Bill 1',
                items: [],
                createdAt: new Date().toISOString(),
                customer: null,
                customerName: '',
                customerPhone: '',
                billDiscountAmount: 0,
                billDiscountReason: '',
            };
            setBills([newBill]);
            setActiveBillId(newBill.id);
            setBillCounter(1);
            saveBills([newBill], newBill.id);
        }

        const sData = {
            billNumber: response.data?.billNumber,
            total: currentEffectiveTotal,
            cashGiven: parseFloat(cashGiven || 0),
            change: currentChangeAmount,
            paymentMethod,
            amountPaid,
            customerBalanceBefore: response.data?.customerBalanceBefore ?? bill.customerBalance ?? 0,
            // Spare store credit the backend applied to this new bill.
            creditPayments: getCreditPayments(response.data?.bill || response.data),
            bill: { ...bill, items: orderedItems },
        };
        setSuccessData(sData);
        setShowPaymentModal(false);
        setCashGiven('');
        setCreditPaidNow('');
        setPaymentMethod('cash');
        setShowSuccess(true);

        // Auto-print receipt (only in Electron — browser shows print dialog which is disruptive).
        // Skipped when the business turned auto print off; the success modal's Print button still works.
        if (print && business?.settings?.autoPrint !== false) {
            if (window.electronAPI?.printReceipt) printReceipt(sData, sData.bill);
        }

        loadData();
    };

    const handleCheckout = async (confirmedWalkIn = false) => {
        const bill = bills.find(b => b.id === activeBillId);
        if (!bill || bill.items.length === 0) return;

        // Credit requires a real customer
        if (paymentMethod === 'credit' && !bill.customer) {
            showToast('Attach a customer to use credit');
            return;
        }

        // Walk-in guard: if no customer attached, confirm before proceeding
        // (credit mode already requires a customer, so it never trips this)
        if (!confirmedWalkIn && !bill.customer) {
            setShowWalkInConfirm(true);
            return;
        }

        const totals = getBillTotal(bill);
        const currentEffectiveTotal = totals.total;

        // The cart shows newest-first on screen, but the saved record and printed
        // receipt should read oldest-first (the order items were actually added).
        const orderedItems = [...bill.items].reverse();
        const currentChangeAmount = Math.max(0, parseFloat(cashGiven || 0) - currentEffectiveTotal);

        if (paymentMethod === 'cash' && parseFloat(cashGiven || 0) < currentEffectiveTotal) {
            showToast('Cash amount is less than total');
            return;
        }

        // One idempotency key per sale attempt, kept on the bill tab (and in localStorage) until the
        // server gives a definite answer. If the connection drops after the server saved the bill,
        // pressing Pay again sends the SAME key, so the server answers "already saved" instead of
        // selling twice (or refusing for lack of stock).
        const idempotencyKey = bill.saleKey || newIdempotencyKey();
        if (!bill.saleKey) setBillSaleKey(bill.id, idempotencyKey);
        let amountPaid;
        if (paymentMethod === 'cash') {
            amountPaid = Math.min(parseFloat(cashGiven || 0), currentEffectiveTotal);
        } else if (paymentMethod === 'credit') {
            amountPaid = Math.max(0, Math.min(parseFloat(creditPaidNow || 0), currentEffectiveTotal));
        } else {
            amountPaid = currentEffectiveTotal;
        }

        // Backend only accepts: cash | card | online | store_credit
        // Map UI-only methods to backend-valid ones
        const backendPaymentMethod =
            paymentMethod === 'upi' ? 'online' :
            paymentMethod === 'credit' ? 'cash' :
            paymentMethod;

        setProcessing(true);
        try {
            const response = await createBill({
                items: orderedItems.map(toBillItemPayload),
                status: 'completed',
                customer: bill.customer || null,
                customerName: bill.customerName || 'Walk-in',
                customerPhone: bill.customerPhone || '',
                customerAddress: bill.customerAddress || '',
                billDiscountAmount: Number(bill.billDiscountAmount) || 0,
                billDiscountReason: bill.billDiscountReason || '',
                paymentMethod: backendPaymentMethod,
                amountPaid,
                cashGiven: paymentMethod === 'cash' ? parseFloat(cashGiven || 0) : 0,
                idempotencyKey,
                // Money Book on + an account chosen: the payment as payments[] (the
                // only place POST /bill takes an accountId). Otherwise exactly as before.
                ...(moneyBookOn && posAccountId && amountPaid > 0
                    ? { payments: [{ amount: amountPaid, method: backendPaymentMethod, ...moneyFields({ accountId: posAccountId }) }] }
                    : {}),
            });


            finishSale(bill, response.data, { orderedItems, currentEffectiveTotal, currentChangeAmount, amountPaid });
        } catch (error) {
            console.error('Checkout error:', error);
            const status = error.response?.status;
            const data = error.response?.data || {};
            if (status === 409 && data.alreadyPaid) {
                // The first try reached the server and was saved; only its answer got lost.
                const saved = data.bill || {};
                const matches = saved.total == null || Math.abs((Number(saved.total) || 0) - currentEffectiveTotal) < 0.01;
                if (matches) {
                    finishSale(
                        bill,
                        { billNumber: saved.billNumber, customerBalanceBefore: saved.customerBalanceBefore, bill: saved },
                        { orderedItems, currentEffectiveTotal, currentChangeAmount, amountPaid }
                    );
                    showToast(`The connection dropped, but the sale was saved as Bill #${saved.billNumber ?? '?'} — not charged twice.`, '✓');
                } else {
                    // The cart changed after the lost answer: the saved bill is the OLD cart. Keep the
                    // cart (nothing is lost), drop the key, and tell the cashier what was sold.
                    setBillSaleKey(bill.id, null);
                    setShowPaymentModal(false);
                    loadData();
                    appAlert(
                        `Bill #${saved.billNumber ?? '?'} was already saved before the connection dropped, for ${formatCurrency(saved.total)}.\n\nThe cart was changed after that, so it is still here. Remove what was already sold on Bill #${saved.billNumber ?? '?'}, then charge the rest as a new sale.`,
                        { title: 'Already saved' }
                    );
                }
            } else if (!error.response || status >= 500) {
                // No answer (timeout / connection lost / server error): it may have been saved.
                // Keep the key so the next Pay is recognised as the same sale.
                showToast("No answer from the server — press Pay again. It won't be charged twice.", '⚠');
            } else {
                // A definite "no" (e.g. not enough stock): the next try is a new sale
                setBillSaleKey(bill.id, null);
                handleMoneyError(error);
                showToast(apiErrorMessage(error, 'Failed to complete sale'));
            }
        } finally {
            setProcessing(false);
        }
    };

    const printReceipt = (billData, bill) => {
        const totals = getBillTotal(bill);
        printReceiptUtil({
            store: business,
            currency: business?.currency || 'Rs.',
            billNumber: billData.billNumber || '-',
            date: new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }),
            customerName: bill.customerName || 'Walk-in',
            customerPhone: bill.customerPhone || '',
            customerAddress: bill.customerAddress || '',
            cashierName: user?.name || '',
            customerBalanceBefore: billData.customerBalanceBefore ?? bill.customerBalance ?? 0,
            items: bill.items.map(item => ({
                product: item._id,
                name: item.name,
                qty: item.qty,
                price: item.price,
                discountAmount: item.discountAmount || 0,
            })),
            subtotal: totals.subtotal,
            tax: totals.tax,
            itemDiscounts: totals.itemDiscounts,
            billDiscount: totals.billDiscount,
            total: totals.total,
            paymentMethod: billData.paymentMethod,
            amountPaid: billData.amountPaid ?? 0,
            cashGiven: billData.cashGiven || 0,
            change: billData.change || 0,
            creditPayments: billData.creditPayments || [],
        });
    };

    const activeBill = bills.find(b => b.id === activeBillId);
    const activeTotal = activeBill ? getBillTotal(activeBill) : { subtotal: 0, tax: 0, total: 0 };
    const activeItemCount = activeBill ? activeBill.items.reduce((sum, item) => sum + item.qty, 0) : 0;
    const effectiveTotal = activeTotal.total;
    const changeAmount = Math.max(0, parseFloat(cashGiven || 0) - effectiveTotal);

    // Same money format as the rest of the app (shop currency, at most 2 decimals) — display only
    const formatCurrency = (amount) => formatAmount(amount, { currency: business?.currency || 'PKR' });

    // Search suggestions
    const suggestions = searchQuery.trim().length >= 2
        ? products.filter(p =>
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.barcode?.includes(searchQuery) ||
            p.sku?.includes(searchQuery)
        ).slice(0, 8)
        : [];

    const isBarcodeLike = (value) => /^\d{4,}$/.test(value.trim());

    const handleBarcodeInput = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        setSelectedIndex(0);

        if (value.trim()) {
            const product = productsCache[value.trim()];
            if (product) {
                addProductToBill(product);
                setSearchQuery('');
                setShowSuggestions(false);
                return;
            }
        }

        if (value.trim().length >= 2 && !isBarcodeLike(value)) {
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectSuggestion = (product) => {
        addProductToBill(product);
        setSearchQuery('');
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            setSearchQuery('');
            return;
        }

        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % suggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                selectSuggestion(suggestions[selectedIndex]);
                return;
            }
        }

        if (e.key === 'Enter' && searchQuery.trim()) {
            let product = productsCache[searchQuery.trim()];
            if (!product) {
                product = products.find(p =>
                    p.barcode === searchQuery.trim() ||
                    p.sku === searchQuery.trim() ||
                    p.name?.toLowerCase() === searchQuery.toLowerCase().trim()
                );
            }
            if (product) {
                addProductToBill(product);
                setSearchQuery('');
                setShowSuggestions(false);
            } else if (suggestions.length > 0) {
                selectSuggestion(suggestions[0]);
            } else if (!productsReady) {
                // The product list is still on its way: keep the scan and add it when it lands
                pendingScanRef.current = searchQuery.trim();
                setSearchQuery('');
                showToast('Products are still loading — the item will be added in a moment');
            } else {
                showToast(`Product not found: ${searchQuery}`);
            }
        }
    };

    useEffect(() => {
        if (!productsReady || !pendingScanRef.current) return;
        const code = pendingScanRef.current;
        pendingScanRef.current = '';
        const product = productsCache[code] || products.find((p) => p.name?.toLowerCase() === code.toLowerCase());
        if (product) addProductToBill(product);
        else showToast(`Product not found: ${code}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productsReady]);

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Topbar: today · customer · bills · returns */}
            <div className="relative z-40 flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 border-b border-hairline bg-card flex-shrink-0">
                <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-mono text-overline-lg uppercase text-muted-foreground">Today</span>
                    {todayStats ? (
                        <>
                            <span className="font-heading text-h4 tabular-nums text-foreground">{formatCurrency(todayStats.totalSales)}</span>
                            <span className="text-body-sm text-muted-foreground whitespace-nowrap">
                                {todayStats.transactions} sale{todayStats.transactions === 1 ? '' : 's'}
                            </span>
                        </>
                    ) : (
                        <span className="font-heading text-h4 text-muted-foreground" aria-label="Loading today's sales">—</span>
                    )}
                </div>

                {/* Bills */}
                <div className="ml-auto flex items-center gap-1.5" role="tablist" aria-label="Open bills">
                    {bills.map((bill) => {
                        const isActive = bill.id === activeBillId;
                        const itemCount = bill.items.reduce((sum, item) => sum + item.qty, 0);
                        return (
                            <div
                                key={bill.id}
                                role="tab"
                                tabIndex={0}
                                aria-selected={isActive}
                                onMouseDown={keepScanFocus}
                                onClick={() => {
                                    switchBill(bill.id);
                                    focusScan();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        switchBill(bill.id);
                                        focusScan();
                                    }
                                }}
                                className={cn(
                                    'group flex items-center gap-1.5 h-9 pl-3 rounded-xl text-body-lg font-medium cursor-pointer select-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                                    bills.length > 1 ? 'pr-1' : 'pr-3',
                                    isActive ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground hover:bg-[var(--hover-overlay)]'
                                )}
                            >
                                <span>{bill.name}</span>
                                {itemCount > 0 && !isActive ? (
                                    <span className="rounded-full bg-primary text-primary-foreground text-caption font-semibold px-1.5 leading-[18px] tabular-nums">{itemCount}</span>
                                ) : null}
                                {bills.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (bill.items.length > 0) {
                                                if (await appConfirm(`Cancel ${bill.name} with ${bill.items.length} items?`, { danger: true })) {
                                                    deleteBill(bill.id);
                                                }
                                            } else {
                                                deleteBill(bill.id);
                                            }
                                        }}
                                        aria-label={`Close ${bill.name}`}
                                        title={`Close ${bill.name}`}
                                        className={cn(
                                            'w-6 h-6 rounded-lg inline-flex items-center justify-center',
                                            isActive ? 'hover:bg-black/15' : 'text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-destructive-chip hover:text-destructive-chip-foreground'
                                        )}
                                    >
                                        <FiX size={13} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    <IconButton
                        label="New bill"
                        variant="outline"
                        onMouseDown={keepScanFocus}
                        onClick={() => {
                            createNewBill();
                            focusScan();
                        }}
                    >
                        <FiPlus />
                    </IconButton>
                </div>

                <Button variant="outline" onClick={() => navigate('/returns')}>
                    <FiCornerUpLeft aria-hidden="true" />
                    Returns
                </Button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Cart Panel (Left) */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Search / scan */}
                    <div className="p-5 pb-3">
                        <div className="relative">
                            <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} aria-hidden="true" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchQuery}
                                onChange={handleBarcodeInput}
                                onKeyDown={handleKeyDown}
                                onFocus={() => searchQuery.length >= 2 && !isBarcodeLike(searchQuery) && setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                placeholder={productsReady ? 'Scan a barcode or type a product name' : productsError ? "Couldn't load products — scanning will retry" : 'Loading products… you can scan already'}
                                aria-label="Scan a barcode or search products"
                                className="w-full h-12 pl-11 pr-20 rounded-2xl border border-border bg-card text-lead text-foreground placeholder:text-muted-foreground outline-none shadow-1 focus:border-ring transition-shadow"
                                autoFocus
                            />
                            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 flex gap-1">
                                <Kbd>{MOD}</Kbd>
                                <Kbd>K</Kbd>
                            </span>

                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-2 bg-popover text-popover-foreground border border-hairline rounded-pop shadow-2 z-50 max-h-80 overflow-y-auto p-1.5" role="listbox" aria-label="Matching products">
                                    {suggestions.map((product, index) => {
                                        const outOfStock = product.trackStock && (product.stockQuantity || 0) <= 0;
                                        return (
                                            <div
                                                key={product._id}
                                                role="option"
                                                aria-selected={index === selectedIndex}
                                                aria-disabled={outOfStock}
                                                onClick={() => !outOfStock && selectSuggestion(product)}
                                                className={cn(
                                                    'flex items-center gap-3 min-h-12 px-2.5 py-1.5 rounded-[9px] cursor-pointer',
                                                    index === selectedIndex ? 'bg-[var(--hover-overlay)] shadow-[inset_2px_0_0_var(--primary)]' : 'hover:bg-[var(--hover-overlay)]',
                                                    outOfStock && 'opacity-50 cursor-not-allowed'
                                                )}
                                            >
                                                <ProductMark name={product.name} category={product.category} size="sm" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-body-lg font-medium text-foreground truncate">{product.name}</p>
                                                    <p className="text-body-sm text-muted-foreground">
                                                        {product.category || 'General'}
                                                        {product.trackStock ? ` · ${outOfStock ? 'Out of stock' : `${product.stockQuantity} in stock`}` : ''}
                                                    </p>
                                                </div>
                                                <span className="text-body-lg font-semibold tabular-nums text-foreground">{formatCurrency(product.sellingPrice || product.price)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto px-5 pb-4 dark-scrollbar">
                        {activeBill?.amend && (
                            <div className="mb-3 rounded-2xl border border-info-chip-foreground/30 bg-info-chip/40 overflow-hidden">
                                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-hairline">
                                    <div className="flex items-center gap-2 text-body text-info-chip-foreground">
                                        <FiPlusCircle size={14} />
                                        <span className="font-semibold">Adding to Bill #{activeBill.amend.billNumber}</span>
                                        <span className="text-muted-foreground">· {new Date(activeBill.amend.createdAt).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })} · {formatCurrency(activeBill.amend.due)} due</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={stopAmend}
                                        className="text-body-sm font-medium text-primary hover:underline"
                                        title="Make a new bill instead"
                                    >
                                        Make a new bill instead
                                    </button>
                                </div>
                                <div className="px-4 py-2 divide-y divide-hairline">
                                    {activeBill.amend.items.map((it) => (
                                        <div key={it.itemId} className="flex items-center gap-3 py-1.5 text-body">
                                            <span className="shrink-0 px-1.5 py-0.5 rounded text-caption font-semibold bg-muted text-muted-foreground">Earlier</span>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-foreground">{it.name}</span>
                                                {(it.revision || 0) > 0 && it.addedBy && (
                                                    <span className="ml-2 text-body-sm text-muted-foreground">Added by {it.addedBy}</span>
                                                )}
                                                {(it.returnedQty || 0) > 0 && (
                                                    <span className="ml-2 text-body-sm text-destructive">{it.returnedQty} returned</span>
                                                )}
                                            </div>
                                            <span className="text-muted-foreground tabular-nums">{it.qty} × {formatCurrency(it.price)}</span>
                                            <span className="w-20 text-right font-medium text-foreground tabular-nums">{formatCurrency(it.itemTotal)}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="px-4 pb-2.5 text-body-sm text-muted-foreground">
                                    Earlier items can't be changed here — to take one back, use Return on Bill #{activeBill.amend.billNumber}.
                                </p>
                            </div>
                        )}
                        {activeBill?.items.length === 0 && activeBill?.amend ? (
                            <div className="py-8 text-center text-body text-muted-foreground">
                                Scan or search the new items to add to Bill #{activeBill.amend.billNumber}
                            </div>
                        ) : activeBill?.items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center pb-10 text-center">
                                <span className="w-14 h-14 rounded-2xl bg-muted text-muted-foreground inline-flex items-center justify-center">
                                    <FiShoppingCart size={24} aria-hidden="true" />
                                </span>
                                <h3 className="font-heading text-h3 text-foreground mt-4">Cart is empty</h3>
                                <p className="text-body text-muted-foreground mt-1.5 max-w-[280px]">Scan a barcode or search by name.</p>
                                <p className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-body-sm text-muted-foreground">
                                    <span className="inline-flex items-center gap-1.5"><Kbd>{MOD}</Kbd><Kbd>K</Kbd> search</span>
                                    <span className="inline-flex items-center gap-1.5"><Kbd>{MOD}</Kbd><Kbd>0</Kbd> pay</span>
                                    <span className="inline-flex items-center gap-1.5"><Kbd>Esc</Kbd> close</span>
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeBill?.items.map((item) => {
                                    const expanded = expandedItemId === item._id;
                                    const profitInfo = getItemProfit(activeBill, item);
                                    const hasItemDiscount = (Number(item.discountAmount) || 0) > 0;
                                    const isRated = item.discountSource === 'customerRate';
                                    // ⚠ product price changed since the customer's rate was saved
                                    const ratePriceChanged = isRated && !item.priceChangeAck && item.ratePriceWhenSaved != null
                                        && Number(item.ratePriceWhenSaved) !== Number(item.price);
                                    // Sold at the limit price instead of the (lower) customer rate
                                    const rateCapped = isRated && !item.limitOverride
                                        && Math.round((item.price - item.discountAmount / (item.qty || 1)) * 100) / 100 > Number(item.customerRate);
                                    const hasBillDiscount = (Number(activeBill.billDiscountAmount) || 0) > 0 || activeBill.amend?.discountMode === 'bill';
                                    const discountCap = getItemDiscountCap(item);
                                    return (
                                        <div
                                            key={item._id}
                                            className={cn(
                                                'bg-card border rounded-2xl animate-pop-in transition-colors relative overflow-hidden shadow-1',
                                                expanded ? 'border-ring' : 'border-hairline hover:border-border'
                                            )}
                                        >
                                            <div
                                                onClick={() => setExpandedItemId(expanded ? null : item._id)}
                                                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3 cursor-pointer"
                                                title={expanded ? 'Hide details' : 'Show details and discount'}
                                            >
                                                <ProductMark name={item.name} category={item.category} />
                                                <div className="flex-1 min-w-[150px]">
                                                    <h4 className="text-body-lg font-medium text-foreground truncate">
                                                        {activeBill.amend && <StatusChip shape="tag" tone="success" label="New" className="mr-1.5 align-middle" />}
                                                        {item.name}
                                                    </h4>
                                                    <p className="text-body-sm text-muted-foreground">
                                                        <span className="tabular-nums">{formatCurrency(item.price)} each</span>
                                                        {isRated && (
                                                            <StatusChip
                                                                shape="tag"
                                                                tone="info"
                                                                icon={FiTag}
                                                                className="ml-2 align-middle"
                                                                label={`${activeBill.customerName}'s rate ${formatCurrency(item.customerRate)}${rateCapped ? ' · limited' : ''}${item.limitOverride ? ' · past limit' : ''}`}
                                                            />
                                                        )}
                                                        {ratePriceChanged && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setExpandedItemId(item._id); }}
                                                                title={`Price changed ${formatCurrency(item.ratePriceWhenSaved)} → ${formatCurrency(item.price)} since this rate was saved`}
                                                                aria-label="Price changed since this rate was saved"
                                                                className="ml-1 inline-flex align-middle text-warning-chip-foreground"
                                                            >
                                                                <FiAlertTriangle size={13} />
                                                            </button>
                                                        )}
                                                        {hasItemDiscount && (
                                                            <span className="ml-2 text-success tabular-nums">
                                                                − {formatCurrency(item.discountAmount)} off
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="ml-auto flex items-center rounded-xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
                                                    <IconButton label={`One less ${item.name}`} size="2xs" variant="ghost" className="w-8 h-9 rounded-l-xl rounded-r-none" onMouseDown={keepScanFocus} onClick={() => updateQuantity(item._id, -1)}>
                                                        <FiMinus />
                                                    </IconButton>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={item.qty}
                                                        aria-label={`Quantity of ${item.name}`}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => setItemQuantity(item._id, e.target.value.replace(/[^0-9]/g, ''))}
                                                        className="w-11 h-9 text-center bg-transparent border-x border-hairline text-body-lg font-semibold tabular-nums text-foreground outline-none focus:bg-[var(--hover-overlay)]"
                                                    />
                                                    <IconButton label={`One more ${item.name}`} size="2xs" variant="ghost" className="w-8 h-9 rounded-r-xl rounded-l-none" onMouseDown={keepScanFocus} onClick={() => updateQuantity(item._id, 1)}>
                                                        <FiPlus />
                                                    </IconButton>
                                                </div>
                                                {lineTotalEdit.itemId === item._id ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        autoFocus
                                                        aria-label={`Price for ${item.qty} × ${item.name}`}
                                                        title={item.qty > 1 ? `Total for ${item.qty} items` : 'Price for this item'}
                                                        value={lineTotalEdit.value}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onFocus={(e) => e.target.select()}
                                                        max={Math.round(item.price * item.qty * 100) / 100}
                                                        onChange={(e) => {
                                                            // Can't type more than the full price: clamp to it as they type.
                                                            const gross = Math.round(item.price * item.qty * 100) / 100;
                                                            let value = e.target.value;
                                                            if (value !== '' && Number(value) > gross) {
                                                                value = String(gross);
                                                                showToast(`Max is the full price ${formatCurrency(gross)}`, '⚠');
                                                            }
                                                            setLineTotalEdit({ itemId: item._id, value });
                                                        }}
                                                        onBlur={() => commitLineTotalEdit(item)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                lineTotalCancelRef.current = true;
                                                                e.currentTarget.blur();
                                                                return;
                                                            }
                                                            if (e.key !== 'Enter') return;
                                                            // Blur after this keydown finishes, so the save-rate
                                                            // prompt doesn't catch this Enter and close as "Not now".
                                                            e.preventDefault();
                                                            const el = e.currentTarget;
                                                            setTimeout(() => el.blur(), 0);
                                                        }}
                                                        className="w-[110px] h-9 text-right px-2.5 bg-card border border-ring rounded-xl text-lead font-semibold tabular-nums text-foreground outline-none"
                                                    />
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); startLineTotalEdit(item, profitInfo.lineAfterItemDiscount, hasBillDiscount); }}
                                                        title="Click to change the price — the difference becomes the discount"
                                                        aria-label={`Line total ${formatCurrency(profitInfo.lineAfterItemDiscount)} — click to change the price`}
                                                        className="min-w-[96px] h-9 text-right px-2 rounded-xl border border-dashed border-transparent hover:border-border text-lead font-semibold tabular-nums text-foreground cursor-text"
                                                    >
                                                        {formatCurrency(profitInfo.lineAfterItemDiscount)}
                                                    </button>
                                                )}
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <IconButton label={`Remove ${item.name}`} size="xs" variant="ghost" className="hover:!text-destructive" onMouseDown={keepScanFocus} onClick={() => removeItem(item._id)}>
                                                        <FiTrash2 />
                                                    </IconButton>
                                                </div>
                                            </div>

                                            {expanded && (
                                                <div className="px-3.5 pb-3.5 pt-0 border-t border-hairline">
                                                    <div className={`grid ${canViewProfit ? 'grid-cols-4' : 'grid-cols-1'} gap-3 mt-3 mb-3`}>
                                                        {canViewProfit && (
                                                            <div>
                                                                <div className="font-mono text-overline-md uppercase text-muted-foreground">Cost</div>
                                                                <div className="text-body font-semibold tabular-nums text-foreground">{formatCurrency(item.costPrice || 0)}</div>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-mono text-overline-md uppercase text-muted-foreground">Sell</div>
                                                            <div className="text-body font-semibold tabular-nums text-foreground">{formatCurrency(item.price)}</div>
                                                        </div>
                                                        {canViewProfit && (
                                                            <>
                                                                <div>
                                                                    <div className="font-mono text-overline-md uppercase text-muted-foreground">Profit</div>
                                                                    <div className={`text-body font-semibold tabular-nums ${profitInfo.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                                                                        {formatCurrency(profitInfo.profit)}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="font-mono text-overline-md uppercase text-muted-foreground">Margin</div>
                                                                    <div className={`text-body font-semibold tabular-nums ${profitInfo.margin >= 0 ? 'text-success' : 'text-destructive'}`}>
                                                                        {profitInfo.margin.toFixed(1)}%
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-body-sm text-muted-foreground flex-shrink-0">Discount ({business?.currency || 'PKR'})</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={discountCap}
                                                            step="0.01"
                                                            value={item.discountAmount || ''}
                                                            onChange={(e) => setItemDiscount(item._id, e.target.value)}
                                                            onBlur={() => offerSaveRate(item._id)}
                                                            onKeyDown={(e) => {
                                                                if (e.key !== 'Enter') return;
                                                                // Blur after this keydown finishes: blurring now opens the
                                                                // save prompt while the Enter is still dispatching, and the
                                                                // dialog's own Enter handler closes it as "Not now".
                                                                e.preventDefault();
                                                                const el = e.currentTarget;
                                                                setTimeout(() => el.blur(), 0);
                                                            }}
                                                            disabled={hasBillDiscount}
                                                            placeholder="0"
                                                            aria-label={`Discount on ${item.name}`}
                                                            className="flex-1 h-9 px-3 bg-card border border-border rounded-lg text-body tabular-nums text-foreground placeholder:text-muted-foreground outline-none focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                        {hasBillDiscount && (
                                                            <span className="text-caption text-muted-foreground">
                                                                {activeBill.amend?.discountMode === 'bill' ? `Bill #${activeBill.amend.billNumber} has a bill discount` : 'Bill-level discount active'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isRated && (
                                                        <p className="text-caption text-info-chip-foreground mt-1">
                                                            From {activeBill.customerName}'s special rate — editing makes it a manual discount for this bill
                                                            {(rateCapped || item.limitOverride) && (
                                                                <>
                                                                    {' · '}
                                                                    {rateCapped ? 'selling at the limit price' : 'selling past the discount limit'}
                                                                    {canOverrideLimit && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateBillLine(activeBill.id, item._id, { limitChoice: undefined })}
                                                                            className="ml-1 underline hover:opacity-80"
                                                                        >
                                                                            change
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </p>
                                                    )}
                                                    {ratePriceChanged && (
                                                        <div className="mt-3 p-3 rounded-xl border border-warning-chip-foreground/25 bg-warning-chip/50">
                                                            <div className="flex items-center gap-2 text-body-sm text-warning-chip-foreground">
                                                                <FiAlertTriangle size={13} />
                                                                <span>
                                                                    Price changed {formatCurrency(item.ratePriceWhenSaved)} → {formatCurrency(item.price)} since {activeBill.customerName}'s rate ({formatCurrency(item.customerRate)}) was saved
                                                                </span>
                                                            </div>
                                                            {rateEdit.itemId === item._id ? (
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        autoFocus
                                                                        value={rateEdit.value}
                                                                        onChange={(e) => setRateEdit({ itemId: item._id, value: e.target.value })}
                                                                        onKeyDown={(e) => { if (e.key === 'Enter') submitRateEdit(activeBill, item); }}
                                                                        placeholder="New rate"
                                                                        aria-label="New rate"
                                                                        className="w-28 h-8 px-2.5 bg-card border border-border rounded-lg text-body tabular-nums text-foreground outline-none focus:border-ring"
                                                                    />
                                                                    <button type="button" onClick={() => submitRateEdit(activeBill, item)} className="h-8 px-3 rounded-lg text-body-sm font-medium bg-primary text-primary-foreground hover:[filter:var(--hover-brighten)]">Save rate</button>
                                                                    <button type="button" onClick={() => setRateEdit({ itemId: null, value: '' })} className="h-8 px-3 rounded-lg text-body-sm text-muted-foreground hover:bg-[var(--hover-overlay)]">Cancel</button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-2 mt-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => keepRateAtNewPrice(activeBill, item)}
                                                                        title={canSaveRates ? 'Confirm this rate at the new price' : 'Hide this warning for this bill'}
                                                                        className="h-8 px-3 rounded-lg text-body-sm font-medium bg-primary text-primary-foreground hover:[filter:var(--hover-brighten)]"
                                                                    >
                                                                        Keep {formatCurrency(item.customerRate)}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={!canSaveRates}
                                                                        onClick={() => setRateEdit({ itemId: item._id, value: String(item.customerRate) })}
                                                                        title={canSaveRates ? '' : "You don't have permission to change customer rates"}
                                                                        className="h-8 px-3 rounded-lg text-body-sm font-medium text-foreground bg-card border border-border hover:bg-[var(--hover-overlay)] disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        Update rate
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateBillLine(activeBill.id, item._id, { rateDismissed: true })}
                                                                        className="h-8 px-3 rounded-lg text-body-sm font-medium text-destructive hover:bg-destructive-chip"
                                                                    >
                                                                        Remove for this bill
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {!hasBillDiscount && (
                                                        <p className="text-caption text-muted-foreground mt-1">
                                                            Max discount: {formatCurrency(Math.floor((Number(discountCap) || 0) * 100) / 100)}
                                                            {item.maxDiscountPercent != null ? ` (${item.maxDiscountPercent}% of profit)` : ' (full profit — bounded by cost price)'}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Current sale (right): customer on top, totals and Pay at the bottom */}
                <aside className="w-[300px] xl:w-[340px] 2xl:w-[380px] border-l border-hairline flex flex-col bg-card flex-shrink-0" aria-label="Current sale">
                    <div className="flex-1 min-h-0 overflow-y-auto p-4">
                        <p className="font-mono text-overline-lg uppercase text-muted-foreground mb-2">Customer</p>
                        <div className="relative" ref={customerPickerRef}>
                            {activeBill?.customer ? (
                                <CustomerCard
                                    bill={activeBill}
                                    fmt={formatCurrency}
                                    onChange={() => setShowCustomerPicker((o) => !o)}
                                    onRemove={detachCustomer}
                                    onOpenLedger={canOpenLedger ? () => navigate(`/customers/${activeBill.customer}/ledger`) : null}
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowCustomerPicker((o) => !o)}
                                    aria-expanded={showCustomerPicker}
                                    className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-border px-3.5 py-3 text-left hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                    <span className="w-10 h-10 rounded-full bg-muted text-muted-foreground inline-flex items-center justify-center flex-none">
                                        <FiUser size={18} aria-hidden="true" />
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-body-lg font-medium text-foreground">Walk-in customer</span>
                                        <span className="block text-body-sm text-muted-foreground">Add a customer to sell on credit or use their prices</span>
                                    </span>
                                    <FiPlus size={16} className="text-primary flex-none" aria-hidden="true" />
                                </button>
                            )}
                    {showCustomerPicker && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-popover text-popover-foreground border border-hairline rounded-pop shadow-2 z-[100] overflow-hidden">
                            <div className="p-2.5 border-b border-hairline">
                                <Input
                                    type="text"
                                    autoFocus
                                    value={customerQuery}
                                    onChange={(e) => setCustomerQuery(e.target.value)}
                                    placeholder="Search by name or phone…"
                                    aria-label="Search customers"
                                />
                            </div>
                            <div className="max-h-[280px] overflow-y-auto p-1.5">
                                {searchingCustomers && <div className="px-2.5 py-2 text-body-sm text-muted-foreground">Searching…</div>}
                                {!searchingCustomers && customerQuery && customerResults.length === 0 && (
                                    <div className="px-2.5 py-2 text-body-sm text-muted-foreground">No customers found</div>
                                )}
                                {!searchingCustomers && !customerQuery && <div className="px-2.5 py-2 text-body-sm text-muted-foreground">Type a name or phone number</div>}
                                {customerResults.map((c) => (
                                    <button
                                        key={c._id}
                                        type="button"
                                        onClick={() => attachCustomer(c)}
                                        className="w-full min-h-11 px-2.5 py-1.5 rounded-[9px] text-left flex items-center justify-between gap-3 hover:bg-[var(--hover-overlay)] focus-visible:bg-[var(--hover-overlay)] outline-none"
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-body font-medium text-foreground truncate">{c.name}</span>
                                            <span className="block text-body-sm text-muted-foreground tabular-nums">{c.phone}</span>
                                        </span>
                                        {c.balance > 0 ? <StatusChip size="sm" tone="destructive" label={`Due ${formatCurrency(c.balance)}`} /> : null}
                                    </button>
                                ))}
                            </div>
                            <div className="p-1.5 border-t border-hairline">
                                <Button variant="ghost" size="xs" className="w-full" onClick={() => attachCustomer(null)}>
                                    Use walk-in customer
                                </Button>
                            </div>
                        </div>
                    )}
                        </div>
                    </div>

                    <div className="px-4 pt-3.5 pb-4 border-t border-hairline flex-shrink-0">


                {/* Totals — adding to an earlier bill */}
                {activeBill?.amend ? (() => {
                    const am = activeBill.amend;
                    const dueNow = am.due + effectiveTotal;
                    const row = 'flex justify-between text-body';
                    return (
                        <div className="flex flex-col gap-1.5 mb-3.5">
                            <div className={row}>
                                <span className="text-muted-foreground">Earlier total (Bill #{am.billNumber})</span>
                                <span className="text-foreground tabular-nums">{formatCurrency(am.total)}</span>
                            </div>
                            <div className={row}>
                                <span className="text-muted-foreground">New items ({activeItemCount})</span>
                                <span className="font-medium text-success tabular-nums">+ {formatCurrency(effectiveTotal)}</span>
                            </div>
                            <div className={row}>
                                <span className="text-muted-foreground">New total</span>
                                <span className="font-medium text-foreground tabular-nums">{formatCurrency(am.total + effectiveTotal)}</span>
                            </div>
                            <div className={row}>
                                <span className="text-muted-foreground">Already paid</span>
                                <span className="text-foreground tabular-nums">− {formatCurrency(am.paid)}</span>
                            </div>
                            {am.returned > 0 && (
                                <div className={row}>
                                    <span className="text-muted-foreground">Returned</span>
                                    <span className="text-foreground tabular-nums">− {formatCurrency(am.returned)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-end pt-3 mt-1 border-t border-hairline">
                                <span className="font-heading text-h4 text-foreground">Due now</span>
                                <span className="font-heading text-h1 font-semibold leading-none tracking-tight tabular-nums text-foreground">{formatCurrency(dueNow)}</span>
                            </div>
                        </div>
                    );
                })() : (
                <div className="flex flex-col gap-1.5 mb-3.5">
                    <div className="flex justify-between text-body">
                        <span className="text-muted-foreground">Subtotal ({activeItemCount} items)</span>
                        <span className="font-medium text-foreground">{formatCurrency(activeTotal.gross)}</span>
                    </div>

                    {activeTotal.itemDiscounts > 0 && (
                        <div className="flex justify-between text-body">
                            <span className="text-muted-foreground">Item discounts</span>
                            <span className="text-success">— {formatCurrency(activeTotal.itemDiscounts)}</span>
                        </div>
                    )}

                    {/* Bill-level discount input */}
                    <div className="flex justify-between items-center text-body">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <FiPercent size={12} />
                            <span>Bill discount</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                max={activeBill ? activeBill.items.reduce((sum, i) => sum + getItemDiscountCap(i), 0) : 0}
                                step="0.01"
                                value={activeBill?.billDiscountAmount || ''}
                                onChange={(e) => setBillDiscount(e.target.value, activeBill?.billDiscountReason || '')}
                                disabled={activeTotal.itemDiscounts > 0 || !activeBill || activeBill.items.length === 0}
                                placeholder="0"
                                aria-label="Bill discount amount"
                                className="w-24 h-8 px-2.5 text-right tabular-nums bg-card border border-border rounded-lg text-body text-foreground placeholder:text-muted-foreground outline-none focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            {activeTotal.billDiscount > 0 && (
                                <span className="text-success text-body-sm tabular-nums min-w-[60px] text-right">
                                    — {formatCurrency(activeTotal.billDiscount)}
                                </span>
                            )}
                        </div>
                    </div>

                    {activeTotal.itemDiscounts > 0 && (
                        <div className="text-body-sm text-muted-foreground">
                            {activeBill?.items.some((i) => i.discountSource === 'customerRate')
                                ? 'Bill discount disabled — customer special rates are applied'
                                : 'Bill discount disabled — clear item discounts to use it'}
                        </div>
                    )}

                    {activeTotal.billDiscount > 0 && (
                        <input
                            type="text"
                            value={activeBill?.billDiscountReason || ''}
                            onChange={(e) => setBillDiscount(activeBill?.billDiscountAmount || 0, e.target.value)}
                            placeholder="Discount reason (optional)"
                            aria-label="Discount reason"
                            className="h-8 px-2.5 bg-card border border-border rounded-lg text-body-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring"
                        />
                    )}

                    {activeTotal.tax > 0 && (
                        <div className="flex justify-between text-body">
                            <span className="text-muted-foreground">Tax</span>
                            <span className="text-foreground">{formatCurrency(activeTotal.tax)}</span>
                        </div>
                    )}

                    {canViewProfit && activeBill && activeBill.items.length > 0 && (
                        <div className="flex justify-between text-body">
                            <span className="text-muted-foreground">Bill profit</span>
                            <span className={`font-medium ${activeTotal.billProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {formatCurrency(activeTotal.billProfit)}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between items-end pt-3 mt-1 border-t border-hairline">
                        <span className="font-heading text-h4 text-foreground">Total</span>
                        <span className="font-heading text-h1 font-semibold leading-none tracking-tight tabular-nums text-foreground">{formatCurrency(effectiveTotal)}</span>
                    </div>
                </div>
                )}

                {/* Pay — the one primary action */}
                <Button
                    size="touch"
                    onClick={openPayment}
                    disabled={!activeBill || activeBill.items.length === 0}
                    className="w-full h-12 text-lead font-semibold"
                >
                    {activeBill?.amend ? <FiPlusCircle aria-hidden="true" /> : <FiShoppingCart aria-hidden="true" />}
                    <span className="tabular-nums">
                        {activeBill?.amend ? `Add to Bill #${activeBill.amend.billNumber} · ${formatCurrency(effectiveTotal)}` : `Pay ${formatCurrency(effectiveTotal)}`}
                    </span>
                    <span className="ml-1 inline-flex gap-1 opacity-75" aria-hidden="true">
                        <kbd className="h-5 px-1.5 rounded-md bg-black/15 font-mono text-mono-2xs leading-5">{MOD}</kbd>
                        <kbd className="h-5 px-1.5 rounded-md bg-black/15 font-mono text-mono-2xs leading-5">0</kbd>
                    </span>
                </Button>
                                </div>
                </aside>
            </div>

            {/* Save to an earlier bill — optional payment, or leave as credit */}
            {showPaymentModal && activeBill?.amend && (() => {
                const am = activeBill.amend;
                const dueNow = Math.round((am.due + effectiveTotal) * 100) / 100;
                const amount = parseFloat(amendPayAmount) || 0;
                const payInvalid = amendPayMethod !== 'credit' && (!(amount > 0) || amount > dueNow + 0.01);
                const offline = typeof navigator !== 'undefined' && !navigator.onLine;
                return (
                    <PosModal
                        title={`Add to Bill #${am.billNumber}`}
                        description={`${activeBill.customerName} · same bill number, updated receipt`}
                        icon={FiPlusCircle}
                        iconTone="info"
                        onClose={() => setShowPaymentModal(false)}
                    >
                        <div className="rounded-xl border border-hairline p-3.5 flex flex-col gap-1.5">
                            <SumRow label="Earlier total" value={formatCurrency(am.total)} />
                            <SumRow label="New items" value={`+ ${formatCurrency(effectiveTotal)}`} tone="success" />
                            <SumRow label="New total" value={formatCurrency(am.total + effectiveTotal)} strong />
                            <SumRow label={`Already paid${am.returned > 0 ? ' / returned' : ''}`} value={`− ${formatCurrency(am.paid + am.returned)}`} />
                            <div className="flex justify-between items-baseline pt-2 mt-0.5 border-t border-hairline">
                                <span className="text-body font-semibold text-foreground">Due now</span>
                                <span className="font-heading text-h2 tabular-nums text-foreground">{formatCurrency(dueNow)}</span>
                            </div>
                        </div>

                        <p className="mt-4 mb-2 font-mono text-overline-lg uppercase text-muted-foreground">Payment now</p>
                        <MethodTiles
                            value={amendPayMethod}
                            onChange={(id) => {
                                setAmendPayMethod(id);
                                if (id !== 'credit' && !amendPayAmount) setAmendPayAmount(String(dueNow));
                            }}
                            options={[
                                { id: 'credit', label: 'Credit', icon: FiUser },
                                { id: 'cash', label: 'Cash', icon: FiDollarSign },
                                { id: 'card', label: 'Card', icon: FiCreditCard },
                                { id: 'online', label: 'Online', icon: FiSmartphone },
                            ]}
                        />
                        {amendPayMethod === 'credit' ? (
                            <p className="mt-3 text-body-sm text-muted-foreground">
                                Nothing paid now — {formatCurrency(dueNow)} stays on {activeBill.customerName}'s Bill #{am.billNumber}.
                            </p>
                        ) : (
                            <div className="mt-3">
                                <label htmlFor="amend-pay" className="block mb-1.5 text-body font-medium text-foreground">
                                    Amount paid now <span className="font-normal text-muted-foreground">(up to {formatCurrency(dueNow)})</span>
                                </label>
                                <div className="flex gap-2">
                                    <Input id="amend-pay" type="number" min="0" step="0.01" mono className="h-11 text-lead flex-1" value={amendPayAmount} onChange={(e) => setAmendPayAmount(e.target.value)} />
                                    <Button variant="outline" className="h-11" onClick={() => setAmendPayAmount(String(dueNow))}>
                                        Full
                                    </Button>
                                </div>
                                {amount > 0 && amount <= dueNow + 0.01 && (
                                    <p className="mt-1.5 text-body-sm text-muted-foreground">Still due after this: {formatCurrency(Math.max(0, dueNow - amount))}</p>
                                )}
                                {amount > dueNow + 0.01 && <p className="mt-1.5 text-body-sm text-destructive">More than the due ({formatCurrency(dueNow)})</p>}
                                <AccountPicker method={amendPayMethod} value={amendAccountId} onChange={(id) => setAmendAccountId(id)} direction="in" compact className="mt-3" />
                            </div>
                        )}

                        {offline && <p className="mt-4 text-body-sm text-destructive">You're offline — adding to a bill needs an internet connection.</p>}

                        <Button size="touch" className="mt-5 w-full h-12 text-lead font-semibold" onClick={handleAmendSave} loading={processing} disabled={processing || payInvalid || offline}>
                            {processing ? 'Saving…' : (
                                <>
                                    <FiCheck aria-hidden="true" /> Save to Bill #{am.billNumber}
                                </>
                            )}
                        </Button>
                    </PosModal>
                );
            })()}

            {/* Payment */}
            {showPaymentModal && !activeBill?.amend && (
                <PosModal title="Payment" description={activeBill?.customer ? activeBill.customerName : 'Walk-in customer'} onClose={() => setShowPaymentModal(false)}>
                    <div className="rounded-xl bg-muted/60 px-4 py-3 flex items-baseline justify-between">
                        <span className="text-body text-muted-foreground">To pay</span>
                        <span className="font-heading text-h1 font-semibold leading-none tracking-tight tabular-nums text-foreground">{formatCurrency(effectiveTotal)}</span>
                    </div>

                    <p className="mt-4 mb-2 font-mono text-overline-lg uppercase text-muted-foreground">Method</p>
                    <MethodTiles
                        value={paymentMethod}
                        onChange={setPaymentMethod}
                        options={[
                            { id: 'cash', label: 'Cash', icon: FiDollarSign },
                            { id: 'card', label: 'Card', icon: FiCreditCard },
                            { id: 'upi', label: 'Online', icon: FiSmartphone },
                            { id: 'credit', label: 'Credit', icon: FiUser, disabled: !activeBill?.customer, title: !activeBill?.customer ? 'Attach a customer to sell on credit' : '' },
                        ]}
                    />
                    {!activeBill?.customer ? <p className="mt-1.5 text-body-sm text-muted-foreground">Credit needs a customer on the bill.</p> : null}
                    {/* Credit: only the part paid now (cash) lands in an account */}
                    <AccountPicker
                        method={paymentMethod === 'upi' ? 'online' : paymentMethod === 'credit' ? (parseFloat(creditPaidNow || 0) > 0 ? 'cash' : null) : paymentMethod}
                        value={posAccountId}
                        onChange={(id) => setPosAccountId(id)}
                        direction="in"
                        compact
                        className="mt-3"
                    />

                    {paymentMethod === 'credit' && activeBill?.customer && (
                        <div className="mt-4">
                            <label htmlFor="pos-credit-paid" className="block mb-1.5 text-body font-medium text-foreground">
                                Paid now <span className="font-normal text-muted-foreground">(optional)</span>
                            </label>
                            <Input
                                id="pos-credit-paid"
                                type="number"
                                mono
                                className="h-11 text-lead"
                                value={creditPaidNow}
                                onChange={(e) => setCreditPaidNow(e.target.value)}
                                placeholder="0 — leave empty for full credit"
                            />
                            {(() => {
                                const paid = Math.max(0, Math.min(parseFloat(creditPaidNow || 0), effectiveTotal));
                                const due = effectiveTotal - paid;
                                const previousBalance = activeBill.customerBalance || 0;
                                const totalPending = previousBalance + due;
                                return (
                                    <div className="mt-3 rounded-xl border border-hairline p-3.5 flex flex-col gap-1.5">
                                        <SumRow label="Paid now" value={formatCurrency(paid)} />
                                        <SumRow label={`Added to ${activeBill.customerName}'s balance`} value={formatCurrency(due)} strong tone={due > 0 ? 'destructive' : undefined} />
                                        {previousBalance > 0 && (
                                            <>
                                                <SumRow label="Already owed" value={formatCurrency(previousBalance)} className="pt-1.5 mt-0.5 border-t border-hairline" />
                                                <SumRow label="Total owed after this" value={formatCurrency(totalPending)} strong tone="destructive" />
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {paymentMethod === 'cash' && (
                        <div className="mt-4">
                            <label htmlFor="pos-cash" className="block mb-1.5 text-body font-medium text-foreground">
                                Cash received
                            </label>
                            <input
                                id="pos-cash"
                                ref={cashInputRef}
                                type="number"
                                value={cashGiven}
                                onChange={(e) => setCashGiven(e.target.value)}
                                placeholder="0"
                                className="w-full h-12 px-3.5 rounded-xl border border-border bg-card text-h3 font-semibold tabular-nums text-foreground placeholder:text-muted-foreground outline-none focus:border-ring"
                            />
                            <div className="grid grid-cols-4 gap-2 mt-2">
                                {[effectiveTotal, Math.ceil(effectiveTotal / 100) * 100, Math.ceil(effectiveTotal / 500) * 500, Math.ceil(effectiveTotal / 1000) * 1000]
                                    .filter((v, i, a) => a.indexOf(v) === i)
                                    .slice(0, 4)
                                    .map((amount, i) => (
                                        <Button key={amount} variant="outline" size="xs" className="tabular-nums" onClick={() => setCashGiven(amount.toString())}>
                                            {i === 0 ? 'Exact' : amount.toLocaleString()}
                                        </Button>
                                    ))}
                            </div>
                            {cashGiven !== '' && parseFloat(cashGiven || 0) < effectiveTotal ? (
                                <p className="mt-2 text-body-sm text-destructive">Short by {formatCurrency(effectiveTotal - parseFloat(cashGiven || 0))}</p>
                            ) : null}
                            {parseFloat(cashGiven || 0) >= effectiveTotal && (
                                <div className="mt-3 rounded-xl bg-success-chip px-4 py-3 flex items-baseline justify-between">
                                    <span className="text-body font-medium text-success-chip-foreground">Change to give</span>
                                    <span className="font-heading text-h2 tabular-nums text-success-chip-foreground">{formatCurrency(changeAmount)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <Button
                        size="touch"
                        className="mt-5 w-full h-12 text-lead font-semibold"
                        onClick={() => handleCheckout()}
                        loading={processing}
                        disabled={
                            processing ||
                            (paymentMethod === 'cash' && parseFloat(cashGiven || 0) < effectiveTotal) ||
                            (paymentMethod === 'credit' && !activeBill?.customer)
                        }
                    >
                        {processing ? 'Saving the sale…' : (
                            <>
                                <FiCheck aria-hidden="true" />
                                {paymentMethod === 'credit' ? 'Save on credit' : 'Complete payment'}
                            </>
                        )}
                    </Button>
                </PosModal>
            )}

            {/* Customer has a credit bill from today: add to it, or a new bill */}
            {amendOffer && (
                <PosModal
                    z="z-[200]"
                    title={`${amendOffer.customerName} has a credit bill from today`}
                    description="Add today's items to it, or start a new bill."
                    icon={FiPlusCircle}
                    iconTone="info"
                >
                    <div className="flex flex-col gap-2">
                        {amendOffer.bills.map((b) => (
                            <button
                                key={b.billId}
                                type="button"
                                onClick={() => startAmend(amendOffer.posBillId, b)}
                                className="w-full flex items-center justify-between gap-3 min-h-14 px-3.5 py-2.5 rounded-xl border border-border bg-card text-left hover:[background-image:linear-gradient(var(--hover-overlay),var(--hover-overlay))] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                            >
                                <span>
                                    <span className="block text-body-lg font-medium text-foreground">
                                        Bill #{b.billNumber} · {new Date(b.createdAt).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                    <span className="block text-body-sm text-muted-foreground">
                                        {b.items.length} item{b.items.length === 1 ? '' : 's'} · total {formatCurrency(b.total)}
                                    </span>
                                </span>
                                <span className="text-right">
                                    <span className="block text-body-lg font-semibold tabular-nums text-destructive">{formatCurrency(b.due)} due</span>
                                    <span className="block text-body-sm font-medium text-primary">Add to this bill →</span>
                                </span>
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" size="touch" className="mt-3 w-full" onClick={() => setAmendOffer(null)}>
                        New bill
                    </Button>
                </PosModal>
            )}

            {/* Walk-in confirmation */}
            {showWalkInConfirm && (
                <PosModal z="z-[200]" size="sm" title="Sell as walk-in?" description="No customer is attached to this bill." icon={FiUser} iconTone="warning" onClose={() => setShowWalkInConfirm(false)}>
                    <p className="text-body text-muted-foreground">
                        This sale <span className="font-medium text-foreground">won't go on any customer's ledger</span>, so you can't look it up by customer later.
                    </p>
                    <div className="mt-5 flex flex-col gap-2">
                        <Button
                            size="touch"
                            onClick={() => {
                                setShowWalkInConfirm(false);
                                handleCheckout(true);
                            }}
                        >
                            Yes, sell as walk-in
                        </Button>
                        <Button
                            variant="outline"
                            size="touch"
                            onClick={() => {
                                setShowWalkInConfirm(false);
                                setShowCustomerPicker(true);
                            }}
                        >
                            <FiUserCheck aria-hidden="true" />
                            Add a customer
                        </Button>
                        <Button variant="ghost" onClick={() => setShowWalkInConfirm(false)}>
                            Cancel
                        </Button>
                    </div>
                </PosModal>
            )}

            {/* Sale saved */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay)] animate-ds-fade">
                    <div role="dialog" aria-modal="true" aria-labelledby="pos-success-title" className="w-full max-w-sm bg-popover text-popover-foreground border border-hairline rounded-pop shadow-2 p-6 text-center animate-ds-dialog-in">
                        <span className="mx-auto w-14 h-14 rounded-full bg-success-chip text-success-chip-foreground inline-flex items-center justify-center">
                            <FiCheck size={28} aria-hidden="true" />
                        </span>
                        <h3 id="pos-success-title" className="mt-3 font-heading text-h3 text-foreground">
                            {successData?.amended ? `Bill #${successData.billNumber} updated` : 'Sale complete'}
                        </h3>
                        {successData?.amended && successData.change && (
                            <div className="text-left rounded-xl border border-hairline p-3.5 mt-4 flex flex-col gap-1.5">
                                <SumRow label="Added" value={formatCurrency(successData.change.addedTotal)} />
                                <SumRow label="Bill total" value={`${formatCurrency(successData.change.totalBefore)} → ${formatCurrency(successData.change.totalAfter)}`} />
                                {successData.change.paymentAmount > 0 && (
                                    <SumRow label={`Paid now (${successData.change.paymentMethod})`} value={formatCurrency(successData.change.paymentAmount)} tone="success" />
                                )}
                                <SumRow label="Still due on this bill" value={formatCurrency(successData.change.dueAfter)} strong className="pt-1.5 mt-0.5 border-t border-hairline" />
                            </div>
                        )}
                        {successData && !successData.amended && (
                            <div className="text-left rounded-xl border border-hairline p-3.5 mt-4 flex flex-col gap-1.5">
                                {successData.billNumber && <SumRow label="Bill #" value={successData.billNumber} />}
                                <SumRow label="Total" value={formatCurrency(successData.total)} strong />
                                {(successData.creditPayments || []).map((c, i) => (
                                    <SumRow key={i} label={`Paid by credit (from Bill #${c.fromBillNumber})`} value={formatCurrency(c.amount)} tone="success" />
                                ))}
                                {successData.paymentMethod === 'cash' && successData.change > 0 && (
                                    <div className="flex justify-between items-baseline pt-2 mt-0.5 border-t border-hairline">
                                        <span className="text-body font-medium text-success">Change</span>
                                        <span className="font-heading text-h2 tabular-nums text-success">{formatCurrency(successData.change)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex gap-2 mt-5">
                            <Button
                                variant="outline"
                                size="touch"
                                className="flex-1"
                                onClick={() => {
                                    setShowSuccess(false);
                                    setSuccessData(null);
                                    focusScan();
                                }}
                            >
                                New sale
                                <Kbd className="ml-1">Esc</Kbd>
                            </Button>
                            {(successData?.bill || successData?.savedBill) && (
                                <Button
                                    size="touch"
                                    className="flex-1"
                                    onClick={() => (successData.amended ? printAmendedReceipt(successData.savedBill, successData.change) : printReceipt(successData, successData.bill))}
                                >
                                    <FiPrinter aria-hidden="true" />
                                    Print receipt
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

// ==================== ADMIN DASHBOARD ====================
// The admin dashboard lives in ./dashboard/AdminDashboard.jsx (design Stage 7).

// ==================== MAIN DASHBOARD WRAPPER ====================
const Dashboard = () => {
    const { isEmployee } = useAuth();
    return isEmployee ? <EmployeeDashboard /> : <AdminDashboard />;
};

export default Dashboard;
