import html2pdf from 'html2pdf.js';

/**
 * Generate and download a receipt as PDF.
 */
export const downloadReceipt = ({
    store = {},
    currency = 'Rs.',
    billNumber = '-',
    date = '',
    customerName = 'Walk-in',
    cashierName = '',
    items = [],
    subtotal = 0,
    tax = 0,
    itemDiscounts = 0,
    billDiscount = 0,
    total = 0,
    paymentMethod = 'cash',
    amountPaid = 0,
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
    const receiptFooter = store.receiptFooter || 'Thank you for your purchase!';

    const sep = '<div style="border-bottom:1px dashed #000;margin:6px 0;"></div>';

    const itemRows = items.map(item => {
        const lineTotal = (item.price || 0) * (item.qty || 0) - (Number(item.discountAmount) || 0);
        return `<tr>
                <td style="text-align:left;padding:3px 0;font-size:11px;">${item.name}</td>
                <td style="text-align:center;padding:3px 0;font-size:11px;">${item.qty}</td>
                <td style="text-align:right;padding:3px 0;font-size:11px;">${(item.price || 0).toLocaleString()}</td>
                <td style="text-align:right;padding:3px 0;font-size:11px;">${lineTotal.toLocaleString()}</td>
            </tr>`;
    }).join('');

    const receiptHTML = `
        <div id="receipt-pdf" style="width:72mm;font-family:'Courier New',monospace;padding:4mm 3mm;font-size:11px;color:#000;background:#fff;">
            <div style="text-align:center;">
                <div style="font-size:14px;font-weight:bold;">${storeName}</div>
                ${storeAddress ? `<div style="font-size:9px;margin-top:2px;">${storeAddress}</div>` : ''}
                ${storePhone ? `<div style="font-size:9px;">Tel: ${storePhone}</div>` : ''}
            </div>
            ${sep}
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="font-size:9px;padding:0;">Bill# ${billNumber}</td>
                    <td style="font-size:9px;padding:0;text-align:right;">${date}</td>
                </tr>
            </table>
            <div style="font-size:9px;">Customer: ${customerName}</div>
            ${cashierName ? `<div style="font-size:9px;">Cashier: ${cashierName}</div>` : ''}
            ${sep}
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr>
                        <th style="text-align:left;font-size:9px;padding:0 0 4px 0;">Item</th>
                        <th style="text-align:center;font-size:9px;padding:0 0 4px 0;">Qty</th>
                        <th style="text-align:right;font-size:9px;padding:0 0 4px 0;">Price</th>
                        <th style="text-align:right;font-size:9px;padding:0 0 4px 0;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="4" style="padding:0;"><div style="border-bottom:1px solid #000;"></div></td></tr>
                    ${itemRows}
                </tbody>
            </table>
            ${sep}
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="font-size:10px;padding:2px 0;">Subtotal</td>
                    <td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${subtotal.toLocaleString()}</td>
                </tr>
                ${tax > 0 ? `<tr><td style="font-size:10px;padding:2px 0;">Tax</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${tax.toLocaleString()}</td></tr>` : ''}
                ${itemDiscounts > 0 ? `<tr><td style="font-size:10px;padding:2px 0;">Discount</td><td style="text-align:right;font-size:10px;padding:2px 0;">-${currency} ${itemDiscounts.toLocaleString()}</td></tr>` : ''}
                ${billDiscount > 0 ? `<tr><td style="font-size:10px;padding:2px 0;">Bill Disc.</td><td style="text-align:right;font-size:10px;padding:2px 0;">-${currency} ${billDiscount.toLocaleString()}</td></tr>` : ''}
                <tr><td colspan="2" style="padding:0;"><div style="border-bottom:1px solid #000;margin:2px 0;"></div></td></tr>
                <tr>
                    <td style="padding:4px 0;font-weight:bold;font-size:12px;">TOTAL</td>
                    <td style="text-align:right;padding:4px 0;font-weight:bold;font-size:12px;">${currency} ${total.toLocaleString()}</td>
                </tr>
                ${paymentMethod === 'cash' && cashGiven > 0 ? `
                    <tr><td style="font-size:10px;padding:2px 0;">Cash</td><td style="text-align:right;font-size:10px;padding:2px 0;">${currency} ${cashGiven.toLocaleString()}</td></tr>
                    <tr><td style="font-size:10px;padding:2px 0;font-weight:bold;">Change</td><td style="text-align:right;font-size:10px;padding:2px 0;font-weight:bold;">${currency} ${change.toLocaleString()}</td></tr>
                ` : ''}
            </table>
            ${sep}
            <div style="text-align:center;font-size:9px;padding:2px 0;">Payment: ${paymentMethod.toUpperCase()}</div>
            ${sep}
            ${receiptNote ? `<div style="text-align:center;font-size:8px;padding:2px 0;font-style:italic;">${receiptNote}</div>${sep}` : ''}
            <div style="text-align:center;font-size:9px;padding:2px 0;">${receiptFooter}</div>
        </div>
    `;

    // Create temporary container
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    container.innerHTML = receiptHTML;
    document.body.appendChild(container);

    const element = container.querySelector('#receipt-pdf');
    const contentHeight = element.offsetHeight;
    // Convert px to mm (roughly 1mm = 3.78px)
    const pageHeightMm = Math.ceil(contentHeight / 3.78) + 5;

    html2pdf()
        .set({
            margin: 0,
            filename: `Receipt-${billNumber}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: [72, pageHeightMm], orientation: 'portrait' },
        })
        .from(element)
        .save()
        .then(() => {
            document.body.removeChild(container);
        })
        .catch(err => {
            console.error('PDF download error:', err);
            document.body.removeChild(container);
        });
};
