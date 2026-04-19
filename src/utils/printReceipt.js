import { buildReceiptHTML } from './receiptTemplate';

/**
 * Print a receipt via Electron ESC/POS or browser iframe fallback.
 */
export const printReceipt = (opts) => {
    const {
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
    } = opts;

    // Electron app — send structured data for direct ESC/POS printing
    if (window.electronAPI?.printReceipt) {
        const storeName = store.name || 'Store';
        const storePhone = store.phone || '';
        const addr = store.address;
        const storeAddress = addr
            ? [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(', ')
            : '';
        const receiptFooter = store.receiptFooter || 'THANK YOU!';
        const receiptNote = store.receiptNote || '';

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

    // Browser fallback — hidden iframe with shared template
    const bodyContent = buildReceiptHTML(opts);

    const receiptHTML = `<html>
    <head>
        <title>Receipt</title>
        <style>
            @page { margin: 0; size: 72mm auto; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: 72mm; margin: 0; padding: 0; }
            body { font-family: 'Courier New', monospace; padding: 4mm 2mm; font-size: 11px; color: #000; }
            table { width: 100%; border-collapse: collapse; }
        </style>
    </head>
    <body>${bodyContent}</body>
    </html>`;

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
