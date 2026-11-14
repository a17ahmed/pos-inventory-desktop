import React, { useState, useEffect } from 'react';
import { Dialog, Button, Field, Input, Select, InsetCard, cn } from './ui';
import { formatAmount } from '../utils/money';
import { useBusiness } from '../context/BusinessContext';
import { createProduct, updateProduct, generateSku, generateBarcode } from '../services/api/products';
import { appAlert, appConfirm } from './AppDialog';
import { FiZap } from 'react-icons/fi';

const NEW_CATEGORY = '__new__';

const defaultFormData = () => ({
    name: '',
    price: '',
    costPrice: '',
    maxDiscountPercent: '',
    category: '',
    sku: '',
    barcode: '',
    description: '',
});

// Shared Add/Edit Product modal — used by the Products screen and anywhere
// else (e.g. Add Supply) that needs to create a product inline. Keep both
// call sites using this component so the form never drifts out of sync.
const ProductFormModal = ({ show, onClose, editingProduct = null, categories = [], onSaved }) => {
    const { business } = useBusiness();
    const [formData, setFormData] = useState(defaultFormData());
    const [submitting, setSubmitting] = useState(false);
    const [generatingSku, setGeneratingSku] = useState(false);
    const [generatingBarcode, setGeneratingBarcode] = useState(false);
    const [addingNewCategory, setAddingNewCategory] = useState(false);
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

    useEffect(() => {
        if (!show) return;
        setAddingNewCategory(false);
        setCategoryDropdownOpen(false);
        if (editingProduct) {
            setFormData({
                name: editingProduct.name || '',
                price: editingProduct.sellingPrice || '',
                costPrice: editingProduct.costPrice || '',
                maxDiscountPercent: editingProduct.maxDiscountPercent ?? '',
                category: editingProduct.category || '',
                sku: editingProduct.sku || '',
                barcode: editingProduct.barcode || '',
                description: editingProduct.description || '',
            });
        } else {
            setFormData(defaultFormData());
        }
    }, [show, editingProduct]);

    const formatCurrency = (amount) => formatAmount(amount || 0, { currency: business?.currency || 'PKR' });
    const set = (patch) => setFormData((f) => ({ ...f, ...patch }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const sellingPrice = Number(formData.price);
        const costPrice = Number(formData.costPrice) || 0;
        if (costPrice > sellingPrice) {
            appAlert('Cost price cannot be greater than the selling price.');
            return;
        }
        const maxDiscountPercent = formData.maxDiscountPercent !== '' ? Number(formData.maxDiscountPercent) : null;
        if (maxDiscountPercent !== null && (maxDiscountPercent < 0 || maxDiscountPercent > 100)) {
            appAlert('Max discount % must be between 0 and 100.');
            return;
        }
        setSubmitting(true);
        try {
            const data = {
                name: formData.name,
                sellingPrice,
                costPrice,
                maxDiscountPercent,
                // Optional — the server rejects an empty string, so leave it out when blank
                ...(formData.category.trim() ? { category: formData.category.trim() } : {}),
                sku: formData.sku,
                barcode: formData.barcode,
                description: formData.description,
            };

            let saved;
            if (editingProduct) {
                // Don't overwrite stock on edit — supplies/sales manage it.
                // SKU/barcode are locked after creation to preserve historical references.
                const { sku, barcode, ...editableData } = data;
                const res = await updateProduct(editingProduct._id, editableData);
                saved = res?.data?.product || res?.data || { ...editingProduct, ...editableData };
            } else {
                // New products always start at stock 0; supplies will add stock.
                // If barcode is blank, ask backend to auto-generate one too.
                const res = await createProduct({
                    ...data,
                    stockQuantity: 0,
                    autoBarcode: !formData.barcode,
                });
                saved = res?.data?.product || res?.data;
            }

            onSaved?.(saved);
            onClose();
        } catch (error) {
            console.error('Error saving product:', error);
            appAlert('Failed to save product');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGenerateSku = async () => {
        setGeneratingSku(true);
        try {
            const res = await generateSku();
            setFormData((prev) => ({ ...prev, sku: res.data.sku }));
        } catch (error) {
            console.error('Error generating SKU:', error);
            appAlert(error.response?.data?.message || 'Failed to generate SKU');
        } finally {
            setGeneratingSku(false);
        }
    };

    const handleGenerateBarcode = async () => {
        setGeneratingBarcode(true);
        try {
            const res = await generateBarcode();
            setFormData((prev) => ({ ...prev, barcode: res.data.barcode }));
        } catch (error) {
            console.error('Error generating barcode:', error);
            appAlert(error.response?.data?.message || 'Failed to generate barcode');
        } finally {
            setGeneratingBarcode(false);
        }
    };

    if (!show) return null;

    // Profit preview under Max discount (maxDiscountPercent is a share of PROFIT, not of the price:
    // Rs 10 profit + 40% cap = Rs 4 max discount)
    const sp = Number(formData.price) || 0;
    const cp = Number(formData.costPrice) || 0;
    const baseProfit = sp - cp;
    const baseMargin = sp > 0 ? (baseProfit / sp) * 100 : 0;
    const pct = formData.maxDiscountPercent !== '' ? Number(formData.maxDiscountPercent) : null;
    const discountAtCap = pct !== null ? baseProfit * (pct / 100) : null;
    const profitAtCap = discountAtCap !== null ? baseProfit - discountAtCap : null;
    const costTooHigh = cp > 0 && sp > 0 && cp > sp;
    const knownCategory = !formData.category || categories.includes(formData.category);

    const Figure = ({ label, value, note, tone }) => (
        <div className="min-w-0">
            <p className="font-mono text-overline-lg uppercase text-muted-foreground">{label}</p>
            <p className={cn('mt-0.5 text-body-lg font-semibold tabular-nums', tone === 'warning' ? 'text-warning-chip-foreground' : tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : 'text-foreground')}>
                {value}
            </p>
            <p className="text-caption text-muted-foreground">{note}</p>
        </div>
    );

    return (
        <Dialog
            open={show}
            onClose={submitting ? undefined : onClose}
            title={editingProduct ? 'Edit product' : 'Add product'}
            description={editingProduct ? undefined : 'Stock starts at 0 and goes up when you record a supply.'}
            size="lg"
            footerBar
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="submit" form="product-form" loading={submitting}>
                        {editingProduct ? 'Save changes' : 'Add product'}
                    </Button>
                </>
            }
        >
            <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="Name" required>
                    <Input data-autofocus value={formData.name} onChange={(e) => set({ name: e.target.value })} />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="Cost price" error={costTooHigh ? 'More than the selling price' : undefined}>
                        <Input type="number" inputMode="decimal" min="0" step="0.01" value={formData.costPrice} onChange={(e) => set({ costPrice: e.target.value })} />
                    </Field>
                    <Field label="Selling price" required>
                        <Input type="number" inputMode="decimal" min="0" step="0.01" value={formData.price} onChange={(e) => set({ price: e.target.value })} />
                    </Field>
                    <Field label="Max discount" optional hint="% of the profit">
                        <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            step="0.1"
                            value={formData.maxDiscountPercent}
                            onChange={(e) => set({ maxDiscountPercent: e.target.value })}
                            placeholder="No limit"
                        />
                    </Field>
                </div>

                {sp > 0 ? (
                    <InsetCard className="grid grid-cols-3 gap-4 py-3">
                        <Figure label="Profit" value={formatCurrency(baseProfit)} note={`${baseMargin.toFixed(1)}% margin`} tone={baseProfit < 0 ? 'destructive' : undefined} />
                        {pct !== null ? (
                            <>
                                <Figure label="Max discount" value={formatCurrency(discountAtCap)} note={`${pct}% of the profit`} tone="warning" />
                                <Figure
                                    label="Profit left"
                                    value={formatCurrency(profitAtCap)}
                                    note="at the max discount"
                                    tone={profitAtCap < 0 ? 'destructive' : 'success'}
                                />
                            </>
                        ) : (
                            <p className="col-span-2 self-center text-body-sm text-muted-foreground">
                                A cashier can discount this down to its cost price. Set a max discount to keep some of the profit.
                            </p>
                        )}
                    </InsetCard>
                ) : null}

                <Field label="Category" optional>
                    {addingNewCategory ? (
                        <Input
                            autoFocus
                            value={formData.category}
                            onChange={(e) => set({ category: e.target.value })}
                            placeholder="New category name"
                        />
                    ) : (
                        <Select
                            value={formData.category}
                            onChange={(e) => {
                                if (e.target.value === NEW_CATEGORY) {
                                    setAddingNewCategory(true);
                                    set({ category: '' });
                                } else set({ category: e.target.value });
                            }}
                        >
                            <option value="">{categories.length === 0 ? 'No categories yet' : 'No category'}</option>
                            {!knownCategory ? <option value={formData.category}>{formData.category}</option> : null}
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                            <option value={NEW_CATEGORY}>+ New category…</option>
                        </Select>
                    )}
                </Field>
                {addingNewCategory ? (
                    <Button
                        variant="link"
                        className="self-start -mt-2"
                        onClick={() => {
                            setAddingNewCategory(false);
                            set({ category: '' });
                        }}
                    >
                        Pick an existing category instead
                    </Button>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CodeField
                        label="SKU"
                        value={formData.sku}
                        onChange={(v) => set({ sku: v })}
                        placeholder="Auto if blank"
                        locked={!!editingProduct}
                        onGenerate={handleGenerateSku}
                        generating={generatingSku}
                    />
                    <CodeField
                        label="Barcode"
                        value={formData.barcode}
                        onChange={(v) => set({ barcode: v })}
                        placeholder="Scan or type"
                        locked={!!editingProduct}
                        onGenerate={handleGenerateBarcode}
                        generating={generatingBarcode}
                    />
                </div>
                {editingProduct ? (
                    <p className="-mt-2 text-caption text-muted-foreground">SKU and barcode can't change after the product is made, so old bills still match.</p>
                ) : null}

                <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
        </Dialog>
    );
};

/** SKU / barcode: mono input + "Generate" (locked when editing). */
function CodeField({ label, value, onChange, placeholder, locked, onGenerate, generating }) {
    const id = `pf-${label.toLowerCase()}`;
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-body-sm font-medium text-foreground">
                {label}
                {!locked ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
            </label>
            <div className="flex gap-2">
                <Input id={id} mono className="flex-1 min-w-0" value={value} onChange={(e) => onChange(e.target.value)} placeholder={locked ? '—' : placeholder} readOnly={locked} />
                {!locked ? (
                    <Button variant="outline" onClick={onGenerate} loading={generating} aria-label={`Make a ${label}`}>
                        {!generating && <FiZap aria-hidden="true" />}
                        Generate
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

export default ProductFormModal;
