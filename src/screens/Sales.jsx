import React, { useState, useEffect, useRef } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getProducts } from '../services/api/products';
import { createReceipt } from '../services/api/receipts';
import {
    FiSearch,
    FiPlus,
    FiMinus,
    FiTrash2,
    FiShoppingCart,
    FiUser,
    FiCreditCard,
    FiDollarSign,
    FiX,
    FiCheck,
    FiSmartphone,
    FiPrinter,
} from 'react-icons/fi';
import { printReceipt } from '../utils/printReceipt';

const Sales = () => {
    const { business } = useBusiness();
    const { user } = useAuth();
    const searchRef = useRef(null);
    const cashInputRef = useRef(null);

    // Product & Cart State
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [discount, setDiscount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashGiven, setCashGiven] = useState('');
    const [idempotencyKey, setIdempotencyKey] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successData, setSuccessData] = useState(null);

    // Generate idempotency key when cart changes
    useEffect(() => {
        if (cart.length > 0 && !idempotencyKey) {
            setIdempotencyKey(`${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
        }
        if (cart.length === 0) {
            setIdempotencyKey(null);
        }
    }, [cart.length]);

    // Focus cash input when payment modal opens
    useEffect(() => {
        if (showPaymentModal && paymentMethod === 'cash') {
            setTimeout(() => cashInputRef.current?.focus(), 100);
        }
    }, [showPaymentModal, paymentMethod]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                // Allow Enter in payment modal to confirm
                if (e.key === 'Enter' && showPaymentModal && !processing) {
                    e.preventDefault();
                    handleCheckout();
                }
                return;
            }

            // F12 - Open Payment Modal (checkout)
            if (e.key === 'F12' && cart.length > 0 && !showPaymentModal) {
                e.preventDefault();
                openPaymentModal();
            }
            // Escape - Close modals
            if (e.key === 'Escape') {
                if (showPaymentModal) setShowPaymentModal(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart.length, showPaymentModal, processing]);

    useEffect(() => {
        fetchProducts();
        searchRef.current?.focus();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await getProducts();
            const productList = res.data || [];
            setProducts(productList);
            const cats = [...new Set(productList.map((p) => p.category).filter(Boolean))];
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
            p.barcode?.includes(searchQuery);
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const addToCart = (product) => {
        setCart((prev) => {
            const existing = prev.find((item) => item._id === product._id);
            if (existing) {
                return prev.map((item) =>
                    item._id === product._id ? { ...item, qty: item.qty + 1 } : item
                );
            }
            return [...prev, { ...product, price: product.sellingPrice || product.price, qty: 1 }];
        });
    };

    const updateQuantity = (productId, delta) => {
        setCart((prev) =>
            prev
                .map((item) =>
                    item._id === productId ? { ...item, qty: Math.max(0, item.qty + delta) } : item
                )
                .filter((item) => item.qty > 0)
        );
    };

    const removeFromCart = (productId) => {
        setCart((prev) => prev.filter((item) => item._id !== productId));
    };

    const clearCart = () => {
        setCart([]);
        setCustomerName('');
        setDiscount(0);
        setIdempotencyKey(null);
    };

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discountAmount = (subtotal * discount) / 100;
    const total = subtotal - discountAmount;

    const changeAmount = Math.max(0, parseFloat(cashGiven || 0) - total);

    const openPaymentModal = () => {
        setCashGiven('');
        setPaymentMethod('cash');
        setShowPaymentModal(true);
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        // Validate cash amount for cash payments
        if (paymentMethod === 'cash' && parseFloat(cashGiven || 0) < total) {
            alert('Cash amount is less than the total bill');
            return;
        }

        setProcessing(true);
        try {
            const orderData = {
                items: cart.map((item) => ({
                    productId: item._id,
                    name: item.name,
                    price: item.price,
                    qty: item.qty,
                    costPrice: item.costPrice || 0,
                    gst: item.gst || 0,
                })),
                customerName: customerName || 'Walk-in Customer',
                cashierName: user?.name || 'Admin',
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                totalGST: cart.reduce((sum, item) => sum + (item.gst || 0) * item.qty, 0),
                totalQty: cart.reduce((sum, item) => sum + item.qty, 0),
                paymentMethod,
                discount,
                subtotal,
                totalBill: total,
                cashGiven: parseFloat(cashGiven || 0),
                changeAmount,
                idempotencyKey,
            };

            const response = await createReceipt(orderData);

            const receiptInfo = {
                billNumber: response.data?.billNumber,
                total,
                cashGiven: parseFloat(cashGiven || 0),
                change: changeAmount,
                paymentMethod,
                items: cart.map(item => ({
                    name: item.name,
                    qty: item.qty,
                    price: item.price,
                    discountAmount: 0,
                })),
                subtotal,
                discount,
                tax: cart.reduce((sum, item) => sum + (item.gst || 0) * item.qty, 0),
                customerName: customerName || 'Walk-in Customer',
            };
            setSuccessData(receiptInfo);
            setShowPaymentModal(false);
            setShowSuccess(true);

            // Auto-print receipt (only in Electron — browser shows print dialog which is disruptive)
            if (window.electronAPI?.printReceipt) printReceipt({
                store: business,
                currency: business?.currency || 'Rs.',
                billNumber: receiptInfo.billNumber || '-',
                date: new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }),
                customerName: receiptInfo.customerName,
                cashierName: user?.name || '',
                items: receiptInfo.items,
                subtotal: receiptInfo.subtotal,
                tax: receiptInfo.tax,
                itemDiscounts: 0,
                billDiscount: receiptInfo.discount,
                total: receiptInfo.total,
                paymentMethod: receiptInfo.paymentMethod,
                amountPaid: receiptInfo.total,
                cashGiven: receiptInfo.cashGiven,
                change: receiptInfo.change,
            });

            clearCart();

            setTimeout(() => {
                setShowSuccess(false);
                setSuccessData(null);
            }, 3000);
        } catch (error) {
            console.error('Error creating receipt:', error);

            // Handle duplicate payment (409)
            if (error.response?.status === 409 && error.response?.data?.alreadyPaid) {
                alert(`Bill #${error.response.data.receipt?.billNumber} has already been paid`);
                setShowPaymentModal(false);
                clearCart();
                return;
            }

            alert(error.response?.data?.message || 'Failed to create receipt');
        } finally {
            setProcessing(false);
        }
    };

    const formatCurrency = (amount) => {
        return `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;
    };

    return (
        <div className="h-full flex animate-fadeIn">
            {/* Products Section */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 relative">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search products or scan barcode..."
                            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>
                    {/* Shortcut hints */}
                    <div className="flex gap-2 text-xs text-slate-400">
                        <span className="px-2 py-1 bg-slate-100 rounded">F12 Pay</span>
                    </div>
                </div>

                {/* Categories */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                            selectedCategory === 'all'
                                ? 'bg-primary-500 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        All
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                selectedCategory === cat
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Products Grid */}
                <div className="flex-1 overflow-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredProducts.map((product) => (
                            <button
                                key={product._id}
                                onClick={() => addToCart(product)}
                                className="bg-white rounded-xl p-4 border border-slate-200 hover:border-primary-500 hover:shadow-md transition-all text-left group"
                            >
                                <div className="w-full aspect-square bg-slate-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                                    {product.image ? (
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-4xl text-slate-300">
                                            {product.name?.charAt(0)}
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-medium text-slate-800 truncate group-hover:text-primary-500">
                                    {product.name}
                                </h3>
                                <p className="text-sm text-slate-500">{product.category}</p>
                                <p className="text-lg font-bold text-green-600 mt-1">
                                    {formatCurrency(product.sellingPrice || product.price)}
                                </p>
                            </button>
                        ))}
                    </div>
                    {filteredProducts.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <FiShoppingCart size={48} />
                            <p className="mt-4">No products found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Section */}
            <div className="w-96 bg-white border-l border-slate-200 flex flex-col">
                {/* Cart Header */}
                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-800">
                            <FiShoppingCart className="inline mr-2" />
                            Cart ({cart.length})
                        </h2>
                        {cart.length > 0 && (
                            <button
                                onClick={clearCart}
                                className="text-red-500 text-sm hover:underline"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-auto p-4 space-y-3">
                    {cart.map((item) => (
                        <div
                            key={item._id}
                            className="bg-slate-50 rounded-xl p-3 flex items-center gap-3"
                        >
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-slate-800 truncate">{item.name}</h4>
                                <p className="text-sm text-slate-500">
                                    {formatCurrency(item.price)} x {item.qty}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => updateQuantity(item._id, -1)}
                                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                                >
                                    <FiMinus size={14} />
                                </button>
                                <span className="w-8 text-center font-medium">{item.qty}</span>
                                <button
                                    onClick={() => updateQuantity(item._id, 1)}
                                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                                >
                                    <FiPlus size={14} />
                                </button>
                                <button
                                    onClick={() => removeFromCart(item._id)}
                                    className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center"
                                >
                                    <FiTrash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                            <FiShoppingCart size={32} />
                            <p className="mt-2 text-sm">Cart is empty</p>
                        </div>
                    )}
                </div>

                {/* Customer & Discount */}
                <div className="p-4 border-t border-slate-200 space-y-3">
                    <div className="relative">
                        <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Customer name (optional)"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">Discount:</span>
                        <input
                            type="number"
                            value={discount}
                            onChange={(e) => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                            className="w-20 px-3 py-1 border border-slate-200 rounded-lg text-sm text-center"
                            min="0"
                            max="100"
                        />
                        <span className="text-sm text-slate-500">%</span>
                    </div>
                </div>

                {/* Totals */}
                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <div className="flex justify-between text-sm text-slate-500 mb-2">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-sm text-red-500 mb-2">
                            <span>Discount ({discount}%)</span>
                            <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xl font-bold text-slate-800 pt-2 border-t border-slate-200">
                        <span>Total</span>
                        <span className="text-green-600">{formatCurrency(total)}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="p-4 space-y-2">
                    {/* Checkout Button */}
                    <button
                        onClick={openPaymentModal}
                        disabled={cart.length === 0}
                        className="w-full py-4 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <FiCheck size={20} />
                        Pay (F12)
                    </button>
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-fadeIn">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Payment</h3>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        {/* Total Display */}
                        <div className="text-center mb-6 p-4 bg-slate-50 rounded-xl">
                            <p className="text-sm text-slate-500 mb-1">
                                Total Amount
                            </p>
                            <p className="text-3xl font-bold text-slate-800">
                                {formatCurrency(total)}
                            </p>
                        </div>

                        {/* Payment Method Selection */}
                        <div className="mb-6">
                            <p className="text-sm font-medium text-slate-600 mb-2">Payment Method</p>
                            <div className="flex gap-2">
                                {[
                                    { id: 'cash', label: 'Cash', icon: FiDollarSign },
                                    { id: 'card', label: 'Card', icon: FiCreditCard },
                                    { id: 'upi', label: 'UPI', icon: FiSmartphone },
                                ].map((method) => (
                                    <button
                                        key={method.id}
                                        onClick={() => setPaymentMethod(method.id)}
                                        className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                                            paymentMethod === method.id
                                                ? 'bg-primary-500 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        <method.icon size={18} />
                                        {method.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Cash Given Input (only for cash) */}
                        {paymentMethod === 'cash' && (
                            <div className="mb-6">
                                <label className="text-sm font-medium text-slate-600 mb-2 block">
                                    Cash Received
                                </label>
                                <input
                                    ref={cashInputRef}
                                    type="number"
                                    value={cashGiven}
                                    onChange={(e) => setCashGiven(e.target.value)}
                                    placeholder="Enter amount..."
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg focus:ring-2 focus:ring-primary-500"
                                />

                                {/* Quick amount buttons */}
                                <div className="flex gap-2 mt-2">
                                    {[total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).map((amount) => (
                                        <button
                                            key={amount}
                                            onClick={() => setCashGiven(amount.toString())}
                                            className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200"
                                        >
                                            {amount.toLocaleString()}
                                        </button>
                                    ))}
                                </div>

                                {/* Change Display */}
                                {parseFloat(cashGiven || 0) >= total && (
                                    <div className="mt-4 p-4 bg-green-50 rounded-xl">
                                        <div className="flex justify-between items-center">
                                            <span className="text-green-700 font-medium">Change to Return</span>
                                            <span className="text-2xl font-bold text-green-600">
                                                {formatCurrency(changeAmount)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Insufficient cash warning */}
                                {cashGiven && parseFloat(cashGiven) < total && (
                                    <div className="mt-2 p-3 bg-red-50 rounded-lg">
                                        <p className="text-red-600 text-sm">
                                            Insufficient amount. Need {formatCurrency(total - parseFloat(cashGiven))} more.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Confirm Button */}
                        <button
                            onClick={handleCheckout}
                            disabled={processing || (paymentMethod === 'cash' && parseFloat(cashGiven || 0) < total)}
                            className="w-full py-4 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {processing ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <FiCheck size={20} />
                                    Complete Payment
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 text-center animate-fadeIn max-w-sm">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiCheck size={40} className="text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Sale Complete!</h3>
                        {successData && (
                            <div className="text-left bg-slate-50 rounded-xl p-4 mt-4 space-y-2">
                                {successData.billNumber && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Bill #</span>
                                        <span className="font-medium">{successData.billNumber}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total</span>
                                    <span className="font-medium">{formatCurrency(successData.total)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Payment</span>
                                    <span className="font-medium capitalize">{successData.paymentMethod}</span>
                                </div>
                                {successData.paymentMethod === 'cash' && successData.change > 0 && (
                                    <div className="flex justify-between text-green-600 font-medium pt-2 border-t">
                                        <span>Change</span>
                                        <span>{formatCurrency(successData.change)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            onClick={() => {
                                if (!successData) return;
                                printReceipt({
                                    store: business,
                                    currency: business?.currency || 'Rs.',
                                    billNumber: successData.billNumber || '-',
                                    date: new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }),
                                    customerName: successData.customerName,
                                    cashierName: user?.name || '',
                                    items: successData.items,
                                    subtotal: successData.subtotal,
                                    tax: successData.tax,
                                    itemDiscounts: 0,
                                    billDiscount: successData.discount,
                                    total: successData.total,
                                    paymentMethod: successData.paymentMethod,
                                    amountPaid: successData.total,
                                    cashGiven: successData.cashGiven,
                                    change: successData.change,
                                });
                            }}
                            className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600"
                        >
                            <FiPrinter size={18} />
                            Print Receipt
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sales;
