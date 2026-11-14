import React, { useState, useEffect } from 'react';
import { PageHeader, Button, DataTable, rowActions, Dash, Money, StatusBadge, SegmentedControl, SearchInput } from '../components/ui';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getProducts, deleteProduct } from '../services/api/products';
import ProductFormModal from '../components/ProductFormModal';
import { appAlert, appConfirm } from '../components/AppDialog';
import {
    FiPlus,
    FiEdit2,
    FiTrash2,
    FiPackage,
    FiRefreshCw,
    FiGrid,
    FiList,
} from 'react-icons/fi';
import { stockLevel, stockQty } from '../utils/stock';

const STOCK_ORDER = ['out', 'low', 'ok', 'untracked'];

const Products = () => {
    const { business, config } = useBusiness();
    const { isEmployee, isAdmin } = useAuth();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    // Table is the default now (Stage 6); the card grid is still one click away
    const [viewMode, setViewModeState] = useState(() => {
        try {
            return localStorage.getItem('ds.products.view') || 'list';
        } catch {
            return 'list';
        }
    });
    const setViewMode = (v) => {
        setViewModeState(v);
        try {
            localStorage.setItem('ds.products.view', v);
        } catch {
            /* storage blocked */
        }
    };
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoadError(null);
        try {
            const res = await getProducts();
            setProducts(res.data || []);
            const cats = [...new Set(res.data?.map((p) => p.category).filter(Boolean))];
            setCategories(cats);
        } catch (error) {
            console.error('Error fetching products:', error);
            setLoadError(error.response?.data?.message || "Couldn't load the products. Check the connection and try again.");
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

    const outCount = products.filter((p) => stockLevel(p) === 'out').length;
    const lowCount = products.filter((p) => stockLevel(p) === 'low').length;

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

    const stockOf = stockQty;
    const stockState = stockLevel;

    const columns = [
        {
            id: 'name',
            header: 'Product',
            accessorFn: (p) => p.name || '',
            cell: ({ row: { original: p } }) => (
                <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{p.name}</p>
                    {p.barcode ? <p className="font-mono text-mono-xs text-muted-foreground">{p.barcode}</p> : null}
                </div>
            ),
        },
        {
            id: 'category',
            header: 'Category',
            accessorFn: (p) => p.category || '',
            cell: ({ getValue }) => (getValue() ? <span className="text-muted-foreground">{getValue()}</span> : <Dash />),
        },
        {
            id: 'price',
            header: 'Price',
            accessorFn: (p) => Number(p.sellingPrice || p.price) || 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => <Money value={getValue()} className="font-medium" />,
        },
        ...(isAdmin
            ? [
                  {
                      id: 'cost',
                      header: 'Cost',
                      accessorFn: (p) => Number(p.costPrice) || 0,
                      meta: { align: 'right' },
                      cell: ({ getValue }) => <Money value={getValue()} tone="muted" />,
                  },
              ]
            : []),
        {
            id: 'stock',
            header: 'Stock',
            accessorFn: stockOf,
            meta: { align: 'right' },
            cell: ({ getValue }) => <span className="font-medium tabular-nums">{getValue()}</span>,
        },
        {
            id: 'status',
            header: 'Status',
            accessorFn: stockState,
            sortingFn: (a, b) => STOCK_ORDER.indexOf(a.getValue('status')) - STOCK_ORDER.indexOf(b.getValue('status')),
            cell: ({ getValue }) => <StatusBadge kind="stock" value={getValue()} size="sm" />,
        },
        ...(isAdmin
            ? [
                  rowActions(
                      (p) => [
                          { label: 'Edit', icon: FiEdit2, onSelect: () => openModal(p) },
                          { separator: true },
                          { label: 'Delete', icon: FiTrash2, danger: true, onSelect: () => handleDelete(p._id) },
                      ],
                      { label: 'Product actions' }
                  ),
              ]
            : []),
    ];

    const isFiltered = searchQuery.trim() !== '' || selectedCategory !== 'All';
    const clearFilters = () => {
        setSearchQuery('');
        setSelectedCategory('All');
    };

    return (
        <div className="h-full overflow-auto">
            <div className="p-6 animate-fade-slide-up">
                {/* Header */}
                <PageHeader
                    title={<>{config?.itemsLabel || 'Products'}</>}
                    subtitle={
                        <>
                            {products.length} items
                            {outCount > 0 && <span className="text-destructive"> · {outCount} out of stock</span>}
                            {lowCount > 0 && <span className="text-warning-chip-foreground"> · {lowCount} low</span>}
                        </>
                    }
                    actions={
                        <>
                            <Button variant="ghost" onClick={fetchProducts}>
                                <FiRefreshCw aria-hidden="true" />
                                Refresh
                            </Button>
                            {isAdmin && (
                                <Button onClick={() => openModal()}>
                                    <FiPlus aria-hidden="true" />
                                    Add Product
                                </Button>
                            )}
                        </>
                    }
                />

                {/* View + category (the search box lives in the table's toolbar; the grid gets its own) */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <SegmentedControl
                        label="View"
                        value={viewMode}
                        onChange={setViewMode}
                        options={[
                            { value: 'list', label: 'Table', icon: FiList },
                            { value: 'grid', label: 'Cards', icon: FiGrid },
                        ]}
                    />
                    {categories.length > 0 && (
                        <SegmentedControl
                            label="Category"
                            value={selectedCategory}
                            onChange={setSelectedCategory}
                            options={[{ value: 'All', label: 'All' }, ...categories.map((c) => ({ value: c, label: c }))]}
                        />
                    )}
                    {viewMode === 'grid' && (
                        <SearchInput
                            className="w-full sm:w-[300px] ml-auto"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClear={() => setSearchQuery('')}
                            placeholder="Search products..."
                            aria-label="Search products"
                        />
                    )}
                </div>

                {/* Products Grid View */}
                {viewMode === 'grid' && loading && <p className="py-16 text-center text-muted-foreground">Loading products...</p>}
                {viewMode === 'grid' && !loading && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {filteredProducts.map((product) => {
                            const level = stockLevel(product);
                            const isLow = level === 'low';
                            const isOut = level === 'out';
                            return (
                                <div
                                    key={product._id}
                                    className="group bg-card rounded-2xl border border-hairline p-4 hover:border-primary/30 hover:shadow-lg transition-all"
                                >
                                    {/* Product Icon & Badge */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-2xl">
                                            {getProductEmoji(product.category)}
                                        </div>
                                        {isOut && (
                                            <span className="px-2 py-1 bg-destructive text-white rounded-lg text-xs font-bold">
                                                Out
                                            </span>
                                        )}
                                        {!isOut && isLow && (
                                            <span className="px-2 py-1 bg-warning text-white rounded-lg text-xs font-bold">
                                                Low
                                            </span>
                                        )}
                                    </div>

                                    {/* Product Info */}
                                    <h3 className="font-semibold text-foreground truncate mb-1">{product.name}</h3>
                                    {product.category && (
                                        <p className="text-xs text-muted-foreground mb-2">{product.category}</p>
                                    )}

                                    <div className="flex items-center justify-between mt-3">
                                        <p className="font-bold text-success">
                                            {formatCurrency(product.sellingPrice || product.price)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            <span className={isOut ? 'text-destructive' : isLow ? 'text-warning-chip-foreground' : 'text-muted-foreground'}>
                                                {level === 'untracked' ? 'Not tracked' : stockQty(product)}
                                            </span>
                                        </p>
                                    </div>

                                    {isAdmin && (
                                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-hairline opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openModal(product)}
                                                className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-info hover:bg-info-chip rounded-lg transition-colors"
                                            >
                                                <FiEdit2 size={14} />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product._id)}
                                                className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-destructive hover:bg-destructive-chip rounded-lg transition-colors"
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
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <FiPackage size={48} />
                                <p className="mt-4 text-muted-foreground">No products found</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Products table */}
                {viewMode === 'list' && (
                    <DataTable
                        id="products"
                        caption={config?.itemsLabel || 'Products'}
                        data={filteredProducts}
                        columns={columns}
                        getRowId={(p) => p._id}
                        loading={loading}
                        error={loadError ? { message: loadError, onRetry: fetchProducts } : null}
                        search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search name, barcode or category' }}
                        isFiltered={isFiltered}
                        onClearFilters={clearFilters}
                        empty={{
                            icon: FiPackage,
                            title: 'No products yet',
                            description: isAdmin ? 'Add your first product to start selling.' : 'The shop admin adds products.',
                            action: isAdmin ? (
                                <Button size="xs" onClick={() => openModal()}>
                                    <FiPlus aria-hidden="true" />
                                    Add product
                                </Button>
                            ) : null,
                        }}
                        onRowClick={isAdmin ? (p) => openModal(p) : undefined}
                        rowLabel={(p) => `Edit ${p.name}`}
                        rowTone={(p) => (stockState(p) === 'low' ? 'attention' : null)}
                        initialSort={[{ id: 'name', desc: false }]}
                    />
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
