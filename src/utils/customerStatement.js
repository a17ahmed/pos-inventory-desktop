// Customer statement (ledger) — shared helpers for the Customer Ledger screen.
//
// The screen reads GET /customer/:id/statement and GET /customer/:id/pending-bills.
// Balances always come from the backend. While those endpoints aren't deployed
// (404), the same shapes are built from the old GET /customer/:id/ledger, whose
// rows already carry the backend's running balance.

import {
    getCustomerStatement,
    getCustomerPendingBills,
    getCustomerLedger,
} from '../services/api/customers';

// "Since last zero" (the default): everything after the last time the customer
// owed nothing (balance 0 or in credit) — older activity was settled.
export const DEFAULT_PERIOD = 'sinceZero';

export const PERIOD_OPTIONS = [
    { value: 'sinceZero', label: 'Since last zero' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: 'all', label: 'All time' },
    { value: 'custom', label: 'Custom' },
];

export const TYPE_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'bill', label: 'Bills' },
    { value: 'payment', label: 'Payments' },
    { value: 'return', label: 'Returns' },
    { value: 'cancelled', label: 'Cancelled' },
];

export const PAGE_SIZE = 50;

const fmtNum = (n) => Number(Math.abs(n || 0)).toLocaleString('en-US', { maximumFractionDigits: 2 });

// Balance text: positive = customer owes, negative = credit ("Cr 300").
export const formatBalance = (n, currency = 'Rs.') => {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return v < 0 ? `Cr ${currency} ${fmtNum(v)}` : `${currency} ${fmtNum(v)}`;
};

// "12 Oct – 16 Oct" for YYYY-MM-DD inputs; adds the year when it isn't this year.
export const formatDateRange = (from, to) => {
    const thisYear = new Date().getFullYear();
    const fmt = (s) => {
        const d = new Date(`${s}T00:00:00`);
        return d.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            ...(d.getFullYear() !== thisYear ? { year: 'numeric' } : {}),
        });
    };
    return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
};

const fmtDay = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
// Backend dates are ISO (UTC); the shop runs on Pakistan time
const fmtPkDay = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });

// "Since last zero (15 Oct 2026 – Today)", "Today (20 Oct 2026)", "This month", "12 Oct 2026 – 18 Oct 2026"…
export const describePeriod = (period, preset) => {
    if ((period?.preset || preset) === 'sinceZero') {
        // from = the zero point; null = never settled / no history → the whole account
        return period?.from ? `Since last zero (${fmtPkDay(period.from)} – Today)` : 'Since last zero (all time)';
    }
    const option = PERIOD_OPTIONS.find((o) => o.value === (period?.preset || preset));
    if (option && option.value !== 'custom' && option.value !== 'all' && period?.from && period?.to) {
        const from = fmtDay(period.from);
        const to = fmtDay(period.to);
        return from === to ? `${option.label} (${from})` : `${option.label} (${from} – ${to})`;
    }
    if (option?.value === 'all') return 'All time';
    if (period?.from && period?.to) {
        const from = fmtDay(period.from);
        const to = fmtDay(period.to);
        return from === to ? from : `${from} – ${to}`;
    }
    return option?.label || 'Period';
};

// One line explaining where a "since last zero" statement starts (period.sinceZero).
export const describeSinceZero = (info) => {
    if (!info) return '';
    switch (info.status) {
        case 'open':
            return info.zeroAt ? `Since ${fmtPkDay(info.zeroAt)}: last time the balance was 0` : 'Since the last time the balance was 0';
        case 'neverSettled':
            return 'Never fully settled, showing all entries';
        case 'settled':
            return info.settledAt ? `Fully settled on ${fmtPkDay(info.settledAt)}, showing the last cycle` : 'Fully settled, showing the last cycle';
        case 'noBalance':
            return 'No balance history';
        default:
            return '';
    }
};

// ── Fallback: build the statement from the old ledger endpoint ───────────────

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

// Local-time range for a preset (the shop's PCs run on Pakistan time).
const periodRange = (preset, from, to) => {
    const now = new Date();
    switch (preset) {
        case 'yesterday': {
            const y = new Date(now); y.setDate(now.getDate() - 1);
            return { start: startOfDay(y), end: endOfDay(y) };
        }
        case 'week': {
            const s = new Date(now); s.setDate(now.getDate() - now.getDay()); // week starts Sunday
            return { start: startOfDay(s), end: endOfDay(now) };
        }
        case 'month':
            return { start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), end: endOfDay(now) };
        case 'lastMonth':
            return {
                start: startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
                end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
            };
        case 'all':
            return { start: null, end: null };
        case 'custom':
            return {
                start: from ? startOfDay(new Date(`${from}T00:00:00`)) : null,
                end: to ? endOfDay(new Date(`${to}T00:00:00`)) : null,
            };
        default:
            return { start: startOfDay(now), end: endOfDay(now) };
    }
};

// Since last zero, from the running balances: the cycle that ends with the last
// line still owing (or the whole history), starting right after the zero before it.
const legacySinceZero = (money) => {
    const bal = (e) => e.balance || 0;
    let last = -1; // last line where the customer owed something
    for (let i = money.length - 1; i >= 0; i--) if (bal(money[i]) > 0.005) { last = i; break; }
    if (last === -1) return { startIndex: 0, info: { status: 'noBalance', zeroAt: null, settledAt: null } };
    let zero = -1;
    for (let i = last - 1; i >= 0; i--) if (bal(money[i]) <= 0.005) { zero = i; break; }
    const settled = bal(money[money.length - 1]) <= 0.005;
    return {
        startIndex: zero + 1,
        info: {
            status: settled ? 'settled' : zero >= 0 ? 'open' : 'neverSettled',
            zeroAt: zero >= 0 ? money[zero].date : null,
            settledAt: settled ? money[last + 1]?.date || null : null,
        },
    };
};

const legacyStatement = (ledgerData, params) => {
    const all = (ledgerData?.ledger || []).map((e, i) => ({ ...e, id: `${e.billId || 'x'}:${e.type}:${i}` }));
    const money = all.filter((e) => e.type !== 'cancelled');
    const preset = params.period || DEFAULT_PERIOD;
    const sinceZero = preset === 'sinceZero' ? legacySinceZero(money) : null;
    // Since last zero cuts by position (the zero line and the next can share a timestamp)
    const { start, end } = sinceZero
        ? { start: money[sinceZero.startIndex] ? new Date(money[sinceZero.startIndex].date) : null, end: null }
        : periodRange(preset, params.from, params.to);
    const inRange = (e) => {
        const t = new Date(e.date).getTime();
        return (!start || t >= start.getTime()) && (!end || t <= end.getTime());
    };

    const before = sinceZero
        ? money.slice(0, sinceZero.startIndex)
        : start ? money.filter((e) => new Date(e.date).getTime() < start.getTime()) : [];
    const openingBalance = before.length ? before[before.length - 1].balance || 0 : 0;
    const periodMoney = sinceZero ? money.slice(sinceZero.startIndex) : money.filter(inRange);
    const closingBalance = periodMoney.length ? periodMoney[periodMoney.length - 1].balance || 0 : openingBalance;
    const sum = (rows, key) => rows.reduce((s, e) => s + (e[key] || 0), 0);

    const type = params.type || 'all';
    let rows = type === 'cancelled'
        ? all.filter((e) => e.type === 'cancelled' && inRange(e))
        : periodMoney.filter((e) => type === 'all' || e.type === type || (type === 'payment' && e.type === 'credit_transfer'));
    const search = String(params.search || '').trim();
    if (search) rows = rows.filter((e) => String(e.billNumber || '').includes(search));
    if (params.sort === 'newest') rows = [...rows].reverse();

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || PAGE_SIZE;
    const s = ledgerData?.summary || {};
    const amountDue = s.currentBalance || 0;

    return {
        legacy: true,
        summary: {
            totalBilled: s.totalBilled || 0,
            totalPaid: s.totalPaid || 0,
            totalReturns: s.totalReturns || 0,
            totalBills: s.billCount || 0,
            amountDue,
            availableCredit: amountDue < 0 ? -amountDue : 0,
        },
        period: {
            preset,
            from: sinceZero ? sinceZero.info.zeroAt : start ? start.toISOString() : (money[0]?.date || null),
            to: sinceZero ? null : end ? end.toISOString() : new Date().toISOString(),
            ...(sinceZero && { sinceZero: sinceZero.info }),
            openingBalance,
            bills: sum(periodMoney.filter((e) => e.type === 'bill' || e.type === 'opening_balance'), 'debit'),
            payments: sum(periodMoney.filter((e) => e.type === 'payment' && !e.fromCredit), 'credit'),
            returns: sum(periodMoney.filter((e) => e.type === 'return'), 'credit'),
            closingBalance,
            entryCount: rows.length,
            cancelledCount: all.filter((e) => e.type === 'cancelled' && inRange(e)).length,
        },
        entries: rows.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: rows.length, pages: Math.max(1, Math.ceil(rows.length / limit)), hasMore: page * limit < rows.length },
    };
};

const legacyPendingBills = (ledgerData) => {
    const byBill = new Map();
    for (const e of ledgerData?.ledger || []) {
        if (!e.billId || e.type === 'cancelled') continue;
        const key = String(e.billId);
        if (!byBill.has(key)) byBill.set(key, { billId: e.billId, billNumber: e.billNumber, date: e.date, total: 0, credited: 0 });
        const b = byBill.get(key);
        b.total += e.debit || 0;
        b.credited += e.credit || 0;
    }
    const bills = [...byBill.values()]
        .map((b) => ({ ...b, due: Math.round((b.total - b.credited) * 100) / 100 }))
        .filter((b) => b.due > 0.005)
        .map((b) => ({ billId: b.billId, billNumber: b.billNumber, date: b.date, total: b.total, due: b.due, ageDays: Math.floor((Date.now() - new Date(b.date)) / 86400000) }));
    const amountDue = ledgerData?.summary?.currentBalance || 0;
    const totalDue = bills.reduce((s, b) => s + b.due, 0);
    return { legacy: true, bills, totalDue, availableCredit: amountDue < 0 ? -amountDue : 0, amountDue };
};

const isNotFound = (err) => err?.response?.status === 404;

/** Statement page for the current filters ({ period, from, to, type, sort, search, page, limit }). */
export const loadStatement = async (customerId, params) => {
    try {
        const res = await getCustomerStatement(customerId, params);
        return res.data;
    } catch (err) {
        if (!isNotFound(err)) throw err;
        const res = await getCustomerLedger(customerId, { includeCancelled: true });
        return legacyStatement(res.data, params);
    }
};

/** Bills that make up Amount Due (Record Payment + the Amount Due panel). */
export const loadPendingBills = async (customerId, params = { sort: 'oldest' }) => {
    try {
        const res = await getCustomerPendingBills(customerId, params);
        return res.data;
    } catch (err) {
        if (!isNotFound(err)) throw err;
        const res = await getCustomerLedger(customerId);
        return legacyPendingBills(res.data);
    }
};

/** Every line of a period (all pages), for print/PDF. Cancelled bills are never included. */
export const loadFullStatement = async (customerId, params) => {
    const base = { ...params, type: 'all', sort: 'oldest', search: '', limit: 200 };
    const first = await loadStatement(customerId, { ...base, page: 1 });
    let entries = [...(first.entries || [])];
    let page = 1;
    let hasMore = first.pagination?.hasMore;
    while (hasMore) {
        page += 1;
        const next = await loadStatement(customerId, { ...base, page });
        entries = entries.concat(next.entries || []);
        hasMore = next.pagination?.hasMore && (next.entries || []).length > 0;
    }
    return { ...first, entries: entries.filter((e) => e.type !== 'cancelled') };
};

// ── Statement HTML (shared by Print and Download PDF) ─────────────────────────

// How a return settled: "unpaid amount reduced 2,000 · credit 1,000".
export const returnNote = (e, money) => [
    e?.debtWriteOff > 0 && `unpaid amount reduced ${money(e.debtWriteOff)}`,
    e?.storeCredit > 0 && `credit ${money(e.storeCredit)}`,
].filter(Boolean).join(' · ');

const typeLabel = (e) => ({
    bill: 'SALE', payment: 'PAID', return: 'RETURN', opening_balance: 'OPENING', credit_transfer: 'CREDIT MOVED',
}[e.type] || String(e.type || '').toUpperCase());
// Same colours as the on-screen tags (SALE red, PAID green, RETURN amber, OPENING indigo)
const typeColor = (e) => ({
    bill: '#dc2626', payment: '#059669', return: '#d97706', opening_balance: '#4f46e5',
}[e.type] || '#64748b');
const methodText = (e) => (e.method === 'store_credit'
    ? `STORE CREDIT${e.fromBillNumber ? ` (from Bill #${e.fromBillNumber})` : ''}`
    : e.method?.toUpperCase());

/**
 * Printable statement for one period: customer, period, opening balance, every
 * line, closing balance and the all-time Amount Due.
 */
// PDF pages hold this many line "units" (a return with a note line counts 1.3).
// The PDF is rendered at a fixed width (STATEMENT_PDF_WIDTH), so these hold on any window size.
export const STATEMENT_PDF_WIDTH = 1120;
const PDF_FIRST_PAGE_UNITS = 10;
const PDF_PAGE_UNITS = 22;

/**
 * Printable statement for one period. `paged: true` (PDF) splits the lines into
 * page-sized tables that each repeat the column headings — the PDF is an image of
 * the page, so a single table's <thead> would only appear once. Print uses one
 * table; the browser repeats its <thead> on every printed page by itself.
 */
export const buildStatementHtml = ({ business, customer, statement, currency = 'PKR', periodText, paged = false }) => {
    const { summary = {}, period = {}, entries = [] } = statement;
    const money = (v) => `${currency} ${fmtNum(v)}`;
    const bal = (v) => formatBalance(v, currency);
    const cell = 'padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;';
    const due = summary.amountDue || 0;

    const rowHtml = entries.map((e) => `<tr style="page-break-inside:avoid;">
        <td style="${cell}">${fmtDay(e.date)}</td>
        <td style="${cell}">${e.billNumber ? '#' + e.billNumber : '—'}</td>
        <td style="${cell}"><span style="color:${typeColor(e)};font-size:10px;font-weight:700;margin-right:6px;">${typeLabel(e)}</span>${e.description || ''}${e.type === 'return' && returnNote(e, money) ? `<div style="font-size:9px;color:#94a3b8;">${returnNote(e, money)}</div>` : ''}</td>
        <td style="${cell}">${[methodText(e), e.receivedBy].filter(Boolean).join(' / ') || '—'}</td>
        <td style="${cell}text-align:right;color:${e.type === 'credit_transfer' ? '#64748b' : '#ef4444'};font-weight:600;">${e.debit ? money(e.debit) : '—'}</td>
        <td style="${cell}text-align:right;color:#10b981;font-weight:600;">${e.credit ? money(e.credit) : '—'}</td>
        <td style="${cell}text-align:right;font-weight:700;">${bal(e.balance)}</td>
    </tr>`);

    const balanceRow = (label, value) => `<tr style="background:#f8fafc;">
        <td colspan="6" style="${cell}font-weight:700;">${label}</td>
        <td style="${cell}text-align:right;font-weight:800;">${bal(value)}</td>
    </tr>`;

    // Top border on the heading cells, not the table: a table's own top border
    // showed as a stray line at the bottom of the previous PDF page.
    const th = 'padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;border-top:1px solid #e2e8f0;border-bottom:2px solid #e2e8f0;';
    // Later pages start with a few px of white: the PDF slicer carries the first
    // pixel row of the next page onto the previous one (it showed as a grey line).
    const table = (body, { breakBefore = false } = {}) => `${breakBefore ? '<div style="page-break-before:always;padding-top:8px;">' : '<div>'}
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
            <thead style="display:table-header-group;"><tr style="background:#f1f5f9;">
                <th style="${th}text-align:left;">Date</th><th style="${th}text-align:left;">Voucher</th>
                <th style="${th}text-align:left;">Description</th><th style="${th}text-align:left;">Method / By</th>
                <th style="${th}text-align:right;">Debit</th><th style="${th}text-align:right;">Credit</th>
                <th style="${th}text-align:right;">Balance</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table></div>`;

    // Split the lines into page-sized groups (PDF only)
    const pages = [];
    if (paged && rowHtml.length > 0) {
        let current = [];
        let units = 0;
        let limit = PDF_FIRST_PAGE_UNITS;
        entries.forEach((e, i) => {
            const weight = e.type === 'return' && returnNote(e, money) ? 1.3 : 1;
            if (current.length > 0 && units + weight > limit) {
                pages.push(current);
                current = [];
                units = 0;
                limit = PDF_PAGE_UNITS;
            }
            current.push(rowHtml[i]);
            units += weight;
        });
        pages.push(current);
    } else {
        pages.push(rowHtml);
    }

    const emptyRow = `<tr><td colspan="7" style="${cell}text-align:center;color:#94a3b8;">No transactions in this period</td></tr>`;
    const tablesHtml = pages.map((rows, i) => table(
        (i === 0 ? balanceRow('Opening balance', period.openingBalance) : '')
        + (rows.join('') || emptyRow)
        + (i === pages.length - 1 ? balanceRow('Closing balance', period.closingBalance) : ''),
        { breakBefore: i > 0 }
    )).join('');

    const box = (label, value, color = '#1e293b') => `<div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600;">${label}</div>
        <div style="font-size:15px;font-weight:700;margin-top:2px;color:${color};">${value}</div></div>`;

    return `
    <div style="font-family:Arial,Helvetica,sans-serif;padding:20px 24px;color:#1e293b;background:#fff;width:100%;">
        <div style="text-align:center;margin-bottom:12px;">
            <div style="font-size:13px;font-weight:800;letter-spacing:0.08em;color:#0f172a;">DESKTOP POS</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">Software by Ahmed Irfan &nbsp;•&nbsp; Phone: +923070019031 &nbsp;•&nbsp; WhatsApp: https://wa.me/923070019031</div>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:14px;" />
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div>
                <h1 style="margin:0;font-size:22px;font-weight:700;">Customer Statement</h1>
                <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Period: <b>${periodText}</b> &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</p>
            </div>
            ${business?.name ? `<div style="text-align:right;"><div style="font-size:14px;font-weight:700;">${business.name}</div>${business.phone ? `<div style="font-size:11px;color:#64748b;">${business.phone}</div>` : ''}</div>` : ''}
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
            <div style="font-size:16px;font-weight:700;margin-bottom:4px;">${customer?.name || 'Customer'}</div>
            <div style="display:flex;gap:24px;font-size:11px;color:#64748b;">
                ${customer?.phone ? `<span>Phone: ${customer.phone}</span>` : ''}
                ${customer?.address ? `<span>Address: ${customer.address}</span>` : ''}
            </div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:16px;">
            ${box('Opening balance', bal(period.openingBalance))}
            ${box('Bills', '+ ' + money(period.bills))}
            ${box('Paid', '− ' + money(period.payments), '#10b981')}
            ${box('Returns', '− ' + money(period.returns))}
            ${box('Closing balance', bal(period.closingBalance))}
            ${box(due < 0 ? 'Store credit (all time)' : 'Amount due (all time)', money(due), due > 0 ? '#ef4444' : '#10b981')}
        </div>
        ${tablesHtml}
        <div style="margin-top:12px;font-size:10px;color:#94a3b8;text-align:center;">
            Lines: ${entries.length} &nbsp;|&nbsp; Amount due (all time): ${money(due)}${due < 0 ? ' credit' : ''}
        </div>
    </div>`;
};
