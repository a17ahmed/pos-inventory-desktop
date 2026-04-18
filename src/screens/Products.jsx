import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getProducts, createProduct, updateProduct, deleteProduct, generateSku, generateBarcode } from '../services/api/products';
import {
    FiPlus,
    FiSearch,
    FiEdit2,
    FiTrash2,
    FiPackage,
    FiX,
    FiSave,
    FiAlertTriangle,
    FiRefreshCw,
    FiGrid,
    FiList,
    FiZap,
    FiChevronDown,
    FiCheck,
} from 'react-icons/fi';

const Products = () => {
    const { business, config } = useBusiness();
    const { isEmployee, isAdmin } = useAuth();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        costPrice: '',
        category: '',
        sku: '',
        barcode: '',
        description: '',
    });
    const [generatingSku, setGeneratingSku] = useState(false);
    const [generatingBarcode, setGeneratingBarcode] = useState(false);
    const [addingNewCategory, setAddingNewCategory] = useState(false);
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await getProducts();
            setProducts(res.data || []);
            const cats = [...new Set(res.data?.map((p) => p.category).filter(Boolean))];
            setCategories(cats);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter((p) => {
        const matchesSearch =
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.barcode?.includes(searchQuery) ||
            p.category?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const openModal = (product = null) => {
        setAddingNewCategory(false);
        setCategoryDropdownOpen(false);
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name || '',
                price: product.sellingPrice || '',
                costPrice: product.costPrice || '',
                category: product.category || '',
                sku: product.sku || '',
                barcode: product.barcode || '',
                description: product.description || '',
            });
        } else {
            setEditingProduct(null);
            setFormData({
                name: '',
                price: '',
                costPrice: '',
                category: '',
                sku: '',
                barcode: '',
                description: '',
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const sellingPrice = Number(formData.price);
        const costPrice = Number(formData.costPrice) || 0;
        if (costPrice > sellingPrice) {
            alert('Cost price cannot be greater than the selling price.');
            return;
        }
        try {
            const data = {
                name: formData.name,
                sellingPrice,
                costPrice,
                category: formData.category,
                sku: formData.sku,
                barcode: formData.barcode,
                description: formData.description,
            };

            if (editingProduct) {
                // Don't overwrite stock on edit — supplies/sales manage it.
                // SKU/barcode are locked after creation to preserve historical references.
                const { sku, barcode, ...editableData } = data;
                await updateProduct(editingProduct._id, editableData);
            } else {
                // New products always start at stock 0; supplies will add stock.
                // If barcode is blank, ask backend to auto-generate one too.
                await createProduct({
                    ...data,
                    stockQuantity: 0,
                    autoBarcode: !formData.barcode,
                });
            }

            setShowModal(false);
            fetchProducts();
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Failed to save product');
        }
    };

    const handleDelete = async (productId) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;

        try {
            await deleteProduct(productId);
            fetchProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Failed to delete product');
        }
    };

    const handleGenerateSku = async () => {
        setGeneratingSku(true);
        try {
            const res = await generateSku();
            setFormData((prev) => ({ ...prev, sku: res.data.sku }));
        } catch (error) {
            console.error('Error generating SKU:', error);
            alert(error.response?.data?.message || 'Failed to generate SKU');
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
            alert(error.response?.data?.message || 'Failed to generate barcode');
        } finally {
            setGeneratingBarcode(false);
        }
    };

    const formatCurrency = (amount) => {
        return `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;
    };

    const lowStockCount = products.filter(p =>
        p.trackStock && (p.stockQuantity || p.stock || 0) <= 10
    ).length;

    const getProductEmoji = (category) => {
        const emojiMap = {
            'Beverages': '🥤', 'Drinks': '🥤', 'Cold Drinks': '🧊',
            'Snacks': '🍿', 'Chips': '🍟', 'Food': '🍔',
            'Dairy': '🥛', 'Milk': '🥛',
            'Grocery': '🛒', 'Essentials': '📦',
            'Frozen': '🧊', 'Ice Cream': '🍦',
            'Bakery': '🍞', 'Bread': '🥖',
            'Fruits': '🍎', 'Vegetables': '🥬',
            'Meat': '🥩', 'Chicken': '🍗',
            'Electronics': '📱', 'Accessories': '🎧',
        };
        for (const [key, emoji] of Object.entries(emojiMap)) {
            if (category?.toLowerCase().includes(key.toLowerCase())) return emoji;
        }
        return '📦';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading products...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 dark:bg-d-bg overflow-auto">
            <div className="p-6 animate-fade-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                            {config?.itemsLabel || 'Products'}
                        </h1>
                        <p className="text-slate-500 dark:text-d-muted">
                            {products.length} items
                            {lowStockCount > 0 && (
                                <span className="ml-2 text-d-red">
                                    • {lowStockCount} low stock
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchProducts}
                            className="flex items-center gap-2 px-4 py-2.5 text-slate-500 dark:text-d-muted hover:text-slate-800 dark:hover:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl transition-all"
                        >
                            <FiRefreshCw size={18} />
                            Refresh
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => openModal()}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-semibold hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all"
                            >
                                <FiPlus size={18} />
                                Add Product
                            </button>
                        )}
                    </div>
                </div>

                {/* Search and Controls */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search products..."
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover transition-colors"
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-white dark:bg-d-card rounded-xl p-1 border border-slate-200 dark:border-d-border">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2.5 rounded-lg transition-all ${
                                viewMode === 'grid'
                                    ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card'
                                    : 'text-slate-500 dark:text-d-muted hover:text-slate-800 dark:hover:text-d-text'
                            }`}
                        >
                            <FiGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2.5 rounded-lg transition-all ${
                                viewMode === 'list'
                                    ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card'
                                    : 'text-slate-500 dark:text-d-muted hover:text-slate-800 dark:hover:text-d-text'
                            }`}
                        >
                            <FiList size={18} />
                        </button>
                    </div>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 dark-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('All')}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                            selectedCategory === 'All'
                                ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card'
                                : 'bg-slate-100 dark:bg-d-glass text-slate-600 dark:text-d-muted hover:bg-slate-200 dark:hover:bg-d-glass-hover border border-slate-200 dark:border-d-border'
                        }`}
                    >
                        All
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                                selectedCategory === cat
                                    ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card'
                                    : 'bg-slate-100 dark:bg-d-glass text-slate-600 dark:text-d-muted hover:bg-slate-200 dark:hover:bg-d-glass-hover border border-slate-200 dark:border-d-border'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Products Grid View */}
                {viewMode === 'grid' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {filteredProducts.map((product) => {
                            const stockQty = product.stockQuantity ?? product.stock ?? 0;
                            const isLow = stockQty <= 10;
                            const isOut = stockQty === 0;
                            return (
                                <div
                                    key={product._id}
                                    className="group bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-4 hover:border-amber-300 dark:hover:border-d-border-hover hover:shadow-lg dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all"
                                >
                                    {/* Product Icon & Badge */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-d-glass rounded-xl flex items-center justify-center text-2xl">
                                            {getProductEmoji(product.category)}
                                        </div>
                                        {isOut && (
                                            <span className="px-2 py-1 bg-d-red text-white rounded-lg text-xs font-bold">
                                                Out
                                            </span>
                                        )}
                                        {!isOut && isLow && (
                                            <span className="px-2 py-1 bg-[#f59e0b] text-white rounded-lg text-xs font-bold">
                                                Low
                                            </span>
                                        )}
                                    </div>

                                    {/* Product Info */}
                                    <h3 className="font-semibold text-slate-800 dark:text-d-text truncate mb-1">{product.name}</h3>
                                    {product.category && (
                                        <p className="text-xs text-slate-400 dark:text-d-faint mb-2">{product.category}</p>
                                    )}

                                    <div className="flex items-center justify-between mt-3">
                                        <p className="font-bold text-emerald-500 dark:text-d-green">
                                            {formatCurrency(product.sellingPrice || product.price)}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-d-muted">
                                            <span className={isOut ? 'text-d-red' : isLow ? 'text-[#f59e0b]' : 'text-d-muted'}>
                                                {stockQty}
                                            </span>
                                        </p>
                                    </div>

                                    {isAdmin && (
                                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-d-border opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openModal(product)}
                                                className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-d-blue hover:bg-[rgba(91,156,246,0.1)] rounded-lg transition-colors"
                                            >
                                                <FiEdit2 size={14} />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product._id)}
                                                className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-d-red hover:bg-[rgba(255,107,107,0.1)] rounded-lg transition-colors"
                                            >
                                                <FiTrash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredProducts.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-d-faint">
                                <FiPackage size={48} />
                                <p className="mt-4 text-d-muted">No products found</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Products List View */}
                {viewMode === 'list' && (
                    <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-d-glass">
                                <tr>
                                    <th className="text-left py-4 px-6 font-medium text-slate-500 dark:text-d-muted text-sm">Product</th>
                                    <th className="text-left py-4 px-6 font-medium text-slate-500 dark:text-d-muted text-sm">Category</th>
                                    <th className="text-left py-4 px-6 font-medium text-slate-500 dark:text-d-muted text-sm">Price</th>
                                    {isAdmin && (
                                        <th className="text-left py-4 px-6 font-medium text-slate-500 dark:text-d-muted text-sm">Cost</th>
                                    )}
                                    <th className="text-left py-4 px-6 font-medium text-slate-500 dark:text-d-muted text-sm">Stock</th>
                                    {isAdmin && (
                                        <th className="text-right py-4 px-6 font-medium text-slate-500 dark:text-d-muted text-sm">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((product) => {
                                    const stockQty = product.stockQuantity ?? product.stock ?? 0;
                                    const isLow = stockQty <= 10;
                                    const isOut = stockQty === 0;
                                    return (
                                        <tr
                                            key={product._id}
                                            className="border-t border-d-border hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                                        >
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-d-glass rounded-lg flex items-center justify-center text-xl">
                                                        {getProductEmoji(product.category)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-d-text">{product.name}</p>
                                                        {product.barcode && (
                                                            <p className="text-xs text-d-faint font-mono">{product.barcode}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="px-3 py-1 bg-d-glass rounded-full text-sm text-d-muted">
                                                    {product.category || '-'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 font-semibold text-d-green">
                                                {formatCurrency(product.sellingPrice || product.price)}
                                            </td>
                                            {isAdmin && (
                                                <td className="py-4 px-6 text-d-muted">
                                                    {formatCurrency(product.costPrice)}
                                                </td>
                                            )}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-semibold ${isOut ? 'text-d-red' : isLow ? 'text-[#f59e0b]' : 'text-d-text'}`}>
                                                        {stockQty}
                                                    </span>
                                                    {isOut && (
                                                        <span className="px-2 py-0.5 bg-[rgba(255,107,107,0.2)] text-d-red rounded-full text-xs font-medium">
                                                            Out
                                                        </span>
                                                    )}
                                                    {!isOut && isLow && (
                                                        <span className="px-2 py-0.5 bg-[rgba(245,158,11,0.2)] text-[#f59e0b] rounded-full text-xs font-medium">
                                                            Low
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {isAdmin && (
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openModal(product)}
                                                            className="p-2 text-d-muted hover:text-d-blue hover:bg-[rgba(91,156,246,0.1)] rounded-lg transition-colors"
                                                        >
                                                            <FiEdit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(product._id)}
                                                            className="p-2 text-d-muted hover:text-d-red hover:bg-[rgba(255,107,107,0.1)] rounded-lg transition-colors"
                                                        >
                                                            <FiTrash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredProducts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-d-faint">
                                <FiPackage size={48} />
                                <p className="mt-4 text-d-muted">No products found</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl w-full max-w-lg animate-pop-in">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">
                                {editingProduct ? 'Edit Product' : 'Add Product'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
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
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-2">
                                        Price *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                        required
                                        min="0"
                                    />
                                </div>
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
                                    />
                                </div>
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
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-semibold hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all flex items-center justify-center gap-2"
                                >
                                    <FiSave size={18} />
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;
