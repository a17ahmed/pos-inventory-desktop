import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { useBusiness } from '../context/BusinessContext';
import { getClosing } from '../services/api/closing';
import ClosingReport from '../components/ClosingReport';
import { FiArrowLeft, FiDownload, FiAlertCircle } from 'react-icons/fi';

const ClosingDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { business } = useBusiness();

    const [closing, setClosing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await getClosing(id);
                setClosing(res.data);
            } catch (err) {
                console.error('Error fetching closing:', err);
                setError(err.response?.data?.message || 'Failed to load closing');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const currency = business?.currency || 'Rs.';
    const fmt = (amount) =>
        `${currency} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const varianceLabel = (v) => {
        if (v == null) return '—';
        if (v === 0) return 'Exact match';
        return v < 0 ? `Short by ${fmt(Math.abs(v))}` : `Over by ${fmt(Math.abs(v))}`;
    };

    const TENDER_PDF_META = {
        cash: { label: 'Cash', expectedLabel: 'Expected (drawer, all-time)' },
        card: { label: 'Card', expectedLabel: 'Expected (this period)' },
        online: { label: 'Online / UPI', expectedLabel: 'Expected (this period)' },
    };

    const buildTenderRowsHtml = (tenderReconciliation = {}) => {
        return ['cash', 'card', 'online'].map((key) => {
            const meta = TENDER_PDF_META[key];
            const t = tenderReconciliation[key] || { expected: 0, counted: null, variance: null, reconciled: null };
            const bg = t.reconciled === true ? '#ecfdf5' : t.reconciled === false ? '#fef2f2' : '#f8fafc';
            const border = t.reconciled === true ? '#a7f3d0' : t.reconciled === false ? '#fecaca' : '#e2e8f0';
            const statusColor = t.reconciled === true ? '#047857' : t.reconciled === false ? '#b91c1c' : '#64748b';
            const statusLabel = t.reconciled === true ? 'Matches' : t.reconciled === false ? varianceLabel(t.variance) : 'Not checked';
            return `
            <div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:10px 14px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <div style="font-size:12px;font-weight:800;">${meta.label}</div>
                    <div style="font-size:11px;font-weight:700;color:${statusColor};">${statusLabel}</div>
                </div>
                <div style="display:flex;gap:10px;">
                    <div style="flex:1;background:#fff;border-radius:6px;padding:6px 10px;">
                        <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;">${meta.expectedLabel}</div>
                        <div style="font-size:13px;font-weight:700;">${fmt(t.expected)}</div>
                    </div>
                    <div style="flex:1;background:#fff;border-radius:6px;padding:6px 10px;">
                        <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;">Counted</div>
                        <div style="font-size:13px;font-weight:700;">${t.counted != null ? fmt(t.counted) : '—'}</div>
                    </div>
                    <div style="flex:1;background:#fff;border-radius:6px;padding:6px 10px;">
                        <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;">Variance</div>
                        <div style="font-size:13px;font-weight:700;color:${statusColor};">${t.variance != null ? fmt(t.variance) : '—'}</div>
                    </div>
                </div>
            </div>`;
        }).join('');
    };

    const downloadPdf = () => {
        if (!closing) return;

        const billRows = (closing.bills || []).map((b) => {
            const itemRows = (b.items || []).map((it, i) => {
                const lineProfit = it.lineProfit ?? ((it.price || 0) - (it.costPrice || 0)) * (it.qty || 0);
                return `<tr>
                    <td style="padding:5px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;">${i + 1}. ${it.name}</td>
                    <td style="padding:5px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;text-align:center;">× ${it.qty}</td>
                    <td style="padding:5px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmt(it.price)}</td>
                    <td style="padding:5px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmt(it.costPrice)}</td>
                    <td style="padding:5px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;">${fmt(lineProfit)}</td>
                </tr>`;
            }).join('');

            return `
            <div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;page-break-inside:avoid;">
                <div style="background:#f8fafc;padding:6px 10px;display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px;font-weight:700;">Bill #${b.billNumber} <span style="font-weight:400;color:#64748b;">— ${b.customerName || 'Walk-in'} — ${new Date(b.date).toLocaleString()}</span></div>
                    <div style="font-size:10px;font-weight:700;">${fmt(b.billTotal)} <span style="font-weight:400;color:#64748b;">(${(b.paymentMethod || '').toUpperCase()})</span></div>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    <thead><tr style="background:#fff;">
                        <th style="padding:4px 8px;font-size:9px;text-align:left;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;">Item</th>
                        <th style="padding:4px 8px;font-size:9px;text-align:center;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;">Qty</th>
                        <th style="padding:4px 8px;font-size:9px;text-align:right;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;">Price</th>
                        <th style="padding:4px 8px;font-size:9px;text-align:right;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;">Cost</th>
                        <th style="padding:4px 8px;font-size:9px;text-align:right;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;">Profit</th>
                    </tr></thead>
                    <tbody>${itemRows}</tbody>
                </table>
            </div>`;
        }).join('');

        const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;padding:20px 24px;color:#1e293b;background:#fff;width:100%;">
            <div style="text-align:center;margin-bottom:12px;">
                <div style="font-size:13px;font-weight:800;letter-spacing:0.08em;color:#0f172a;">DESKTOP POS</div>
                <div style="font-size:9px;color:#94a3b8;margin-top:2px;">
                    Software by Ahmed Irfan &nbsp;•&nbsp; Phone: +923070019031 &nbsp;•&nbsp; WhatsApp: https://wa.me/923070019031
                </div>
            </div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:14px;" />

            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                <div>
                    <h1 style="margin:0;font-size:22px;font-weight:700;">Closing #${closing.closingNumber}</h1>
                    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">
                        ${new Date(closing.periodStart).toLocaleString()} — ${new Date(closing.periodEnd).toLocaleString()}
                    </p>
                    <p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">
                        Closed by ${closing.closedBy?.name || '—'} on ${new Date(closing.closedAt).toLocaleString()}
                    </p>
                </div>
                ${business?.name ? `<div style="text-align:right;"><div style="font-size:14px;font-weight:700;">${business.name}</div>${business.phone ? `<div style="font-size:11px;color:#64748b;">${business.phone}</div>` : ''}</div>` : ''}
            </div>

            ${closing.countedNote ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:11px;"><strong>Note:</strong> ${closing.countedNote}</div>` : ''}

            <!-- Tender Reconciliation — the real check, per verifiable tender -->
            <div style="margin-bottom:12px;">
                ${buildTenderRowsHtml(closing.tenderReconciliation)}
            </div>

            <!-- Sales math check — secondary, algebraically forced, can't catch shrinkage -->
            <div style="display:flex;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px;margin-bottom:16px;font-size:10px;color:#64748b;">
                <span>Sales Math Check</span>
                <span>Cost+Profit: ${fmt(closing.costPlusProfit)} &nbsp;|&nbsp; Settlement: ${fmt(closing.settlementTotal)} &nbsp;|&nbsp; ${closing.reconciled ? '<span style="color:#047857;">&#10003; Matches</span>' : `<span style="color:#b91c1c;">&#10007; ${fmt(closing.reconciliationDifference)} off</span>`}</span>
            </div>

            <!-- Sales & Profit + Settlement -->
            <div style="display:flex;gap:12px;margin-bottom:16px;">
                <table style="flex:1;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;">
                    <tr style="background:#f1f5f9;"><td colspan="2" style="padding:8px;font-size:11px;font-weight:700;text-transform:uppercase;">Sales &amp; Profit</td></tr>
                    <tr><td style="padding:6px 10px;font-size:11px;color:#64748b;">Gross Sales</td><td style="padding:6px 10px;font-size:11px;text-align:right;">${fmt(closing.grossSales)}</td></tr>
                    <tr><td style="padding:6px 10px;font-size:11px;color:#64748b;">Discounts</td><td style="padding:6px 10px;font-size:11px;text-align:right;color:#ef4444;">− ${fmt(closing.totalDiscounts)}</td></tr>
                    <tr><td style="padding:6px 10px;font-size:11px;color:#64748b;">Returns</td><td style="padding:6px 10px;font-size:11px;text-align:right;color:#ef4444;">− ${fmt(closing.totalReturns)}</td></tr>
                    <tr style="background:#f8fafc;"><td style="padding:6px 10px;font-size:11px;font-weight:700;">Net Sales</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-weight:700;">${fmt(closing.netSales)}</td></tr>
                    <tr><td style="padding:6px 10px;font-size:11px;color:#64748b;">COGS</td><td style="padding:6px 10px;font-size:11px;text-align:right;color:#ef4444;">− ${fmt(closing.cogs)}</td></tr>
                    <tr style="background:#f8fafc;"><td style="padding:6px 10px;font-size:11px;font-weight:700;">Gross Profit</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-weight:700;">${fmt(closing.grossProfit)}</td></tr>
                    <tr><td style="padding:6px 10px;font-size:11px;color:#64748b;">Expenses</td><td style="padding:6px 10px;font-size:11px;text-align:right;color:#ef4444;">− ${fmt(closing.totalExpenses)}</td></tr>
                    <tr style="background:#ecfdf5;"><td style="padding:6px 10px;font-size:12px;font-weight:800;">Net Profit</td><td style="padding:6px 10px;font-size:12px;text-align:right;font-weight:800;color:#047857;">${fmt(closing.netProfit)}</td></tr>
                </table>
                <table style="flex:1;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;height:fit-content;">
                    <tr style="background:#f1f5f9;"><td colspan="2" style="padding:8px;font-size:11px;font-weight:700;text-transform:uppercase;">Settlement</td></tr>
                    <tr><td style="padding:6px 10px;font-size:11px;color:#64748b;">Cash</td><td style="padding:6px 10px;font-size:11px;text-align:right;">${fmt(closing.cashSales)}</td></tr>
                    <tr><td style="padding:6px 10px;font-size:11px;color:#64748b;">Card</td><td style="padding:6px 10px;font-size:11px;text-align:right;">${fmt(closing.cardSales)}</td></tr>
                    <tr><td style="padding:6px 10px;font-size:11px;color:#64748b;">UPI / Online</td><td style="padding:6px 10px;font-size:11px;text-align:right;">${fmt(closing.upiSales)}</td></tr>
                    <tr><td style="padding:6px 10px;font-size:11px;color:#64748b;">Store Credit Used</td><td style="padding:6px 10px;font-size:11px;text-align:right;">${fmt(closing.storeCreditUsed)}</td></tr>
                    <tr><td style="padding:6px 10px;font-size:11px;color:#64748b;">Credit Extended</td><td style="padding:6px 10px;font-size:11px;text-align:right;">${fmt(closing.creditExtended)}</td></tr>
                    <tr style="background:#f8fafc;"><td style="padding:6px 10px;font-size:11px;font-weight:700;">Settlement Total</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-weight:700;">${fmt(closing.settlementTotal)}</td></tr>
                    <tr><td colspan="2" style="padding:8px 10px 2px;font-size:9px;color:#94a3b8;text-transform:uppercase;">Receivables (informational)</td></tr>
                    <tr><td style="padding:2px 10px 6px;font-size:11px;color:#64748b;">Collections Received</td><td style="padding:2px 10px 6px;font-size:11px;text-align:right;">${fmt(closing.collectionsReceived)}</td></tr>
                    <tr><td style="padding:2px 10px 6px;font-size:11px;color:#64748b;">Outstanding Receivable</td><td style="padding:2px 10px 6px;font-size:11px;text-align:right;">${fmt(closing.outstandingReceivable)}</td></tr>
                </table>
            </div>

            <!-- Bill Details -->
            <h2 style="margin:0 0 8px;font-size:14px;font-weight:700;">Bill Details (${(closing.bills || []).length})</h2>
            ${billRows || '<p style="font-size:11px;color:#94a3b8;">No bills in this period.</p>'}

            <div style="margin-top:16px;text-align:center;font-size:10px;color:#94a3b8;">
                Total Orders: ${closing.totalOrders || 0} | Items Sold: ${closing.totalItemsSold || 0}
            </div>
        </div>`;

        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
        container.innerHTML = html;
        document.body.appendChild(container);

        html2pdf()
            .set({
                margin: [8, 6, 8, 6],
                filename: `closing-${closing.closingNumber}-${new Date(closing.periodEnd).toISOString().slice(0, 10)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                pagebreak: { mode: ['css', 'avoid-all'] },
            })
            .from(container.firstElementChild)
            .save()
            .then(() => document.body.removeChild(container))
            .catch((err) => {
                console.error('PDF download error:', err);
                document.body.removeChild(container);
            });
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading closing...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4 text-center">
                    <FiAlertCircle size={48} className="text-red-500 dark:text-d-red" />
                    <p className="text-slate-700 dark:text-d-text">{error}</p>
                    <button
                        onClick={() => navigate('/closing')}
                        className="px-4 py-2 bg-primary-500 dark:bg-d-accent text-white dark:text-d-card rounded-xl"
                    >
                        Back to Closings
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-d-bg">
            <div className="max-w-[1200px] mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate('/closing')}
                        className="flex items-center gap-2 text-slate-500 dark:text-d-muted hover:text-slate-800 dark:hover:text-d-text transition-colors"
                    >
                        <FiArrowLeft size={18} />
                        Back to Closings
                    </button>
                    <button
                        onClick={downloadPdf}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border text-slate-700 dark:text-d-text rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                    >
                        <FiDownload size={16} />
                        Download PDF
                    </button>
                </div>

                <ClosingReport
                    data={closing}
                    meta={{
                        closingNumber: closing.closingNumber,
                        closedBy: closing.closedBy,
                        closedAt: closing.closedAt,
                        countedNote: closing.countedNote,
                    }}
                />
            </div>
        </div>
    );
};

export default ClosingDetail;
