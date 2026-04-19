/**
 * Shared receipt HTML template used by both print and download.
 * Matches the POS thermal printer receipt format.
 */
export const buildReceiptHTML = ({
    store = {},
    currency = 'Rs.',
    billNumber = '-',
    date = '',
    customerName = 'Walk-in',
    cashierName = '',
    customerBalance = 0,
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
}) => {
    const storeName = store.name || 'Store';
    const storePhone = store.phone || '';
    const addr = store.address;
    const storeAddress = addr
        ? [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(', ')
        : '';
    const receiptNote = store.receiptNote || '';
    const receiptFooter = store.receiptFooter || 'THANK YOU!';

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
        return `<tr>
            <td style="font-size:11px;padding:2px 0;">${idx + 1} ${item.name}</td>
            <td style="text-align:center;font-size:11px;padding:2px 0;">${qty}</td>
            <td style="text-align:right;font-size:11px;padding:2px 0;">${price.toLocaleString()}</td>
            <td style="text-align:right;font-size:11px;padding:2px 0;">${amt.toLocaleString()}</td>
            <td style="text-align:right;font-size:11px;padding:2px 0;">${disc > 0 ? disc.toLocaleString() : '0'}</td>
        </tr>`;
    }).join('');

    // Calculate bill due
    const billDue = amountDue > 0 ? amountDue : (paymentMethod === 'credit' ? Math.max(0, total - amountPaid) : 0);

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
        ${line}
        <table style="width:100%;border-collapse:collapse;">
            <colgroup>
                <col style="width:40%;">
                <col style="width:12%;">
                <col style="width:16%;">
                <col style="width:16%;">
                <col style="width:16%;">
            </colgroup>
            <thead>
                <tr>
                    <th style="text-align:left;font-size:9px;padding:2px 0;"># Item</th>
                    <th style="text-align:center;font-size:9px;padding:2px 0;">Qty</th>
                    <th style="text-align:right;font-size:9px;padding:2px 0;">Rate</th>
                    <th style="text-align:right;font-size:9px;padding:2px 0;">Amt</th>
                    <th style="text-align:right;font-size:9px;padding:2px 0;">Disc</th>
                </tr>
                <tr><td colspan="5" style="padding:0;">${solidLine}</td></tr>
            </thead>
            <tbody>
                ${itemRows}
                <tr><td colspan="5" style="padding:0;">${line}</td></tr>
                <tr>
                    <td style="font-size:10px;padding:2px 0;font-weight:bold;">Total</td>
                    <td style="text-align:center;font-size:10px;padding:2px 0;font-weight:bold;">${totalQty}</td>
                    <td style="text-align:right;font-size:10px;padding:2px 0;"></td>
                    <td style="text-align:right;font-size:10px;padding:2px 0;font-weight:bold;">${totalAmt.toLocaleString()}</td>
                    <td style="text-align:right;font-size:10px;padding:2px 0;font-weight:bold;">${totalDisc > 0 ? totalDisc.toLocaleString() : '0'}</td>
                </tr>
            </tbody>
        </table>
        ${solidLine}
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="font-size:10px;padding:2px 0;">Sub Total:</td>
                <td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${subtotal.toLocaleString()}</td>
            </tr>
            ${tax > 0 ? `<tr><td style="font-size:10px;padding:2px 0;">Tax:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${tax.toLocaleString()}</td></tr>` : ''}
            ${billDiscount > 0 ? `<tr><td style="font-size:10px;padding:2px 0;">Bill Discount:</td><td style="text-align:right;font-size:10px;padding:2px 0;">-${currency} ${billDiscount.toLocaleString()}</td></tr>` : ''}
        </table>
        ${solidLine}
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="font-size:12px;padding:3px 0;"><b>Total:</b></td>
                <td style="text-align:right;font-size:12px;padding:3px 0;"><b>${currency} ${total.toLocaleString()}</b></td>
            </tr>
        </table>
        ${solidLine}
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="font-size:10px;padding:2px 0;">Payment:</td>
                <td style="text-align:right;font-size:10px;padding:2px 0;">${paymentMethod.toUpperCase()}</td>
            </tr>
            ${paymentMethod === 'cash' && cashGiven > 0 ? `
                <tr><td style="font-size:10px;padding:2px 0;">Cash:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${cashGiven.toLocaleString()}</td></tr>
                <tr><td style="font-size:10px;padding:2px 0;">Change:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${change.toLocaleString()}</td></tr>
            ` : ''}
        </table>
        ${billDue > 0 || customerBalance > 0 ? `
            ${line}
            <table style="width:100%;border-collapse:collapse;">
                ${billDue > 0 ? `<tr><td style="font-size:10px;padding:2px 0;">This Bill Due:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${billDue.toLocaleString()}</td></tr>` : ''}
                ${customerBalance > 0 ? `<tr><td style="font-size:10px;padding:2px 0;">Account Balance:</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${customerBalance.toLocaleString()}</td></tr>` : ''}
            </table>
        ` : ''}
        ${line}
        <div style="text-align:center;font-size:10px;margin-top:3px;">${receiptFooter}</div>
        ${receiptNote ? `<div style="text-align:center;font-size:8px;margin-top:2px;font-style:italic;">${receiptNote}</div>` : ''}
    `;
};
