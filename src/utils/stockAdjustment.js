// Manual stock adjustment — reasons and rules shared with the backend
// (PATCH /product/:id/stock, utils/stockAdjustment.mjs there). The backend
// enforces every rule; these only keep the Adjust Stock window honest.

export const ADJUST_REASONS = [
    { value: 'transfer_out', label: 'Transferred to another branch', ops: ['subtract'] },
    { value: 'transfer_in', label: 'Received from another branch', ops: ['add'] },
    { value: 'count_correction', label: 'Stock count correction', ops: ['add', 'subtract', 'set'] },
    { value: 'other', label: 'Other', ops: ['add', 'subtract', 'set'], noteRequired: true },
];

export const NOTE_MAX = 200;

export const adjustReasonLabel = (code) => ADJUST_REASONS.find((r) => r.value === code)?.label || '';

export const reasonsForOperation = (op) => ADJUST_REASONS.filter((r) => r.ops.includes(op));

// Stock after the change, or null when the quantity isn't a valid number yet
export const stockAfterAdjust = (current, op, qty) => {
    const q = Number(qty);
    if (qty === '' || !Number.isFinite(q)) return null;
    if (op === 'set') return q;
    return op === 'add' ? current + q : current - q;
};

/**
 * First problem with the form, or '' when it can be saved.
 * Mirrors the backend's 400 messages.
 */
export const adjustFormError = ({ current, op, qty, reason, note, trackStock = true }) => {
    if (trackStock === false) return "This product doesn't track stock";
    const q = Number(qty);
    if (qty === '' || !Number.isFinite(q)) return 'Enter a quantity';
    if (!Number.isInteger(q)) return 'Quantity must be a whole number';
    if (op === 'set' ? q < 0 : q <= 0) return op === 'set' ? "Quantity can't be negative" : 'Quantity must be more than 0';
    if (op === 'set' && q === current) return `No change: stock is already ${current}`;
    if (op === 'subtract' && q > current) return `Not enough stock — only ${current} available`;
    if (!reason) return 'Pick a reason';
    const r = ADJUST_REASONS.find((x) => x.value === reason);
    if (r && !r.ops.includes(op)) return `${r.label} can't be used with this operation`;
    if (r?.noteRequired && !String(note || '').trim()) return 'Type the reason for Other';
    if (String(note || '').trim().length > NOTE_MAX) return `Note can be at most ${NOTE_MAX} characters`;
    return '';
};
