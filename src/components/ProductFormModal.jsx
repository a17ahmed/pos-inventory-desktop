import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { createProduct, updateProduct, generateSku, generateBarcode } from '../services/api/products';
import { appAlert, appConfirm } from './AppDialog';
import {
    FiX,
    FiSave,
    FiZap,
    FiChevronDown,
    FiCheck,
    FiPlus,
} from 'react-icons/fi';

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

    const formatCurrency = (amount) =>
        `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;

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
                category: formData.category,
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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-pop-in">
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border sticky top-0 bg-white dark:bg-d-card z-10">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">
                        {editingProduct ? 'Edit Product' : 'Add Product'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-d-glass rounded-lg transition-colors text-d-muted"
                    >
                        <FiX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-2">
                            Product Name *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-2">
                                Cost Price
                            </label>
                            <input
                                type="number"
                                value={formData.costPrice}
                                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-2">
                                Selling Price *
                            </label>
                            <input
                                type="number"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-2">
                            Max Discount %
                        </label>
                        <input
                            type="number"
                            value={formData.maxDiscountPercent}
                            onChange={(e) => setFormData({ ...formData, maxDiscountPercent: e.target.value })}
                            placeholder="No limit — only cost price applies"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                            min="0"
                            max="100"
                            step="0.1"
                        />
                        <p className="text-xs text-slate-400 dark:text-d-muted mt-1">Optional. Share of this item's profit a cashier is allowed to discount away at checkout — e.g. 40% on a Rs 10 profit caps the discount at Rs 4.</p>
                        {(() => {
                            const sp = Number(formData.price) || 0;
                            const cp = Number(formData.costPrice) || 0;
                            const baseProfit = sp - cp;
                            const baseMargin = sp > 0 ? (baseProfit / sp) * 100 : 0;
                            if (sp <= 0) return null;
                            const pct = formData.maxDiscountPercent !== '' ? Number(formData.maxDiscountPercent) : null;
                            // maxDiscountPercent is a share of PROFIT, not of the selling price
                            // (e.g. Rs 10 profit + 40% cap = Rs 4 max discount, not Rs 40).
                            const discountAtCap = pct !== null ? baseProfit * (pct / 100) : null;
                            const profitAtCap = discountAtCap !== null ? baseProfit - discountAtCap : null;
                            const profitAtCapPositive = profitAtCap === null || profitAtCap >= 0;
                            return (
                                <div className="mt-2 p-4 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl">
                                    <div className={`grid ${pct !== null ? 'grid-cols-3' : 'grid-cols-2'} gap-3 divide-x divide-slate-200 dark:divide-d-border`}>
                                        <div className="pl-3 first:pl-0">
                                            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Profit</div>
                                            <div className="text-[15px] font-display font-semibold text-slate-800 dark:text-d-text mt-0.5">{formatCurrency(baseProfit)}</div>
                                            <div className="text-[11px] text-slate-400 dark:text-d-faint">{baseMargin.toFixed(1)}% margin</div>
                                        </div>
                                        {pct !== null && (
                                            <>
                                                <div className="pl-3">
                                                    <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Max Discount</div>
                                                    <div className="text-[15px] font-display font-semibold text-amber-600 dark:text-d-accent mt-0.5">{formatCurrency(discountAtCap)}</div>
                                                    <div className="text-[11px] text-slate-400 dark:text-d-faint">{pct}% of profit</div>
                                                </div>
                                                <div className="pl-3">
                                                    <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Profit Left</div>
                                                    <div className={`text-[15px] font-display font-semibold mt-0.5 ${profitAtCapPositive ? 'text-emerald-600 dark:text-d-green' : 'text-red-500 dark:text-d-red'}`}>
                                                        {formatCurrency(profitAtCap)}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 dark:text-d-faint">at max discount</div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-2">
                            Category
                        </label>
                        {addingNewCategory ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    placeholder="New category name"
                                    autoFocus
                                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddingNewCategory(false);
                                        setFormData({ ...formData, category: '' });
                                    }}
                                    className="px-4 py-3 bg-slate-100 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-600 dark:text-d-muted hover:bg-slate-200 dark:hover:bg-d-border"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setCategoryDropdownOpen((o) => !o)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-left text-slate-800 dark:text-d-text focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover flex items-center justify-between"
                                >
                                    <span className={formData.category ? '' : 'text-slate-400 dark:text-d-faint'}>
                                        {formData.category ||
                                            (categories.length === 0 ? 'No categories yet' : 'Select a category')}
                                    </span>
                                    <FiChevronDown
                                        className={`text-slate-400 dark:text-d-muted transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {categoryDropdownOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setCategoryDropdownOpen(false)}
                                        />
                                        <div className="absolute z-20 mt-2 w-full max-h-60 overflow-y-auto bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl shadow-lg py-1">
                                            {categories.length === 0 && (
                                                <div className="px-4 py-2 text-sm text-slate-400 dark:text-d-faint">
                                                    No categories yet
                                                </div>
                                            )}
                                            {categories.map((cat) => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, category: cat });
                                                        setCategoryDropdownOpen(false);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-bg flex items-center justify-between"
                                                >
                                                    <span>{cat}</span>
                                                    {formData.category === cat && (
                                                        <FiCheck className="text-amber-500" />
                                                    )}
                                                </button>
                                            ))}
                                            <div className="border-t border-slate-200 dark:border-d-border my-1" />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAddingNewCategory(true);
                                                    setCategoryDropdownOpen(false);
                                                    setFormData({ ...formData, category: '' });
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-d-bg flex items-center gap-2"
                                            >
                                                <FiPlus /> Add new category
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {!editingProduct && (
                            <p className="mt-2 text-xs text-slate-500 dark:text-d-muted">
                                Stock starts at 0 and is managed automatically when you record supplies.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-2">
                            SKU
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={formData.sku}
                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                placeholder="Leave blank to auto-generate"
                                readOnly={!!editingProduct}
                                className={`flex-1 px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint font-mono focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover ${editingProduct ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                            {!editingProduct && (
                                <button
                                    type="button"
                                    onClick={handleGenerateSku}
                                    disabled={generatingSku}
                                    className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-d-glass border border-slate-200 dark:border-d-border rounded-xl text-sm font-medium text-slate-700 dark:text-d-text hover:bg-slate-200 dark:hover:bg-d-glass-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    title="Generate unique SKU"
                                >
                                    <FiZap size={14} />
                                    {generatingSku ? '...' : 'Generate'}
                                </button>
                            )}
                        </div>
                        {editingProduct && (
                            <p className="mt-2 text-xs text-slate-500 dark:text-d-muted">
                                SKU is locked after creation to preserve historical references.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-2">
                            Barcode
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={formData.barcode}
                                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                placeholder="Scan or leave blank"
                                readOnly={!!editingProduct}
                                className={`flex-1 px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint font-mono focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover ${editingProduct ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                            {!editingProduct && (
                                <button
                                    type="button"
                                    onClick={handleGenerateBarcode}
                                    disabled={generatingBarcode}
                                    className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-d-glass border border-slate-200 dark:border-d-border rounded-xl text-sm font-medium text-slate-700 dark:text-d-text hover:bg-slate-200 dark:hover:bg-d-glass-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    title="Generate unique barcode"
                                >
                                    <FiZap size={14} />
                                    {generatingBarcode ? '...' : 'Generate'}
                                </button>
                            )}
                        </div>
                        {editingProduct && (
                            <p className="mt-2 text-xs text-slate-500 dark:text-d-muted">
                                Barcode is locked after creation to preserve historical references.
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-semibold hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <FiSave size={18} />
                            {submitting ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductFormModal;
