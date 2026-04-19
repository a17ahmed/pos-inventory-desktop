import html2pdf from 'html2pdf.js';
import { buildReceiptHTML } from './receiptTemplate';

/**
 * Generate and download a receipt as PDF using the shared template.
 */
export const downloadReceipt = (opts) => {
    const bodyContent = buildReceiptHTML(opts);
    const billNumber = opts.billNumber || '-';

    const receiptHTML = `
        <div id="receipt-pdf" style="width:72mm;font-family:'Courier New',monospace;padding:4mm 2mm;font-size:11px;color:#000;background:#fff;">
            ${bodyContent}
        </div>
    `;

    // Create temporary container
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    container.innerHTML = receiptHTML;
    document.body.appendChild(container);

    const element = container.querySelector('#receipt-pdf');
    const contentHeight = element.offsetHeight;
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
