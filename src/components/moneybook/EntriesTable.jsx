import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiInbox, FiDownload, FiCornerUpLeft } from 'react-icons/fi';
import { getMoneyEntries } from '../../services/api/moneyBook';
import { entryTypeLabel, localDayKey, apiErrorMessage } from '../../utils/moneyBook';
import { getStatus } from '../../utils/statusTones';
import { Pager } from './ui';
import {
    cn,
    Button,
    IconButton,
    Select,
    SearchInput,
    Skeleton,
    StatusBadge,
    StatusChip,
    StateCard,
    EmptyState,
    NoResults,
    TableToolbar,
    FilterButton,
    DateRangeFields,
    rangeLabel,
    Field,
    TABLE_CARD,
    TABLE_HEAD_ROW,
    TABLE_TH,
    TABLE_ROW,
    TABLE_TD,
    TABLE_GROUP_ROW,
    TABLE_GROUP_TD,
    TABLE_SCROLL,
    TableScroll,
    skeletonRowsFor,
} from '../ui';

const TYPE_FILTERS = [
    'opening_balance', 'manual_deposit', 'manual_withdrawal', 'sale_collection', 'sale_cancel',
    'customer_refund', 'refund_reversal', 'vendor_payment', 'expense', 'expense_reversal',
    'transfer_out', 'transfer_in', 'transfer_fee', 'adjustment',
];

/**
 * Ledger of one account (or `all`), grouped by the local day the money moved
 * (effectiveDate). Day opening/closing come from the server's dailySummary
 * (every entry of the day, not just this page). The Balance column is hidden
 * when the server sends balanceAfter = null (filtered list).
 */
const EntriesTable = ({ account = 'all', fmt, reloadKey, canTransfer, onReverseTransfer, accountName }) => {
    const [entries, setEntries] = useState([]);
    const [dailySummary, setDailySummary] = useState([]);
    const [rangeSummary, setRangeSummary] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [type, setType] = useState('all');
    const [direction, setDirection] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');

    // Debounce the server-side search
    useEffect(() => {
        const t = setTimeout(() => setQ(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    const fetchPage = useCallback(async (page = 1) => {
        setLoading(true);
        setError('');
        try {
            const params = { account, page, limit: 50 };
            if (type !== 'all') params.type = type;
            if (direction !== 'all') params.direction = direction;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (q) params.q = q;
            const res = await getMoneyEntries(params);
            setEntries(res.data?.entries || []);
            setDailySummary(res.data?.dailySummary || []);
            setRangeSummary(res.data?.rangeSummary || null);
            setPagination(res.data?.pagination || { page: 1, pages: 1, total: 0 });
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load entries'));
        } finally {
            setLoading(false);
        }
    }, [account, type, direction, startDate, endDate, q]);

    useEffect(() => {
        fetchPage(1);
    }, [fetchPage, reloadKey]);

    const isAll = account === 'all';
    const filtered = type !== 'all' || direction !== 'all' || !!q;
    const showBalance = entries.length > 0 && entries.every((e) => e.balanceAfter !== null && e.balanceAfter !== undefined);

    const groups = useMemo(() => {
        const byKey = new Map(dailySummary.map((d) => [d.date, d]));
        const out = [];
        for (const e of entries) {
            const when = e.effectiveDate || e.createdAt;
            const key = localDayKey(when);
            let g = out[out.length - 1];
            if (!g || g.key !== key) {
                g = { key, date: new Date(when), entries: [], summary: byKey.get(key) || null };
                out.push(g);
            }
            g.entries.push(e);
        }
        return out;
    }, [entries, dailySummary]);

    const colCount = 6 + (isAll ? 1 : 0) + (showBalance ? 1 : 0);
    const labelSpan = colCount - (showBalance ? 3 : 2);

    const downloadCsv = () => {
        const esc = (v) => (v == null ? '' : String(v).replace(/"/g, '""'));
        const rows = [
            ['Money Book', accountName || (isAll ? 'All accounts' : '')],
            ['Generated', new Date().toLocaleString()],
            [],
            ['Entry #', 'Date', 'Time', 'Account', 'Type', 'Description', 'Reference', 'In', 'Out', ...(showBalance ? ['Balance'] : []), 'By', 'Note'],
            ...entries.map((e) => {
                const d = new Date(e.effectiveDate || e.createdAt);
                return [
                    e.entryNumber, d.toLocaleDateString(), d.toLocaleTimeString(), e.account?.name, entryTypeLabel(e.type),
                    e.description, e.referenceNumber, e.direction === 'in' ? e.amount : '', e.direction === 'out' ? e.amount : '',
                    ...(showBalance ? [e.balanceAfter] : []), e.performedBy, e.note,
                ];
            }),
        ];
        const csv = rows.map((r) => r.map((c) => `"${esc(c)}"`).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `money-book-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const clearFilters = () => {
        setType('all');
        setDirection('all');
        setStartDate('');
        setEndDate('');
        setSearch('');
    };

    const money = (v, cls = '') => <span className={cn('tabular-nums', (Number(v) || 0) < 0 && 'text-destructive', cls)}>{fmt(v)}</span>;
    const R = 'text-right tabular-nums';

    return (
        <div>
            {/* Range summary */}
            {rangeSummary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    {[
                        ['Opening', rangeSummary.openingBalance],
                        ['Money in', rangeSummary.totalIn, 'text-success'],
                        ['Money out', rangeSummary.totalOut, 'text-destructive'],
                        ['Net', rangeSummary.net],
                        ['Closing', rangeSummary.closingBalance],
                    ].map(([label, v, cls]) => (
                        <div key={label} className="bg-card border border-hairline rounded-xl px-4 py-3">
                            <p className="font-mono text-overline-lg uppercase text-muted-foreground">{label}</p>
                            <p className="mt-0.5 font-heading text-h4">{money(v, cls)}</p>
                        </div>
                    ))}
                    {rangeSummary.type && (
                        <p className="col-span-2 md:col-span-5 text-body-sm text-muted-foreground">
                            {entryTypeLabel(rangeSummary.type.type)}: {rangeSummary.type.entryCount} entries · in {fmt(rangeSummary.type.totalIn)} · out {fmt(rangeSummary.type.totalOut)}
                        </p>
                    )}
                </div>
            )}

            <section className={TABLE_CARD} aria-label="Money Book entries">
                <TableToolbar>
                    <SearchInput
                        className="w-full sm:w-[260px]"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onClear={() => setSearch('')}
                        placeholder="Reference or description"
                        aria-label="Search reference or description"
                    />
                    <FilterButton
                        label="Filter entries"
                        summary={[
                            rangeLabel({ from: startDate, to: endDate }),
                            type !== 'all' && entryTypeLabel(type),
                            direction !== 'all' && (direction === 'in' ? 'Money in' : 'Money out'),
                        ].filter(Boolean).join(' · ')}
                        count={(type !== 'all') + (direction !== 'all')}
                        onReset={() => {
                            setType('all');
                            setDirection('all');
                            setStartDate('');
                            setEndDate('');
                        }}
                    >
                        <DateRangeFields
                            value={{ from: startDate, to: endDate }}
                            onChange={(r) => {
                                setStartDate(r.from);
                                setEndDate(r.to);
                            }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Type">
                                <Select value={type} onChange={(e) => setType(e.target.value)}>
                                    <option value="all">All types</option>
                                    {TYPE_FILTERS.map((t) => (
                                        <option key={t} value={t}>
                                            {entryTypeLabel(t)}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="In / out">
                                <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
                                    <option value="all">In &amp; out</option>
                                    <option value="in">Money in</option>
                                    <option value="out">Money out</option>
                                </Select>
                            </Field>
                        </div>
                    </FilterButton>
                    {(filtered || startDate || endDate) && (
                        <Button variant="ghost" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                    <div className="ml-auto">
                        <IconButton label="Download CSV" variant="outline" onClick={downloadCsv}>
                            <FiDownload />
                        </IconButton>
                    </div>
                </TableToolbar>

                {error ? (
                    <div className="border-t border-hairline p-3">
                        <StateCard kind="error" onRetry={() => fetchPage(pagination.page || 1)}>
                            {error}
                        </StateCard>
                    </div>
                ) : !loading && entries.length === 0 ? (
                    <div className="border-t border-hairline">
                        {filtered || startDate || endDate ? (
                            <NoResults onClear={clearFilters} />
                        ) : (
                            <EmptyState icon={FiInbox} title="No entries">
                                Money movements will appear here.
                            </EmptyState>
                        )}
                    </div>
                ) : (
                    <TableScroll>
                        {filtered && (
                            <p className="px-4 py-2 text-body-sm text-muted-foreground bg-muted/40 border-t border-hairline">
                                Filtered list: running balance hidden. Day opening / closing still count every entry.
                            </p>
                        )}
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className={TABLE_HEAD_ROW}>
                                    <th className={TABLE_TH}>#</th>
                                    <th className={TABLE_TH}>Time</th>
                                    {isAll && <th className={TABLE_TH}>Account</th>}
                                    <th className={TABLE_TH}>Type</th>
                                    <th className={TABLE_TH}>Description</th>
                                    <th className={cn(TABLE_TH, 'text-right')}>In</th>
                                    <th className={cn(TABLE_TH, 'text-right')}>Out</th>
                                    {showBalance && <th className={cn(TABLE_TH, 'text-right')}>Balance</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {loading
                                    ? Array.from({ length: skeletonRowsFor(window.innerHeight - 380) }).map((_, i) => (
                                          <tr key={`sk-${i}`} className={TABLE_ROW}>
                                              {Array.from({ length: colCount }).map((__, j) => (
                                                  <td key={j} className={TABLE_TD}>
                                                      <Skeleton className={cn('h-3.5', j === 4 ? 'w-48' : 'w-14')} />
                                                  </td>
                                              ))}
                                          </tr>
                                      ))
                                    : groups.map((g) => (
                                          <React.Fragment key={g.key}>
                                              <tr className={TABLE_GROUP_ROW}>
                                                  <td colSpan={labelSpan} className={cn(TABLE_GROUP_TD, 'font-semibold text-foreground text-body')}>
                                                      {g.date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                  </td>
                                                  {g.summary ? (
                                                      <>
                                                          <td colSpan={showBalance ? 2 : 1} className={cn(TABLE_GROUP_TD, 'text-right')}>
                                                              Opening
                                                          </td>
                                                          <td className={cn(TABLE_GROUP_TD, R, 'font-semibold text-foreground')}>{money(g.summary.openingBalance)}</td>
                                                      </>
                                                  ) : (
                                                      <td colSpan={showBalance ? 3 : 2} className={TABLE_GROUP_TD} />
                                                  )}
                                              </tr>
                                              {g.entries.map((e) => {
                                                  const d = new Date(e.effectiveDate || e.createdAt);
                                                  const isTransferLeg = e.type === 'transfer_out' || e.type === 'transfer_in';
                                                  const pendingCheque = e.chequeStatus === 'pending';
                                                  const st = getStatus('entry', e.type);
                                                  return (
                                                      <tr key={e._id} className={TABLE_ROW}>
                                                          <td className={cn(TABLE_TD, 'font-mono text-mono-sm text-muted-foreground')}>{e.entryNumber}</td>
                                                          <td className={cn(TABLE_TD, 'text-muted-foreground whitespace-nowrap')}>{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
                                                          {isAll && (
                                                              <td className={TABLE_TD}>
                                                                  {e.account?.name ? <StatusChip size="sm" shape="tag" tone="neutral" label={e.account.name} /> : '—'}
                                                              </td>
                                                          )}
                                                          <td className={TABLE_TD}>
                                                              <div className="flex flex-wrap items-center gap-1">
                                                                  <StatusChip size="sm" shape="tag" tone={st?.tone || 'neutral'} icon={st?.icon} label={entryTypeLabel(e.type)} />
                                                                  {e.chequeStatus && <StatusBadge kind="cheque" value={e.chequeStatus} size="xs" shape="tag" />}
                                                              </div>
                                                          </td>
                                                          <td className={cn(TABLE_TD, 'py-2')}>
                                                              <p>{e.description}</p>
                                                              {isTransferLeg && e.counterAccount?.name && (
                                                                  <p className="text-body-sm text-primary">
                                                                      {e.type === 'transfer_out' ? `→ To: ${e.counterAccount.name}` : `← From: ${e.counterAccount.name}`}
                                                                  </p>
                                                              )}
                                                              {e.referenceNumber && e.referenceNumber !== e.description && (
                                                                  <p className="font-mono text-mono-xs text-muted-foreground">{e.referenceNumber}</p>
                                                              )}
                                                              {e.type === 'adjustment' && e.reason && <p className="text-body-sm text-muted-foreground">Reason: {e.reason}</p>}
                                                              {e.note && <p className="text-body-sm text-muted-foreground italic">{e.note}</p>}
                                                              <p className="text-body-sm text-muted-foreground">
                                                                  {e.performedBy ? `by ${e.performedBy}` : ''}
                                                                  {canTransfer && isTransferLeg && e.transferId && !e.reversalOf && (
                                                                      <button
                                                                          type="button"
                                                                          onClick={() => onReverseTransfer?.(e)}
                                                                          className="ml-2 inline-flex items-center gap-1 text-primary hover:underline print:hidden"
                                                                      >
                                                                          <FiCornerUpLeft size={11} aria-hidden="true" /> Reverse
                                                                      </button>
                                                                  )}
                                                              </p>
                                                          </td>
                                                          <td className={cn(TABLE_TD, R, 'text-success font-medium', pendingCheque && 'opacity-50')}>{e.direction === 'in' ? fmt(e.amount) : ''}</td>
                                                          <td className={cn(TABLE_TD, R, 'text-destructive font-medium', pendingCheque && 'opacity-50')}>{e.direction === 'out' ? fmt(e.amount) : ''}</td>
                                                          {showBalance && <td className={cn(TABLE_TD, R, 'font-semibold')}>{money(e.balanceAfter)}</td>}
                                                      </tr>
                                                  );
                                              })}
                                              {g.summary && (
                                                  <tr className={cn(TABLE_GROUP_ROW, 'shadow-[inset_0_-1px_0_var(--border)]')}>
                                                      <td colSpan={labelSpan} className={TABLE_GROUP_TD}>
                                                          {g.summary.entryCount} entries · in {fmt(g.summary.totalIn)} · out {fmt(g.summary.totalOut)}
                                                      </td>
                                                      <td colSpan={showBalance ? 2 : 1} className={cn(TABLE_GROUP_TD, 'text-right font-semibold text-foreground')}>
                                                          Closing
                                                      </td>
                                                      <td className={cn(TABLE_GROUP_TD, R, 'font-semibold text-foreground')}>{money(g.summary.closingBalance)}</td>
                                                  </tr>
                                              )}
                                          </React.Fragment>
                                      ))}
                            </tbody>
                        </table>
                    </TableScroll>
                )}
                <Pager pagination={pagination} onPage={fetchPage} />
            </section>
        </div>
    );
};

export default EntriesTable;
