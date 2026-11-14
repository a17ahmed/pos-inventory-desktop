import React, { useEffect, useState } from 'react';
import {
    FiPlus,
    FiRefreshCw,
    FiTrash2,
    FiPrinter,
    FiDownload,
    FiMoreHorizontal,
    FiSun,
    FiMoon,
    FiMonitor,
    FiDollarSign,
    FiCreditCard,
    FiSmartphone,
    FiCheck,
    FiPackage,
    FiFileText,
    FiCopy,
    FiEdit2,
    FiLock,
} from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';
import { ACCENTS, MODES } from '../utils/appearance';
import { STATUS } from '../utils/statusTones';
import {
    Button,
    IconButton,
    Input,
    Textarea,
    Select,
    SearchInput,
    Field,
    Checkbox,
    Switch,
    SegmentedControl,
    StatusChip,
    StatusBadge,
    Card,
    CardTitle,
    CardDescription,
    InsetCard,
    SectionCard,
    Money,
    Spinner,
    Skeleton,
    IndeterminateBar,
    EmptyState,
    NoResults,
    StateCard,
    Dialog,
    ConfirmDialog,
    Drawer,
    DrawerSection,
    DetailList,
    Menu,
    Tooltip,
    toast,
    Banner,
    Alert,
    DataTable,
    rowActions,
    Dash,
    KpiCard,
    KpiStrip,
    Stat,
    ChartPanel,
    BarChart,
    AreaChart,
    DonutChart,
    HorizontalBarChart,
    Sparkline,
} from '../components/ui';
import { appAlert, appConfirm, appChoose } from '../components/AppDialog';

/**
 * Design Lab — every building block in every state, light and dark, for review before
 * screens use them (design/ROADMAP.md Stage 3). Dev builds only (route added in App.jsx).
 * The accent switch here only previews; it saves nothing.
 */

const Block = ({ title, note, children }) => (
    <SectionCard title={title} description={note}>
        <div className="flex flex-col gap-5">{children}</div>
    </SectionCard>
);

const Row = ({ label, children }) => (
    <div className="flex flex-col gap-2">
        {label && <p className="font-mono text-overline-lg uppercase text-muted-foreground">{label}</p>}
        <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
);

/** Stage 4 — dialogs, drawer, menu, tooltip, toasts, banners. */
const OverlaysLab = () => {
    const [open, setOpen] = useState(null); // 'sm' | 'md' | 'lg' | 'xl' | 'confirm' | 'drawer'
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [answer, setAnswer] = useState('');
    const close = () => setOpen(null);
    const fakeSave = () => {
        setSaving(true);
        setTimeout(() => {
            setSaving(false);
            close();
            toast.success('Customer saved', { description: 'Ali Traders · credit limit Rs 50,000' });
        }, 900);
    };

    return (
        <>
            <Block title="Dialogs" note="Sizes 400 · 480 · 640 · 880. Esc closes; a click outside does not (a half-filled form never vanishes). Focus starts in the first field; Tab stays inside.">
                <Row label="Sizes">
                    {['sm', 'md', 'lg', 'xl'].map((sz) => (
                        <Button key={sz} variant="outline" onClick={() => setOpen(sz)}>
                            {sz}
                        </Button>
                    ))}
                </Row>
                <Row label="Confirm (from JSX) · appAlert / appConfirm / appChoose (from code — every existing popup)">
                    <Button variant="outline" onClick={() => setOpen('confirm')}>
                        Cancel bill…
                    </Button>
                    <Button variant="outline" onClick={() => appAlert('The receipt printer is not connected.')}>
                        appAlert
                    </Button>
                    <Button
                        variant="outline"
                        onClick={async () => setAnswer(String(await appConfirm('Delete this product?', { danger: true, confirmText: 'Delete' })))}
                    >
                        appConfirm
                    </Button>
                    <Button
                        variant="outline"
                        onClick={async () =>
                            setAnswer(
                                String(
                                    await appChoose('This bill has a discount. What should happen to it?', {
                                        choices: [
                                            { label: 'Keep the discount', value: 'keep' },
                                            { label: 'Remove it', value: 'remove' },
                                            { label: 'Cancel the bill', value: 'cancel', danger: true },
                                        ],
                                        defaultValue: 'keep',
                                    })
                                )
                            )
                        }
                    >
                        appChoose
                    </Button>
                    {answer ? <span className="text-body text-muted-foreground">Answer: <span className="font-mono">{answer}</span></span> : null}
                </Row>
            </Block>

            <Block title="Drawer, menu and tooltip" note="The drawer shows one record beside the list (first used in Stage 6). Row actions go in a ⋯ menu; every icon-only button has a tooltip.">
                <Row>
                    <Button variant="outline" onClick={() => setOpen('drawer')}>
                        Open bill drawer
                    </Button>
                    <Menu
                        label="Bill actions"
                        trigger={
                            <IconButton label="More actions" variant="outline">
                                <FiMoreHorizontal />
                            </IconButton>
                        }
                        items={[
                            { label: 'Open bill', icon: FiFileText, onSelect: () => toast('Open bill') },
                            { label: 'Reprint receipt', icon: FiPrinter, onSelect: () => toast('Reprint') },
                            { label: 'Copy bill number', icon: FiCopy, hint: '#1042', onSelect: () => toast('Copied #1042') },
                            { label: 'Edit (closed day)', icon: FiEdit2, disabled: true },
                            { separator: true },
                            { label: 'Cancel bill', icon: FiTrash2, danger: true, onSelect: () => setOpen('confirm') },
                        ]}
                    />
                    <IconButton label="Print receipt" variant="outline">
                        <FiPrinter />
                    </IconButton>
                    <Tooltip content="Locked after the day is closed">
                        <span tabIndex={0} className="inline-flex items-center gap-1.5 text-body text-muted-foreground rounded-md">
                            <FiLock className="w-3.5 h-3.5" aria-hidden="true" /> Hover or Tab here
                        </span>
                    </Tooltip>
                </Row>
            </Block>

            <Block title="Toasts" note="Bottom centre, never over the pay button. One per screen at a time: a new one replaces the last (the POS adds items fast).">
                <Row>
                    <Button variant="outline" onClick={() => toast.success('Bill #1042 saved', { description: 'Cash Rs 1,250 · change Rs 50' })}>Success</Button>
                    <Button variant="outline" onClick={() => toast.warning('Only 3 in stock')}>Warning</Button>
                    <Button variant="outline" onClick={() => toast.info('Ali\'s special rate applied')}>Info</Button>
                    <Button variant="outline" onClick={() => toast.error('Failed to save: network error')}>Error</Button>
                    <Button variant="outline" onClick={() => toast('Switched to Bill 2')}>Neutral</Button>
                </Row>
            </Block>

            <Block title="Banners and alerts" note="Banner = one line + action. Alert = title + text. The tint says how serious; the words say what to do.">
                <Banner tone="warning" action={<Button variant="link">Pay now</Button>}>Your subscription is due on 15 Nov.</Banner>
                <Banner tone="info">Draft. Check the items, then save the supply.</Banner>
                <Banner tone="destructive">Could not load the statement.</Banner>
                <Banner>Read-only: this day is closed.</Banner>
                <Alert tone="warning" title="Enter your bank / online opening balance" action={<Button variant="warning" size="xs">Enter balance</Button>}>
                    Until then Bank starts at Rs 0, so payments out of it will be refused.
                </Alert>
                <Alert tone="destructive">Amount is more than the cash in the drawer (Rs 4,300).</Alert>
                <Alert tone="success" title="Closing finalized">The day is locked. Reports now include it.</Alert>
            </Block>

            {['sm', 'md', 'lg', 'xl'].includes(open) ? (
                <Dialog
                    open
                    onClose={saving ? undefined : close}
                    size={open}
                    title="Add customer"
                    description={`Size ${open} — ${{ sm: 400, md: 480, lg: 640, xl: 880 }[open]}px`}
                    footerBar
                    footer={
                        <>
                            <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
                            <Button onClick={fakeSave} loading={saving}>Save customer</Button>
                        </>
                    }
                >
                    <div className={open === 'sm' ? 'flex flex-col gap-4' : 'grid grid-cols-2 gap-4'}>
                        <Field label="Name" required>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ali Traders" />
                        </Field>
                        <Field label="Phone" hint="Used for WhatsApp receipts">
                            <Input placeholder="0300 1234567" mono />
                        </Field>
                        <Field label="Credit limit" optional>
                            <Input placeholder="0" mono />
                        </Field>
                        <Field label="Type">
                            <Select defaultValue="retail">
                                <option value="retail">Retail</option>
                                <option value="wholesale">Wholesale</option>
                            </Select>
                        </Field>
                    </div>
                </Dialog>
            ) : null}

            <ConfirmDialog
                open={open === 'confirm'}
                tone="destructive"
                title="Cancel bill #1042?"
                message="It is removed from reports and the customer's balance, and its stock comes back."
                note="Rs 1,250 cash will be taken out of the Money Book."
                confirmText="Cancel bill"
                cancelText="Keep bill"
                onCancel={close}
                onConfirm={() => {
                    close();
                    toast.success('Bill #1042 cancelled');
                }}
            />

            <Drawer
                open={open === 'drawer'}
                onClose={close}
                eyebrow="Bill #1042"
                title="Ali Traders"
                meta={
                    <>
                        <StatusBadge kind="bill" value="partial" />
                        <span className="text-body-sm text-muted-foreground">11 Nov 2026, 3:42 pm · Cashier Ali</span>
                    </>
                }
                actions={
                    <IconButton label="Print receipt" size="xs">
                        <FiPrinter />
                    </IconButton>
                }
                footerStart={<Button variant="destructive" onClick={() => setOpen('confirm')}>Cancel bill</Button>}
                footer={
                    <>
                        <Button variant="ghost" onClick={close}>Close</Button>
                        <Button>Take payment</Button>
                    </>
                }
            >
                <DrawerSection title="Summary">
                    <DetailList
                        rows={[
                            ['Total', <Money value={1250} />],
                            ['Paid', <Money value={800} />],
                            ['Due', <Money value={450} />],
                            ['Payment', 'Cash · Rs 800'],
                        ]}
                    />
                </DrawerSection>
                <DrawerSection title="Items">
                    <div className="flex flex-col gap-2 text-body">
                        {[['Mayo 500g', 2, 380], ['Bread large', 1, 240], ['Milk 1L', 2, 250]].map(([n, q, p]) => (
                            <div key={n} className="flex justify-between">
                                <span>{q} × {n}</span>
                                <Money value={q * p} />
                            </div>
                        ))}
                    </div>
                </DrawerSection>
            </Drawer>
        </>
    );
};

/** Stage 6 — the one DataTable, in each of its six states. */
const SAMPLE_BILLS = [
    { id: '1042', customer: 'Ali Traders', items: 3, total: 1250, paid: 800, status: 'partial', returns: false },
    { id: '1041', customer: '', items: 1, total: 240, paid: 240, status: 'paid', returns: false },
    { id: '1040', customer: 'Bilal Store', items: 7, total: 5400, paid: 5400, status: 'paid', returns: true },
    { id: '1039', customer: 'Sana', items: 2, total: 690.5, paid: 0, status: 'unpaid', returns: false },
    { id: '1038', customer: 'Ali Traders', items: 4, total: 1800, paid: 1800, status: 'paid', returns: false },
];
const TableLab = () => {
    const [view, setView] = useState('rows');
    const [q, setQ] = useState('');
    const [selected, setSelected] = useState('1042');
    const columns = [
        { id: 'id', header: 'Bill', accessorKey: 'id', meta: { mono: true }, cell: ({ getValue }) => `#${getValue()}` },
        { id: 'customer', header: 'Customer', accessorKey: 'customer', cell: ({ getValue }) => getValue() || <Dash /> },
        { id: 'items', header: 'Items', accessorKey: 'items', meta: { align: 'right' } },
        { id: 'total', header: 'Total', accessorKey: 'total', meta: { align: 'right' }, cell: ({ getValue }) => <Money value={getValue()} className="font-medium" /> },
        { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <StatusBadge kind="payment" value={getValue()} size="sm" /> },
        rowActions(() => [
            { label: 'View bill', icon: FiFileText, onSelect: () => toast('View') },
            { label: 'Reprint', icon: FiPrinter, onSelect: () => toast('Reprint') },
            { separator: true },
            { label: 'Cancel bill', icon: FiTrash2, danger: true, onSelect: () => toast('Cancel') },
        ]),
    ];
    const rows = view === 'rows' || view === 'loading' ? SAMPLE_BILLS.filter((b) => !q || `${b.id} ${b.customer}`.toLowerCase().includes(q.toLowerCase())) : view === 'noresults' ? [] : [];
    return (
        <Block title="Table" note="One table for every list: toolbar, mono header, 44px rows (row height menu), ⋯ actions, paging. Selected row = tint + accent bar; attention row (a bill with returns) = warning tint + bar.">
            <SegmentedControl
                label="Table state"
                size="xs"
                value={view}
                onChange={setView}
                options={[
                    { value: 'rows', label: 'Rows' },
                    { value: 'loading', label: 'Loading' },
                    { value: 'empty', label: 'Empty' },
                    { value: 'noresults', label: 'No results' },
                    { value: 'error', label: 'Error' },
                    { value: 'forbidden', label: 'No access' },
                ]}
            />
            <DataTable
                caption="Sample bills"
                data={rows}
                columns={columns}
                getRowId={(b) => b.id}
                search={{ value: q, onChange: setQ, placeholder: 'Search bill or customer' }}
                loading={view === 'loading'}
                isFiltered={view === 'noresults' || !!q}
                onClearFilters={() => {
                    setQ('');
                    setView('rows');
                }}
                error={view === 'error' ? { message: "The server didn't answer. Check the connection and try again.", onRetry: () => setView('rows'), requestId: 'req_8f2c41' } : null}
                forbidden={view === 'forbidden' ? 'Ask the shop admin for the Receipts permission.' : false}
                empty={{ title: 'No bills yet', description: 'Bills appear here as soon as the first sale is made.' }}
                onRowClick={(b) => setSelected(b.id)}
                rowLabel={(b) => `Bill ${b.id}`}
                rowTone={(b) => (b.id === selected ? 'selected' : b.returns ? 'attention' : null)}
                defaultPageSize={10}
                pageSizes={[3, 10, 25]}
            />
        </Block>
    );
};

/** Stage 7 — KPI tiles and charts. */
const HOURS = Array.from({ length: 14 }, (_, i) => {
    const h = i + 8;
    const label = h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
    const sales = [0, 1200, 2400, 1800, 5400, 7600, 4300, 3100, 2900, 6400, 9800, 25400, 8200, 0][i];
    return { label, sales, bills: Math.round(sales / 900) };
});
const ChartsLab = () => {
    const [measure, setMeasure] = useState('sales');
    const [state, setState] = useState('ok');
    const money = (v) => `PKR ${Number(v).toLocaleString()}`;
    const compact = (v) => (v >= 1000 ? `PKR ${+(v / 1000).toFixed(1)}K` : `PKR ${v}`);
    return (
        <Block title="KPI tiles and charts" note="A tile that opens a window is a button (chevron, hover wash). Charts use the six chart colours only — the first is the shop's accent. The current bar is solid, the rest a tint.">
            <KpiStrip cols={4}>
                <KpiCard label="Revenue" value="PKR 82,450" delta={{ value: 18.2, label: 'vs yesterday' }} onClick={() => toast('Opens the Sales window')} />
                <KpiCard label="Net profit" value="PKR 21,300" tone="success" note="26% margin" onClick={() => toast('Opens the Profit window')} />
                <KpiCard label="Orders" value="94" note="avg PKR 877" sparkline={<Sparkline data={HOURS} yKey="bills" />} />
                <KpiCard label="Costs" value="PKR 61,150" delta={{ value: 4.1, label: 'vs yesterday', goodWhen: 'down' }} />
            </KpiStrip>
            <Row label="Chart state">
                <SegmentedControl
                    label="Chart state"
                    size="xs"
                    value={state}
                    onChange={setState}
                    options={[
                        { value: 'ok', label: 'Data' },
                        { value: 'loading', label: 'Loading' },
                        { value: 'empty', label: 'Empty' },
                        { value: 'error', label: 'Error' },
                    ]}
                />
            </Row>
            <div className="grid gap-4 lg:grid-cols-3">
                <ChartPanel
                    className="lg:col-span-2"
                    title="By hour"
                    description="Peak: 7 PM – 8 PM, PKR 25,400, 28 bills"
                    loading={state === 'loading'}
                    error={state === 'error' ? 'The server did not answer.' : null}
                    onRetry={() => setState('ok')}
                    isEmpty={state === 'empty'}
                    empty={{ title: 'No sales on this day', description: 'Pick another date.' }}
                    controls={
                        <SegmentedControl
                            label="Measure"
                            size="xs"
                            value={measure}
                            onChange={setMeasure}
                            options={[
                                { value: 'sales', label: 'Sales' },
                                { value: 'bills', label: 'Bills' },
                            ]}
                        />
                    }
                    table={{
                        filename: 'by-hour',
                        columns: [
                            { key: 'label', label: 'Hour' },
                            { key: 'bills', label: 'Bills', align: 'right' },
                            { key: 'sales', label: 'Sales', align: 'right', format: money },
                        ],
                        rows: HOURS,
                        totals: { bills: HOURS.reduce((a, d) => a + d.bills, 0), sales: HOURS.reduce((a, d) => a + d.sales, 0) },
                    }}
                >
                    <BarChart data={HOURS} yKey={measure} highlight="7 PM" format={measure === 'sales' ? compact : (v) => v} tooltipRows={(d) => [['Sales', money(d.sales)], ['Bills', d.bills]]} />
                </ChartPanel>
                <ChartPanel title="Payment methods" description="Money taken today">
                    <DonutChart
                        format={money}
                        height={130}
                        data={[
                            { label: 'Cash', value: 51200, count: 61 },
                            { label: 'Card', value: 18300, count: 14 },
                            { label: 'JazzCash', value: 9400, count: 12 },
                            { label: 'Bank transfer', value: 3550, count: 2 },
                        ]}
                    />
                </ChartPanel>
                <ChartPanel title="Trend" description="Last 14 hours">
                    <AreaChart data={HOURS} yKey="sales" format={compact} height={180} />
                </ChartPanel>
                <ChartPanel title="Sales by cashier" description="Click a name to open the employee">
                    <HorizontalBarChart
                        format={money}
                        onSelect={(d) => toast(d.label)}
                        data={[
                            { label: 'Ali', value: 48200, note: '52 bills' },
                            { label: 'Sana', value: 26100, note: '31 bills' },
                            { label: 'Counter One', value: 8150, note: '11 bills' },
                        ]}
                    />
                </ChartPanel>
                <section className="rounded-2xl border border-hairline bg-card shadow-1 p-4">
                    <KpiStrip cols={2} className="gap-y-4">
                        <Stat label="Biggest bill" value="PKR 9,850" note="#1042 · 7:41 PM" />
                        <Stat label="Average bill" value="PKR 877" delta={{ value: -3.2, label: 'vs yesterday' }} />
                        <Stat label="First bill" value="8:12 AM" />
                        <Stat label="Last bill" value="10:56 PM" />
                    </KpiStrip>
                </section>
            </div>
        </Block>
    );
};

const MODE_ICON = { light: FiSun, dark: FiMoon, system: FiMonitor };

const DesignLab = () => {
    const { mode, setMode, accent, setPreviewAccent } = useTheme();
    const [search, setSearch] = useState('Mayo');
    const [period, setPeriod] = useState('today');
    const [method, setMethod] = useState('cash');
    const [on, setOn] = useState(true);
    const [off, setOff] = useState(false);
    const [checks, setChecks] = useState({ a: true, b: false });

    // Leave the preview when the page closes
    useEffect(() => () => setPreviewAccent(null), [setPreviewAccent]);

    return (
        <div className="p-[22px] flex flex-col gap-5 max-w-[1180px] mx-auto">
            {/* Page header (the real PageHeader band arrives in Stage 5) */}
            <div className="rounded-2xl border border-hairline bg-surface-tint px-[22px] py-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="font-mono text-overline-lg uppercase text-muted-foreground">Design system · Stages 3–7</p>
                    <h1 className="font-heading text-h2 text-foreground">Design Lab</h1>
                    <p className="mt-1 max-w-[78ch] text-body text-muted-foreground">
                        Every building block in every state. Switch theme and accent here to check both — the accent switch only previews and saves nothing.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <SegmentedControl
                        label="Theme"
                        value={mode}
                        onChange={setMode}
                        options={MODES.map((m) => ({ value: m.id, label: m.label, icon: MODE_ICON[m.id] }))}
                    />
                    <div role="radiogroup" aria-label="Preview accent" className="flex gap-1.5">
                        {ACCENTS.map((a) => (
                            <button
                                key={a.id}
                                type="button"
                                role="radio"
                                aria-checked={accent === a.id}
                                aria-label={a.label}
                                title={a.label}
                                onClick={() => setPreviewAccent(a.id)}
                                className={`w-7 h-7 rounded-full border-2 ${accent === a.id ? 'border-foreground' : 'border-transparent'}`}
                                style={{ background: a.swatch }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <Block title="Buttons" note="One primary per view. Outline for secondary actions, ghost for quiet ones, red only on the destructive action itself.">
                <Row label="Variants">
                    <Button>Save</Button>
                    <Button variant="outline">Cancel</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Delete</Button>
                    <Button variant="warning">Override</Button>
                    <Button variant="link">Open the ledger</Button>
                </Row>
                <Row label="With icons">
                    <Button><FiPlus aria-hidden="true" />Add product</Button>
                    <Button variant="outline"><FiDownload aria-hidden="true" />Export</Button>
                    <Button variant="outline"><FiPrinter aria-hidden="true" />Print</Button>
                    <Button variant="destructive"><FiTrash2 aria-hidden="true" />Cancel bill</Button>
                </Row>
                <Row label="Sizes — 32 xs · 36 default · 40 action · 44 touch">
                    <Button size="xs">Extra small</Button>
                    <Button>Default</Button>
                    <Button size="action">Action</Button>
                    <Button size="touch">Touch (checkout)</Button>
                </Row>
                <Row label="States">
                    <Button loading>Saving</Button>
                    <Button disabled>Disabled</Button>
                    <Button variant="outline" loading>Loading</Button>
                    <Button variant="outline" disabled>Disabled</Button>
                </Row>
                <Row label="Icon buttons (label = tooltip + screen reader)">
                    <IconButton label="Refresh"><FiRefreshCw /></IconButton>
                    <IconButton label="Print" variant="outline"><FiPrinter /></IconButton>
                    <IconButton label="More actions" size="xs"><FiMoreHorizontal /></IconButton>
                    <IconButton label="Delete" variant="destructive"><FiTrash2 /></IconButton>
                    <IconButton label="Working" loading variant="outline"><FiRefreshCw /></IconButton>
                </Row>
            </Block>

            <Block title="Inputs" note="Same heights as buttons so a toolbar lines up. Placeholder lighter than typed text. Errors in words, not only red.">
                <Row label="A toolbar row (36px)">
                    <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} placeholder="Search products" className="w-64" />
                    <Select className="w-44" defaultValue="all">
                        <option value="all">All categories</option>
                        <option value="drinks">Drinks</option>
                    </Select>
                    <Input className="w-40" placeholder="Barcode" mono />
                    <Button variant="outline"><FiDownload aria-hidden="true" />Export</Button>
                    <Button><FiPlus aria-hidden="true" />Add</Button>
                </Row>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Product name" required hint="As it prints on the receipt">
                        <Input placeholder="e.g. Mayo 500g" />
                    </Field>
                    <Field label="Price" error="Price must be more than the cost (PKR 400)">
                        <Input defaultValue="150" inputMode="decimal" />
                    </Field>
                    <Field label="Category" optional>
                        <Select defaultValue="">
                            <option value="" disabled>Choose…</option>
                            <option>General</option>
                            <option>Drinks</option>
                        </Select>
                    </Field>
                    <Field label="Bill number">
                        <Input defaultValue="#161" readOnly mono /> {/* design-ok: a bill number */}
                    </Field>
                    <Field label="Disabled">
                        <Input placeholder="Not editable" disabled />
                    </Field>
                    <Field label="Tinted / filled variants">
                        <div className="flex gap-2">
                            <Input variant="tinted" placeholder="Tinted" />
                            <Input variant="filled" placeholder="Filled" />
                        </div>
                    </Field>
                </div>
                <Field label="Note" hint="Shown on the bill">
                    <Textarea placeholder="Anything the customer should know" />
                </Field>
            </Block>

            <Block title="Choices" note="Checkboxes and switches have a 44px click area. Segmented controls replace hand-made period and method pickers.">
                <Row label="Segmented — pills (period, theme)">
                    <SegmentedControl
                        label="Period"
                        value={period}
                        onChange={setPeriod}
                        options={[
                            { value: 'today', label: 'Today' },
                            { value: 'week', label: 'Week' },
                            { value: 'month', label: 'Month' },
                            { value: 'custom', label: 'Custom' },
                        ]}
                    />
                </Row>
                <Row label="Segmented — buttons (payment method, touch size)">
                    <SegmentedControl
                        label="Payment method"
                        appearance="buttons"
                        size="touch"
                        value={method}
                        onChange={setMethod}
                        options={[
                            { value: 'cash', label: 'Cash', icon: FiDollarSign },
                            { value: 'card', label: 'Card', icon: FiCreditCard },
                            { value: 'online', label: 'Online', icon: FiSmartphone },
                        ]}
                    />
                </Row>
                <Row label="Switches">
                    <Switch label="Auto print" checked={on} onChange={setOn} />
                    <Switch label="Sell below cost" checked={off} onChange={setOff} />
                    <Switch label="Small on" size="xs" checked={on} onChange={setOn} />
                    <Switch label="Disabled" checked disabled onChange={() => {}} />
                </Row>
                <Row label="Checkboxes">
                    <Checkbox label="Include cancelled bills" checked={checks.a} onChange={(v) => setChecks((c) => ({ ...c, a: v }))} />
                    <Checkbox label="Only with returns" description="Bills where something came back" checked={checks.b} onChange={(v) => setChecks((c) => ({ ...c, b: v }))} />
                    <Checkbox label="Some selected" indeterminate onChange={() => {}} />
                    <Checkbox label="Disabled" disabled onChange={() => {}} />
                </Row>
            </Block>

            <Block title="Status chips" note="One mapping for the whole app (src/utils/statusTones.js): a word, a tint and usually an icon — never colour alone.">
                {['bill', 'payment', 'return', 'expense', 'cheque', 'stock', 'active'].map((kind) => (
                    <Row key={kind} label={kind}>
                        {Object.keys(STATUS[kind]).map((v) => (
                            <StatusBadge key={v} kind={kind} value={v} />
                        ))}
                    </Row>
                ))}
                <Row label="Money Book entry types — tag shape">
                    {Object.keys(STATUS.entry).map((v) => (
                        <StatusBadge key={v} kind="entry" value={v} shape="tag" />
                    ))}
                </Row>
                <Row label="Sizes and the dot shape">
                    <StatusChip tone="success" icon={FiCheck} label="md" />
                    <StatusChip tone="success" icon={FiCheck} label="sm" size="sm" />
                    <StatusChip tone="success" icon={FiCheck} label="xs" size="xs" />
                    <StatusChip tone="accent" label="Accent" />
                    <StatusChip tone="info" label="Info" />
                    <StatusChip tone="success" shape="dot" label="Live" />
                    <StatusChip tone="destructive" shape="dot" label="Offline" />
                </Row>
            </Block>

            <div className="grid gap-5 lg:grid-cols-2">
                <Block title="Cards" note="16px corners, a half-strength edge and a quiet shadow. The full border colour is for controls only.">
                    <Card>
                        <CardTitle>Plain card</CardTitle>
                        <CardDescription>16px padding, 12px gap.</CardDescription>
                    </Card>
                    <InsetCard>
                        <p className="text-body text-foreground">Inset card — a block inside a card.</p>
                    </InsetCard>
                </Block>
                <SectionCard
                    title="Section card"
                    description="Title, description, actions and an optional footer bar."
                    actions={<Button variant="outline" size="xs"><FiDownload aria-hidden="true" />Export</Button>}
                    footer={
                        <>
                            <Button variant="outline">Cancel</Button>
                            <Button>Save</Button>
                        </>
                    }
                >
                    <p className="text-body text-muted-foreground">Body text sits on the card at 13px. The footer bar holds the actions, primary last on the right.</p>
                </SectionCard>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <Block title="Money" note="Shop currency, even-width digits; whole amounts without decimals, others with two; negative in red with a real minus.">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-body">
                        <span className="text-muted-foreground">Whole</span><Money value={1250} className="text-right" />
                        <span className="text-muted-foreground">Decimals</span><Money value={74832.56} className="text-right" />
                        <span className="text-muted-foreground">Negative</span><Money value={-50} className="text-right" />
                        <span className="text-muted-foreground">Signed (in / out)</span>
                        <span className="text-right space-x-3"><Money value={300} signed tone="auto" /><Money value={-120} signed tone="auto" /></span>
                        <span className="text-muted-foreground">Missing</span><Money value={null} className="text-right" />
                        <span className="text-muted-foreground">Big figure</span><Money value={123732.56} className="font-heading text-h2 text-right" />
                    </div>
                </Block>
                <Block title="Loading" note="Skeletons where content will appear; a spinner for a short wait; the bar for open-ended work.">
                    <Row label="Spinner">
                        <Spinner size="sm" /> <Spinner /> <Spinner size="lg" />
                    </Row>
                    <Row label="Skeleton">
                        <div className="flex w-full flex-col gap-2">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-9 w-full" />
                        </div>
                    </Row>
                    <Row label="Indeterminate bar">
                        <IndeterminateBar />
                    </Row>
                </Block>
            </div>

            <Block title="Empty, error and no-access states" note="Every list has them. A screen with no data shows its empty state, never fake rows.">
                <div className="grid gap-4 lg:grid-cols-2">
                    <InsetCard className="p-0">
                        <EmptyState
                            icon={FiPackage}
                            title="No products yet"
                            actions={<Button size="xs"><FiPlus aria-hidden="true" />Add product</Button>}
                        >
                            Add your first product, or import a list from a spreadsheet.
                        </EmptyState>
                    </InsetCard>
                    <InsetCard className="p-0">
                        <NoResults onClear={() => setSearch('')} />
                    </InsetCard>
                </div>
                <EmptyState size="sm" title="No payments">This bill hasn't been paid yet.</EmptyState>
                <StateCard kind="error" onRetry={() => {}} requestId="req_8f2c41">The server didn't answer. Check the connection and try again.</StateCard>
                <StateCard kind="forbidden">Ask the shop admin for the Money Book permission.</StateCard>
                <StateCard kind="loading" />
            </Block>

            <OverlaysLab />
            <TableLab />
            <ChartsLab />
        </div>
    );
};

export default DesignLab;
