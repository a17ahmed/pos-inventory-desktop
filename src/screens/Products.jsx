import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getProducts, deleteProduct } from '../services/api/products';
import ProductFormModal from '../components/ProductFormModal';
import { appAlert, appConfirm } from '../components/AppDialog';
import {
    FiPlus,
    FiSearch,
    FiEdit2,
    FiTrash2,
    FiPackage,
    FiAlertTriangle,
    FiRefreshCw,
    FiGrid,
    FiList,
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
        setEditingProduct(product || null);
        setShowModal(true);
    };

    const handleDelete = async (productId) => {
        if (!(await appConfirm('Are you sure you want to delete this product?', { danger: true }))) return;

        try {
            await deleteProduct(productId);
            fetchProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            appAlert('Failed to delete product');
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

            <ProductFormModal
                show={showModal}
                onClose={() => setShowModal(false)}
                editingProduct={editingProduct}
                categories={categories}
                onSaved={() => fetchProducts()}
            />
        </div>
    );
};

export default Products;
