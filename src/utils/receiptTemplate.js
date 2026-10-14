/**
 * Shared receipt HTML template used by both print and download.
 * Matches the POS thermal printer receipt format.
 */

// Whole amounts print without decimals; anything else always with exactly two
// (84.7 → 84.70, 329.96999 → 329.97) so columns line up and read consistently.
const fmt = (n) => {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return v.toLocaleString('en-US', {
        minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
        maximumFractionDigits: 2,
    });
};

// Numeric cells: never wrap, and keep a gap from the column on their left so
// neighbouring numbers (Rate | Amt) can't run together.
const NUM = 'text-align:right;white-space:nowrap;padding:2px 0 2px 6px;';

export const buildReceiptHTML = ({
    store = {},
    currency = 'Rs.',
    billNumber = '-',
    date = '',
    customerName = 'Walk-in',
    customerPhone = '',
    customerAddress = '',
    cashierName = '',
    customerBalanceBefore = 0,
    items = [],
    subtotal = 0,
    tax = 0,
    itemDiscounts = 0,
    billDiscount = 0,
    total = 0,
    paymentMethod = 'cash',
    amountPaid = 0,
    amountDue = 0,
    cashGiven = 0,
    change = 0,
    totalRefunded = 0,
    netAmount = total,
    creditPayments = [], // [{ fromBillNumber, amount }] store credit applied to this bill
}) => {
    const storeName = store.name || 'Store';
    const storePhone = store.phone || '';
    const addr = store.address;
    const storeAddress = addr
        ? [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(', ')
        : '';
    const receiptNote = store.receiptNote || '';
    const receiptFooter = store.receiptFooter || 'THANK YOU!';
    const previousBalance = customerBalanceBefore || 0;
    const showCustomerPhone = !!store.showCustomerPhone;
    const showCustomerAddress = !!store.showCustomerAddress;

    const line = '<div style="border-top:1px dashed #555;margin:5px 0;"></div>';
    const solidLine = '<div style="border-top:1px solid #000;margin:5px 0;"></div>';

    // Items with numbering and discount column
    let totalQty = 0;
    let totalAmt = 0;
    let totalDisc = 0;

    const itemRows = items.map((item, idx) => {
        const qty = item.qty || 0;
        const price = item.price || 0;
        const amt = price * qty;
        const disc = Number(item.discountAmount) || 0;
        totalQty += qty;
        totalAmt += amt;
        totalDisc += disc;
        const returnedQty = Number(item.returnedQty) || 0;
        return `<tr>
            <td style="font-size:11px;padding:2px 0;word-break:break-word;">${idx + 1} ${item.name}${returnedQty > 0 ? `<div style="font-size:9px;color:#b91c1c;">${returnedQty} returned</div>` : ''}</td>
            <td style="text-align:center;font-size:11px;padding:2px 0 2px 4px;white-space:nowrap;">${qty}</td>
            <td style="${NUM}font-size:11px;">${fmt(price)}</td>
            <td style="${NUM}font-size:11px;">${fmt(amt)}</td>
            <td style="${NUM}font-size:11px;">${disc > 0 ? fmt(disc) : '0'}</td>
        </tr>`;
    }).join('');

    // Calculate bill due — derived from amounts, not the payment-method string,
    // since a partial credit sale may still be tendered/stored as 'cash'.
    const billDue = amountDue > 0 ? amountDue : Math.max(0, total - amountPaid);
    const isPartial = billDue > 0 && amountPaid > 0;
    const paymentLabel = isPartial ? `PARTIAL (${(paymentMethod || 'cash').toUpperCase()})` : (paymentMethod || 'cash').toUpperCase();

    return `
        <div style="text-align:center;">
            <div style="font-size:15px;font-weight:bold;">${storeName}</div>
            ${storeAddress ? `<div style="font-size:9px;margin-top:1px;">${storeAddress}</div>` : ''}
            ${storePhone ? `<div style="font-size:9px;">Tel: ${storePhone}</div>` : ''}
        </div>
        <div style="text-align:center;font-size:10px;margin-top:3px;">SALE INVOICE</div>
        ${line}
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="font-size:9px;padding:1px 0;">Inv No: ${billNumber}</td>
                <td style="font-size:9px;padding:1px 0;text-align:right;">${date}</td>
            </tr>
        </table>
        <div style="font-size:9px;padding:1px 0;">Cashier: ${cashierName || '-'}</div>
        <div style="font-size:9px;padding:1px 0;">Customer: ${customerName}</div>
        ${showCustomerPhone && customerPhone ? `<div style="font-size:9px;padding:1px 0;">Phone: ${customerPhone}</div>` : ''}
        ${showCustomerAddress && customerAddress ? `<div style="font-size:9px;padding:1px 0;">Address: ${customerAddress}</div>` : ''}
        ${line}
        <table style="width:100%;border-collapse:collapse;">
            <colgroup>
                <col style="width:33%;">
                <col style="width:9%;">
                <col style="width:19%;">
                <col style="width:21%;">
                <col style="width:18%;">
            </colgroup>
            <thead>
                <tr>
                    <th style="text-align:left;font-size:9px;padding:2px 0;"># Item</th>
                    <th style="text-align:center;font-size:9px;padding:2px 0 2px 4px;">Qty</th>
                    <th style="${NUM}font-size:9px;">Rate</th>
                    <th style="${NUM}font-size:9px;">Amt</th>
                    <th style="${NUM}font-size:9px;">Disc</th>
                </tr>
                <tr><td colspan="5" style="padding:0;">${solidLine}</td></tr>
            </thead>
            <tbody>
                ${itemRows}
                <tr><td colspan="5" style="padding:0;">${line}</td></tr>
                <tr>
                    <td style="font-size:10px;padding:2px 0;font-weight:bold;">Total</td>
                    <td style="text-align:center;font-size:10px;padding:2px 0 2px 4px;font-weight:bold;">${totalQty}</td>
                    <td style="${NUM}font-size:10px;"></td>
                    <td style="${NUM}font-size:10px;font-weight:bold;">${fmt(totalAmt)}</td>
                    <td style="${NUM}font-size:10px;font-weight:bold;">${totalDisc > 0 ? fmt(totalDisc) : '0'}</td>
                </tr>
            </tbody>
        </table>
        ${solidLine}
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="font-size:10px;padding:2px 0;">Sub Total:</td>
                <td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${fmt(subtotal)}</td>
            </tr>
            ${tax > 0 ? `<tr><td style="font-size:10px;padding:2px 0;">Tax:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${fmt(tax)}</td></tr>` : ''}
            ${billDiscount > 0 ? `<tr><td style="font-size:10px;padding:2px 0;">Bill Discount:</td><td style="text-align:right;font-size:10px;padding:2px 0;">-${currency} ${fmt(billDiscount)}</td></tr>` : ''}
        </table>
        ${solidLine}
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="font-size:12px;padding:3px 0;"><b>Total:</b></td>
                <td style="text-align:right;font-size:12px;padding:3px 0;"><b>${currency} ${fmt(total)}</b></td>
            </tr>
        </table>
        ${solidLine}
        ${Number(totalRefunded) > 0 ? `
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="font-size:10px;padding:2px 0;color:#b91c1c;">Total Refunded:</td>
                <td style="text-align:right;font-size:10px;padding:2px 0;color:#b91c1c;">-${currency} ${fmt(totalRefunded)}</td>
            </tr>
            <tr>
                <td style="font-size:12px;padding:3px 0;"><b>Net Amount:</b></td>
                <td style="text-align:right;font-size:12px;padding:3px 0;"><b>${currency} ${fmt(netAmount != null ? netAmount : (total - totalRefunded))}</b></td>
            </tr>
        </table>
        ${solidLine}` : ''}
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="font-size:10px;padding:2px 0;">Payment:</td>
                <td style="text-align:right;font-size:10px;padding:2px 0;">${paymentLabel}</td>
            </tr>
            ${isPartial ? `
                <tr><td style="font-size:10px;padding:2px 0;">Paid Now:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${fmt(amountPaid)}</td></tr>
                <tr><td style="font-size:10px;padding:2px 0;">Credited:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${fmt(billDue)}</td></tr>
            ` : ''}
            ${creditPayments.map((c) => `<tr><td style="font-size:10px;padding:2px 0;">Paid by credit (from Bill #${c.fromBillNumber}):</td><td style="text-align:right;font-size:10px;padding:2px 0;white-space:nowrap;">${currency} ${fmt(c.amount)}</td></tr>`).join('')}
            ${paymentMethod === 'cash' && cashGiven > 0 ? `
                <tr><td style="font-size:10px;padding:2px 0;">Cash:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${fmt(cashGiven)}</td></tr>
                <tr><td style="font-size:10px;padding:2px 0;">Change:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${fmt(change)}</td></tr>
            ` : ''}
        </table>
        ${billDue > 0 || previousBalance > 0 ? `
            ${line}
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="font-size:10px;padding:2px 0;">Balance:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${fmt(previousBalance)}</td></tr>
                <tr><td style="font-size:10px;padding:2px 0;">Bill Balance:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${fmt(billDue)}</td></tr>
                <tr><td style="font-size:10px;padding:3px 0;font-weight:bold;">Net Balance:</td><td style="text-align:right;font-size:10px;padding:3px 0;font-weight:bold;">${currency} ${fmt(previousBalance + billDue)}</td></tr>
            </table>
        ` : ''}
        ${line}
        <div style="text-align:center;font-size:10px;margin-top:3px;">${receiptFooter}</div>
        ${receiptNote ? `<div style="text-align:center;font-size:8px;margin-top:2px;font-style:italic;white-space:pre-line;">${receiptNote}</div>` : ''}
        ${line}
        <div style="text-align:center;font-size:8px;margin-top:2px;">Software By Ahmed irfan : +92 3070019031</div>
    `;
};
