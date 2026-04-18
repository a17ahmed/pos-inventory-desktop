/**
 * Shared receipt printing utility.
 *
 * @param {Object} opts
 * @param {Object} opts.store        - { name, phone, address: {street,city,...}, receiptNote, receiptFooter }
 * @param {string} opts.currency     - e.g. "PKR"
 * @param {string} opts.billNumber
 * @param {string} opts.date         - formatted date string
 * @param {string} opts.customerName
 * @param {string} [opts.cashierName]
 * @param {number} [opts.customerBalance]
 * @param {Array}  opts.items        - [{ name, qty, price, discountAmount }]
 * @param {number} opts.subtotal
 * @param {number} opts.tax
 * @param {number} opts.itemDiscounts
 * @param {number} opts.billDiscount
 * @param {number} opts.total
 * @param {string} opts.paymentMethod
 * @param {number} [opts.amountPaid]
 * @param {number} [opts.cashGiven]
 * @param {number} [opts.change]
 */
export const printReceipt = ({
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

    const itemRows = items.map(item => {
        const lineTotal = (item.price || 0) * (item.qty || 0) - (Number(item.discountAmount) || 0);
        return `<tr>
                <td style="text-align:left;padding:1px 0;font-size:11px;">${item.name}</td>
                <td style="text-align:center;font-size:11px;">${item.qty}</td>
                <td style="text-align:right;font-size:11px;">${(item.price || 0).toLocaleString()}</td>
                <td style="text-align:right;font-size:11px;">${lineTotal.toLocaleString()}</td>
            </tr>`;
    }).join('');

    const receiptHTML = `<html>
    <head>
        <title>Receipt</title>
        <style>
            @page { margin: 0; size: 72mm auto; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: 72mm; margin: 0; padding: 0; }
            body { font-family: 'Courier New', monospace; padding: 4mm 2mm; font-size: 11px; color: #000; }
            .center { text-align: center; }
            .line { border-top: 1px dashed #000; margin: 4px 0; }
            .store-name { font-size: 14px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; font-size: 9px; border-bottom: 1px solid #000; padding: 1px 0; }
            .total-row td { font-weight: bold; font-size: 12px; padding-top: 3px; }
        </style>
    </head>
    <body>
        <div class="center">
            <div class="store-name">${storeName}</div>
            ${storeAddress ? `<div style="font-size:9px;margin-top:1px;">${storeAddress}</div>` : ''}
            ${storePhone ? `<div style="font-size:9px;">Tel: ${storePhone}</div>` : ''}
        </div>
        <div class="line"></div>
        <div style="display:flex;justify-content:space-between;font-size:9px;">
            <span>Bill# ${billNumber}</span>
            <span>${date}</span>
        </div>
        <div style="font-size:9px;">Customer: ${customerName}</div>
        ${cashierName ? `<div style="font-size:9px;">Cashier: ${cashierName}</div>` : ''}
        <div class="line"></div>
        <table>
            <thead>
                <tr>
                    <th style="text-align:left;">Item</th>
                    <th style="text-align:center;">Qty</th>
                    <th style="text-align:right;">Price</th>
                    <th style="text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>${itemRows}</tbody>
        </table>
        <div class="line"></div>
        <table>
            <tr>
                <td style="font-size:10px;">Subtotal</td>
                <td style="text-align:right;font-size:10px;">${currency} ${subtotal.toLocaleString()}</td>
            </tr>
            ${tax > 0 ? `<tr><td style="font-size:10px;">Tax</td><td style="text-align:right;font-size:10px;">${currency} ${tax.toLocaleString()}</td></tr>` : ''}
            ${itemDiscounts > 0 ? `<tr><td style="font-size:10px;">Discount</td><td style="text-align:right;font-size:10px;">-${currency} ${itemDiscounts.toLocaleString()}</td></tr>` : ''}
            ${billDiscount > 0 ? `<tr><td style="font-size:10px;">Bill Disc.</td><td style="text-align:right;font-size:10px;">-${currency} ${billDiscount.toLocaleString()}</td></tr>` : ''}
            <tr class="total-row">
                <td style="border-top:1px solid #000;padding-top:3px;">TOTAL</td>
                <td style="text-align:right;border-top:1px solid #000;padding-top:3px;">${currency} ${total.toLocaleString()}</td>
            </tr>
            ${paymentMethod === 'cash' && cashGiven > 0 ? `
                <tr><td style="font-size:10px;">Cash</td><td style="text-align:right;font-size:10px;">${currency} ${cashGiven.toLocaleString()}</td></tr>
                <tr><td style="font-size:10px;font-weight:bold;">Change</td><td style="text-align:right;font-size:10px;font-weight:bold;">${currency} ${change.toLocaleString()}</td></tr>
            ` : ''}
        </table>
        <div class="line"></div>
        <div class="center" style="font-size:9px;">Payment: ${paymentMethod.toUpperCase()}</div>
        <div class="line"></div>
        ${receiptNote ? `<div class="center" style="font-size:8px;margin-top:2px;font-style:italic;">${receiptNote}</div><div class="line"></div>` : ''}
        <div class="center" style="font-size:9px;margin-top:2px;">${receiptFooter}</div>
    </body>
    </html>`;

    // Electron app — send structured data for direct ESC/POS printing
    if (window.electronAPI?.printReceipt) {
        window.electronAPI.printReceipt({
            receiptData: {
                storeName, storeAddress, storePhone, cashierName,
                billNumber, date, customerName, customerBalance,
                items: items.map(item => ({
                    name: item.name,
                    qty: item.qty,
                    rate: item.price,
                    amount: (item.price || 0) * (item.qty || 0),
                    discountAmount: item.discountAmount || 0,
                })),
                subtotal, tax, itemDiscounts, billDiscount, total,
                paymentMethod, amountPaid, cashGiven, change, currency,
                receiptFooter, receiptNote,
            },
        })
            .then(result => { if (!result.success) console.error('Print failed:', result.error); })
            .catch(err => console.error('Print error:', err));
        return;
    }

    // Browser fallback — hidden iframe
    let printFrame = document.getElementById('receipt-print-frame');
    if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'receipt-print-frame';
        printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
        document.body.appendChild(printFrame);
    }
    const frameDoc = printFrame.contentDocument || printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(receiptHTML);
    frameDoc.close();
    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
    }, 300);
};
