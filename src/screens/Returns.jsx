import React, { useState, useEffect, useRef } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { getTodaySummary, getReturnByReceipt, getReturnProductByBarcode, createReturn } from '../services/api/returns';
import { getProducts } from '../services/api/products';
import { searchCustomers, getCustomer } from '../services/api/customers';
import {
    FiSearch,
    FiX,
    FiPlus,
    FiMinus,
    FiTrash2,
    FiCheck,
    FiAlertCircle,
    FiPackage,
    FiFileText,
    FiRefreshCw,
    FiRotateCcw,
    FiUser,
} from 'react-icons/fi';

const RETURN_REASONS = [
    { value: 'defective', label: 'Defective' },
    { value: 'wrong_item', label: 'Wrong Item' },
    { value: 'changed_mind', label: 'Changed Mind' },
    { value: 'expired', label: 'Expired' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'other', label: 'Other' },
];

const REFUND_METHODS = [
    { value: 'cash', label: 'Cash', icon: '💵' },
    { value: 'card', label: 'Card', icon: '💳' },
    { value: 'store_credit', label: 'Store Credit', icon: '🎫' },
];

const Returns = () => {
    const { business } = useBusiness();

    // Return items state
    const [returnItems, setReturnItems] = useState([]);
    const [barcode, setBarcode] = useState('');
    const [allProducts, setAllProducts] = useState([]);
    const [productSuggestions, setProductSuggestions] = useState([]);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const barcodeInputRef = useRef(null);
    const productDropdownRef = useRef(null);

    // Bill lookup
    const [billNumber, setBillNumber] = useState('');
    const [linkedBill, setLinkedBill] = useState(null);
    const [loadingBill, setLoadingBill] = useState(false);

    // Customer search
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerBills, setCustomerBills] = useState([]);
    const [loadingCustomer, setLoadingCustomer] = useState(false);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const customerSearchRef = useRef(null);
    const searchTimerRef = useRef(null);

    // Refund details
    const [refundMethod, setRefundMethod] = useState('cash');
    const [customerName, setCustomerName] = useState('');
    const [notes, setNotes] = useState('');

    // Processing state
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [returnResult, setReturnResult] = useState(null);
    const [error, setError] = useState('');

    // Today's summary
    const [todaySummary, setTodaySummary] = useState({ totalReturns: 0, totalRefunded: 0 });

    useEffect(() => {
        loadTodaySummary();
        getProducts().then(res => setAllProducts(res.data || [])).catch(() => {});
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    }, []);

    // Close product dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
                setShowProductDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter products as user types
    const handleSearchChange = (value) => {
        setBarcode(value);
        if (value.trim().length >= 2) {
            const q = value.toLowerCase();
            const matches = allProducts.filter(p =>
                p.name?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)
            ).slice(0, 8);
            setProductSuggestions(matches);
            setShowProductDropdown(matches.length > 0);
        } else {
            setProductSuggestions([]);
            setShowProductDropdown(false);
        }
    };

    const addProductFromSuggestion = (product) => {
        const existingIndex = returnItems.findIndex(ri => ri.product === product._id);
        if (existingIndex >= 0) {
            const updated = [...returnItems];
            updated[existingIndex] = { ...updated[existingIndex], quantity: updated[existingIndex].quantity + 1 };
            setReturnItems(updated);
        } else {
            setReturnItems([...returnItems, {
                id: Date.now().toString(),
                product: product._id,
                productName: product.name,
                name: product.name,
                barcode: product.barcode || '',
                price: product.sellingPrice || product.price || 0,
                quantity: 1,
                reason: 'changed_mind',
                fromBill: false,
            }]);
        }
        setBarcode('');
        setShowProductDropdown(false);
        setProductSuggestions([]);
        setError('');
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    };

    const loadTodaySummary = async () => {
        try {
            const response = await getTodaySummary();
            setTodaySummary(response.data);
        } catch (error) {
            console.error('Error loading summary:', error);
        }
    };

    const formatCurrency = (amount) => {
        return `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;
    };

    // Lookup bill by number
    const lookupBill = async () => {
        if (!billNumber.trim()) {
            setError('Enter a bill number');
            return;
        }

        setLoadingBill(true);
        setError('');
        try {
            const response = await getReturnByReceipt(billNumber.trim());
            setLinkedBill(response.data);
        } catch (error) {
            if (error.response?.data?.isRefundBill) {
                setError('Cannot return items from a refund receipt');
            } else {
                setError(error.response?.data?.message || 'Bill not found');
            }
            setLinkedBill(null);
        } finally {
            setLoadingBill(false);
        }
    };

    // Customer search — debounced
    const handleCustomerSearch = (value) => {
        setCustomerQuery(value);
        setShowCustomerDropdown(true);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!value.trim()) {
            setCustomerResults([]);
            return;
        }
        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await searchCustomers(value.trim());
                setCustomerResults(res.data || []);
            } catch {
                setCustomerResults([]);
            }
        }, 300);
    };

    // Select customer → load their recent bills
    const selectCustomer = async (customer) => {
        setSelectedCustomer(customer);
        setCustomerQuery(customer.name);
        setShowCustomerDropdown(false);
        setCustomerResults([]);
        setLoadingCustomer(true);
        try {
            const res = await getCustomer(customer._id);
            const bills = (res.data.recentBills || []).filter(
                (b) => b.status === 'completed' && b.type === 'sale'
            );
            setCustomerBills(bills);
        } catch {
            setCustomerBills([]);
            setError('Failed to load customer bills');
        } finally {
            setLoadingCustomer(false);
        }
    };

    // Pick a bill from the customer's list
    const selectBillFromCustomer = async (bill) => {
        setLoadingBill(true);
        setError('');
        try {
            const res = await getReturnByReceipt(String(bill.billNumber));
            setLinkedBill(res.data);
            setBillNumber(String(bill.billNumber));
            setReturnItems([]);
        } catch (err) {
            if (err.response?.data?.isRefundBill) {
                setError('Cannot return items from a refund receipt');
            } else {
                setError(err.response?.data?.message || 'Failed to load bill');
            }
            setLinkedBill(null);
        } finally {
            setLoadingBill(false);
        }
    };

    // Clear customer selection
    const clearCustomer = () => {
        setSelectedCustomer(null);
        setCustomerQuery('');
        setCustomerBills([]);
        setCustomerResults([]);
    };

    // Add item from linked bill
    const addItemFromBill = (item) => {
        const remainingQty = item.remainingQty !== undefined ? item.remainingQty : item.qty;
        if (remainingQty <= 0) {
            setError('All items already returned');
            return;
        }

        const existingIndex = returnItems.findIndex(ri => ri.name === item.name);
        if (existingIndex >= 0) {
            const existing = returnItems[existingIndex];
            if (existing.quantity >= remainingQty) {
                setError(`Max ${remainingQty} can be returned`);
                return;
            }
            const updated = [...returnItems];
            updated[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
            setReturnItems(updated);
        } else {
            setReturnItems([...returnItems, {
                id: Date.now().toString(),
                itemId: item._id,          // bill item _id — required by processReturn
                name: item.name,
                productName: item.name,
                price: item.price,
                quantity: 1,
                maxQty: remainingQty,
                reason: 'changed_mind',
                fromBill: true
            }]);
        }
        setError('');
    };

    // Handle barcode scan/input
    const handleBarcodeSubmit = async (e) => {
        e.preventDefault();
        if (!barcode.trim()) return;

        try {
            const response = await getReturnProductByBarcode(barcode.trim());
            const product = response.data;

            if (product) {
                const existingIndex = returnItems.findIndex(ri => ri.barcode === barcode.trim());
                if (existingIndex >= 0) {
                    const updated = [...returnItems];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        quantity: updated[existingIndex].quantity + 1
                    };
                    setReturnItems(updated);
                } else {
                    setReturnItems([...returnItems, {
                        id: Date.now().toString(),
                        product: product._id,
                        productName: product.name,
                        name: product.name,
                        barcode: barcode.trim(),
                        price: product.sellingPrice || product.price,
                        quantity: 1,
                        reason: 'changed_mind',
                        fromBill: false
                    }]);
                }
                setError('');
            }
        } catch (error) {
            setError('Product not found');
        }
        setBarcode('');
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    };

    // Update item quantity
    const updateQuantity = (itemId, delta) => {
        setReturnItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const newQty = item.quantity + delta;
                if (newQty <= 0) return null;
                if (item.maxQty && newQty > item.maxQty) {
                    setError(`Max ${item.maxQty} can be returned`);
                    return item;
                }
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(Boolean));
    };

    // Update item reason
    const updateReason = (itemId, reason) => {
        setReturnItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, reason } : item
        ));
    };

    // Remove item
    const removeItem = (itemId) => {
        setReturnItems(prev => prev.filter(item => item.id !== itemId));
    };

    // Calculate totals
    const totalRefund = returnItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = returnItems.reduce((sum, item) => sum + item.quantity, 0);

    // Process return — two paths:
    //   1. Linked to an existing bill → POST /bill/:id/return (processReturn schema)
    //      Server auto-picks refund method (ledger_adjust for customer, cash for walk-in)
    //   2. Standalone (no bill linked) → POST /bill/returns/standalone
    //      Client chooses refund method.
    const processReturn = async () => {
        if (returnItems.length === 0) {
            setError('Add items to return');
            return;
        }

        // If a bill is linked, every returned item MUST come from that bill
        // (so it has an itemId). Block mixed scans to avoid silent drops.
        if (linkedBill) {
            const orphan = returnItems.find((i) => !i.itemId);
            if (orphan) {
                setError(`"${orphan.name}" is not on bill #${linkedBill.billNumber}. Remove it or clear the linked bill.`);
                return;
            }
        }

        setProcessing(true);
        setError('');
        try {
            let payload;
            if (linkedBill) {
                payload = {
                    billId: linkedBill._id,
                    items: returnItems.map((item) => ({
                        itemId: item.itemId,
                        quantity: item.quantity,
                        reason: item.reason,
                    })),
                    notes,
                };
            } else {
                payload = {
                    items: returnItems.map((item) => ({
                        product: item.product || null,
                        name: item.productName || item.name,
                        barcode: item.barcode || '',
                        qty: item.quantity,
                        price: item.price,
                        reason: item.reason,
                    })),
                    refundMethod,
                    customerName: customerName || '',
                    notes,
                };
            }

            const response = await createReturn(payload);
            const data = response.data;

            // Normalize — the two endpoints return different shapes
            if (linkedBill) {
                // processReturn → { returnNumber, refundAmount, bill }
                const returnEntry = data.bill?.returns?.slice(-1)[0];
                setReturnResult({
                    returnNumber: data.returnNumber,
                    totalItems: returnItems.reduce((s, i) => s + i.quantity, 0),
                    refundAmount: data.refundAmount,
                    refundMethod: returnEntry?.refundMethod || 'ledger_adjust',
                });
            } else {
                // standaloneRefund → { refundBill }
                const rb = data.refundBill;
                setReturnResult({
                    returnNumber: `STANDALONE-${rb?.billNumber || ''}`,
                    totalItems: returnItems.reduce((s, i) => s + i.quantity, 0),
                    refundAmount: Math.abs(rb?.total || 0),
                    refundMethod,
                });
            }

            setShowSuccess(true);
            loadTodaySummary();
        } catch (error) {
            console.error('Error processing return:', error);
            setError(error.response?.data?.message || 'Failed to process return');
        } finally {
            setProcessing(false);
        }
    };

    // Reset form
    const resetForm = () => {
        setReturnItems([]);
        setBillNumber('');
        setLinkedBill(null);
        setCustomerName('');
        setNotes('');
        setRefundMethod('cash');
        setShowSuccess(false);
        setReturnResult(null);
        setError('');
        clearCustomer();
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    };

    return (
        <div className="h-full bg-slate-50 dark:bg-d-bg overflow-auto">
            <div className="p-6 animate-fade-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Process Return</h1>
                        <p className="text-slate-500 dark:text-d-muted">Process product returns and refunds</p>
                    </div>
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border px-5 py-3 rounded-2xl">
                        <p className="text-xs text-slate-500 dark:text-d-muted mb-1">Today's Returns</p>
                        <p className="text-lg font-bold text-d-red">
                            {todaySummary.totalReturns} <span className="text-slate-500 dark:text-d-muted font-normal text-sm">({formatCurrency(todaySummary.totalRefunded)})</span>
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Customer Search, Bill Lookup & Barcode */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Customer Search Section */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4 flex items-center gap-2">
                                <FiUser className="text-d-accent" />
                                Find Customer
                            </h3>

                            {selectedCustomer ? (
                                <div>
                                    {/* Selected customer badge */}
                                    <div className="flex items-center justify-between bg-[rgba(255,210,100,0.08)] border border-[rgba(255,210,100,0.2)] rounded-xl px-4 py-3 mb-4">
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-d-heading">{selectedCustomer.name}</span>
                                            <span className="text-sm text-slate-500 dark:text-d-muted ml-3">{selectedCustomer.phone}</span>
                                        </div>
                                        <button onClick={clearCustomer} className="text-slate-400 hover:text-d-red transition-colors">
                                            <FiX size={18} />
                                        </button>
                                    </div>

                                    {/* Customer's bills */}
                                    {loadingCustomer ? (
                                        <div className="flex items-center justify-center py-6 text-slate-500 dark:text-d-muted">
                                            <FiRefreshCw className="animate-spin mr-2" /> Loading bills...
                                        </div>
                                    ) : customerBills.length === 0 ? (
                                        <p className="text-sm text-slate-500 dark:text-d-muted py-4 text-center">No completed bills found for this customer</p>
                                    ) : (
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-d-muted mb-2">Select a bill to process return:</p>
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {customerBills.map((bill) => {
                                                    const itemNames = bill.items?.map(i => i.name).join(', ') || '';
                                                    const isSelected = linkedBill?._id === bill._id;
                                                    return (
                                                        <button
                                                            key={bill._id}
                                                            onClick={() => selectBillFromCustomer(bill)}
                                                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                                                                isSelected
                                                                    ? 'border-d-accent bg-[rgba(255,210,100,0.08)]'
                                                                    : 'border-slate-200 dark:border-d-border hover:border-d-border-hover bg-slate-50 dark:bg-d-bg'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-semibold text-slate-800 dark:text-d-heading text-sm">
                                                                    Bill #{bill.billNumber}
                                                                    {isSelected && <FiCheck className="inline ml-2 text-d-accent" size={14} />}
                                                                </span>
                                                                <span className="text-xs text-slate-500 dark:text-d-muted">
                                                                    {new Date(bill.createdAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-slate-500 dark:text-d-muted truncate max-w-[200px]">{itemNames}</span>
                                                                <span className="text-xs font-medium text-slate-700 dark:text-d-text">{formatCurrency(bill.total)}</span>
                                                            </div>
                                                            {bill.returnStatus !== 'none' && (
                                                                <span className="text-xs text-d-accent mt-1 inline-block">Has previous returns</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Customer search input */
                                <div className="relative" ref={customerSearchRef}>
                                    <div className="relative">
                                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-d-faint" />
                                        <input
                                            type="text"
                                            value={customerQuery}
                                            onChange={(e) => handleCustomerSearch(e.target.value)}
                                            onFocus={() => customerQuery.trim() && setShowCustomerDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                                            placeholder="Search by customer name or phone..."
                                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint focus:outline-none focus:border-d-border-hover"
                                        />
                                    </div>
                                    {showCustomerDropdown && customerResults.length > 0 && (
                                        <div className="absolute z-20 mt-2 w-full bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                            {customerResults.map((c) => (
                                                <button
                                                    key={c._id}
                                                    onMouseDown={() => selectCustomer(c)}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-d-glass transition-colors border-b border-slate-100 dark:border-d-border last:border-0"
                                                >
                                                    <span className="font-medium text-slate-800 dark:text-d-heading">{c.name}</span>
                                                    <span className="text-sm text-slate-500 dark:text-d-muted ml-3">{c.phone}</span>
                                                    {(c.balance || 0) !== 0 && (
                                                        <span className={`text-xs ml-2 ${c.balance > 0 ? 'text-d-red' : 'text-d-green'}`}>
                                                            ({c.balance > 0 ? 'Due' : 'Credit'}: {formatCurrency(c.balance)})
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Bill Lookup Section */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4 flex items-center gap-2">
                                <FiFileText className="text-d-accent" />
                                {selectedCustomer ? 'Or Enter Bill Number' : 'Link to Original Bill (Optional)'}
                            </h3>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-d-faint" />
                                    <input
                                        type="text"
                                        value={billNumber}
                                        onChange={(e) => setBillNumber(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && lookupBill()}
                                        placeholder="Enter bill/receipt number..."
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint focus:outline-none focus:border-d-border-hover"
                                    />
                                </div>
                                <button
                                    onClick={lookupBill}
                                    disabled={loadingBill}
                                    className="px-6 py-3 bg-gradient-to-r from-d-accent to-d-accent-s text-d-card rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loadingBill ? <FiRefreshCw className="animate-spin" /> : 'Lookup'}
                                </button>
                            </div>

                            {/* Linked Bill Card */}
                            {linkedBill && (
                                <div className="mt-4 bg-[rgba(255,255,255,0.02)] rounded-xl p-4 border border-[rgba(255,255,255,0.05)]">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-slate-800 dark:text-d-heading">
                                            Bill #{linkedBill.billNumber}
                                        </h4>
                                        <span className="text-sm text-slate-500 dark:text-d-muted">
                                            {new Date(linkedBill.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted mb-3">
                                        {linkedBill.customerName || 'Walk-in'} • {formatCurrency(linkedBill.totalBill)}
                                    </p>
                                    {linkedBill.hasReturns && (
                                        <p className="text-xs text-d-accent mb-3 flex items-center gap-1">
                                            <FiAlertCircle size={14} />
                                            Has previous returns
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-500 dark:text-d-muted mb-2">Click items to add to return:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {linkedBill.items?.map((item, index) => {
                                            const remaining = item.remainingQty !== undefined ? item.remainingQty : item.qty;
                                            const isFullyReturned = remaining <= 0;
                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => addItemFromBill(item)}
                                                    disabled={isFullyReturned}
                                                    className={`px-3 py-2 rounded-xl text-sm transition-all ${
                                                        isFullyReturned
                                                            ? 'bg-[rgba(255,255,255,0.02)] text-d-faint cursor-not-allowed'
                                                            : 'bg-d-glass text-slate-700 dark:text-d-text hover:bg-[rgba(255,210,100,0.1)] hover:border-d-border-hover border border-slate-200 dark:border-d-border'
                                                    }`}
                                                >
                                                    <span className="font-medium">{item.name}</span>
                                                    <span className="text-xs ml-2 text-slate-500 dark:text-d-muted">
                                                        {isFullyReturned ? '(Returned)' : `(${remaining} avail)`}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Barcode Input Section */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4 flex items-center gap-2">
                                <FiPackage className="text-d-accent" />
                                Search Product
                            </h3>
                            <form onSubmit={handleBarcodeSubmit} className="flex gap-3">
                                <div className="relative flex-1" ref={productDropdownRef}>
                                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" size={16} />
                                    <input
                                        ref={barcodeInputRef}
                                        type="text"
                                        value={barcode}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        placeholder="Search by name or barcode..."
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-d-border-hover focus:ring-2 focus:ring-[rgba(255,210,100,0.3)]"
                                    />
                                    {showProductDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-xl shadow-xl z-50 max-h-60 overflow-auto">
                                            {productSuggestions.map((p) => (
                                                <button
                                                    key={p._id}
                                                    type="button"
                                                    onClick={() => addProductFromSuggestion(p)}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-d-glass transition-colors flex items-center justify-between border-b border-slate-100 dark:border-d-border last:border-b-0"
                                                >
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-d-heading text-sm">{p.name}</p>
                                                        {p.barcode && <p className="text-xs text-slate-400 dark:text-d-faint font-mono">{p.barcode}</p>}
                                                    </div>
                                                    <span className="text-sm text-slate-500 dark:text-d-muted">{business?.currency || 'Rs.'} {(p.sellingPrice || 0).toLocaleString()}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-gradient-to-r from-d-accent to-d-accent-s text-d-card rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all flex items-center gap-2"
                                >
                                    <FiPlus />
                                    Add
                                </button>
                            </form>
                        </div>

                        {/* Return Items List */}
                        {returnItems.length > 0 && (
                            <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">
                                    Return Items ({totalItems})
                                </h3>
                                <div className="space-y-4">
                                    {returnItems.map((item) => (
                                        <div
                                            key={item.id}
                                            className="bg-[rgba(255,255,255,0.02)] rounded-xl p-4 border border-[rgba(255,255,255,0.05)]"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-[rgba(255,107,107,0.1)] rounded-xl flex items-center justify-center">
                                                        <FiRotateCcw className="text-d-red" size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-d-heading">{item.name}</p>
                                                        <p className="text-sm text-slate-500 dark:text-d-muted">
                                                            {formatCurrency(item.price)} each
                                                            {item.fromBill && (
                                                                <span className="ml-2 text-d-accent text-xs">(From Bill)</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {/* Quantity Controls */}
                                                    <div className="flex items-center bg-slate-50 dark:bg-d-bg rounded-xl border border-slate-200 dark:border-d-border">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="p-2 hover:bg-[rgba(255,107,107,0.1)] rounded-l-xl transition-colors text-d-red"
                                                        >
                                                            <FiMinus size={16} />
                                                        </button>
                                                        <span className="px-4 py-2 font-semibold text-slate-700 dark:text-d-text min-w-[40px] text-center">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="p-2 hover:bg-[rgba(52,232,161,0.1)] rounded-r-xl transition-colors text-d-green"
                                                        >
                                                            <FiPlus size={16} />
                                                        </button>
                                                    </div>
                                                    {/* Subtotal */}
                                                    <span className="font-semibold text-d-red min-w-[100px] text-right font-display">
                                                        {formatCurrency(item.price * item.quantity)}
                                                    </span>
                                                    {/* Remove */}
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="p-2 text-slate-500 dark:text-d-muted hover:text-d-red hover:bg-[rgba(255,107,107,0.1)] rounded-xl transition-colors"
                                                    >
                                                        <FiTrash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Reason Selector */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm text-slate-500 dark:text-d-muted">Reason:</span>
                                                {RETURN_REASONS.map((reason) => (
                                                    <button
                                                        key={reason.value}
                                                        onClick={() => updateReason(item.id, reason.value)}
                                                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                                                            item.reason === reason.value
                                                                ? 'bg-d-accent text-d-card font-medium'
                                                                : 'bg-d-glass text-slate-500 dark:text-d-muted hover:bg-d-glass-hover border border-slate-200 dark:border-d-border'
                                                        }`}
                                                    >
                                                        {reason.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Summary & Details */}
                    <div className="space-y-6">
                        {/* Customer Details & Refund Method — only for standalone returns */}
                        {!linkedBill && (
                            <>
                                <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">
                                        Customer Details
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-slate-500 dark:text-d-muted mb-2">Customer Name (Optional)</label>
                                            <input
                                                type="text"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                placeholder="Enter customer name..."
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint focus:outline-none focus:border-d-border-hover"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-500 dark:text-d-muted mb-2">Notes (Optional)</label>
                                            <textarea
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Add notes..."
                                                rows={3}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint resize-none focus:outline-none focus:border-d-border-hover"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">
                                        Refund Method
                                    </h3>
                                    <div className="space-y-3">
                                        {REFUND_METHODS.map((method) => (
                                            <button
                                                key={method.value}
                                                onClick={() => setRefundMethod(method.value)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                                    refundMethod === method.value
                                                        ? 'bg-gradient-to-r from-d-accent to-d-accent-s text-d-card'
                                                        : 'bg-d-glass text-slate-500 dark:text-d-muted hover:bg-d-glass-hover border border-slate-200 dark:border-d-border'
                                                }`}
                                            >
                                                <span className="text-xl">{method.icon}</span>
                                                <span className="font-medium">{method.label}</span>
                                                {refundMethod === method.value && (
                                                    <FiCheck className="ml-auto" size={18} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Info for linked bill */}
                        {linkedBill && (
                            <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-3">
                                    Refund Info
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-d-muted">
                                    {linkedBill.customer
                                        ? 'This is a customer bill. The refund will be applied as a ledger adjustment to their account balance.'
                                        : 'This is a walk-in bill. A cash refund will be processed.'}
                                </p>
                            </div>
                        )}

                        {/* Summary & Process Button */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">
                                Return Summary
                            </h3>
                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-slate-500 dark:text-d-muted">
                                    <span>Total Items</span>
                                    <span className="font-medium text-slate-700 dark:text-d-text">{totalItems}</span>
                                </div>
                                <div className="flex justify-between text-xl font-bold pt-3 border-t border-slate-200 dark:border-d-border">
                                    <span className="text-slate-800 dark:text-d-heading">Total Refund</span>
                                    <span className="text-d-red font-display">{formatCurrency(totalRefund)}</span>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-[rgba(255,107,107,0.1)] border border-[rgba(255,107,107,0.3)] rounded-xl text-d-red text-sm flex items-center gap-2">
                                    <FiAlertCircle />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={processReturn}
                                disabled={processing || returnItems.length === 0}
                                className="w-full py-4 bg-gradient-to-r from-d-red to-[#e85555] text-white rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(255,107,107,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {processing ? (
                                    <>
                                        <FiRefreshCw className="animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <FiRotateCcw />
                                        Process Return
                                    </>
                                )}
                            </button>

                            {returnItems.length > 0 && (
                                <button
                                    onClick={resetForm}
                                    className="w-full mt-3 py-3 border border-slate-200 dark:border-d-border text-slate-500 dark:text-d-muted rounded-xl font-medium hover:bg-d-glass transition-colors"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccess && returnResult && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl w-full max-w-md animate-pop-in">
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-[rgba(52,232,161,0.1)] rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiCheck className="text-d-green" size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-d-heading mb-2">
                                Return Processed!
                            </h3>
                            <p className="text-slate-500 dark:text-d-muted mb-6">
                                Return #{returnResult.returnNumber}
                            </p>

                            <div className="bg-[rgba(255,255,255,0.02)] rounded-xl p-4 mb-6 text-left border border-[rgba(255,255,255,0.05)]">
                                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-d-border">
                                    <span className="text-slate-500 dark:text-d-muted">Items Returned</span>
                                    <span className="font-semibold text-slate-700 dark:text-d-text">{returnResult.totalItems}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-d-border">
                                    <span className="text-slate-500 dark:text-d-muted">Refund Amount</span>
                                    <span className="font-semibold text-d-red">{formatCurrency(returnResult.refundAmount)}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-500 dark:text-d-muted">Refund Method</span>
                                    <span className="font-semibold text-slate-700 dark:text-d-text uppercase">{(returnResult.refundMethod || refundMethod).replace('_', ' ')}</span>
                                </div>
                            </div>

                            <button
                                onClick={resetForm}
                                className="w-full py-3 bg-gradient-to-r from-d-green to-[#2bc88a] text-d-card rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(52,232,161,0.4)] transition-all"
                            >
                                New Return
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Returns;
