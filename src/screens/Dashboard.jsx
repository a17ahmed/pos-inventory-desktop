import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toLocalDateStr } from '../utils/date';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getProducts, getDeadStock, getLowStockProducts } from '../services/api/products';
import { getReceiptStats, getTopProducts } from '../services/api/receipts';
import { createBill, getSalesByProduct, getSalesByCashier, getPaymentMethodReport } from '../services/api/bills';
import { getEmployees } from '../services/api/employees';
import { getSupplyStats } from '../services/api/supplies';
import { searchCustomers } from '../services/api/customers';
import { getExpenses as getApprovedExpenses } from '../services/api/expenses';
import { getCashBalance } from '../services/api/cashbook';
import { printReceipt as printReceiptUtil } from '../utils/printReceipt';
import {
    FiTrendingUp,
    FiShoppingCart,
    FiDollarSign,
    FiArrowUp,
    FiArrowDown,
    FiCalendar,
    FiSearch,
    FiPlus,
    FiMinus,
    FiTrash2,
    FiX,
    FiPause,
    FiCornerUpLeft,
    FiCheck,
    FiCreditCard,
    FiSmartphone,
    FiList,
    FiPhone,
    FiUser,
    FiUserCheck,
    FiPercent,
    FiChevronUp,
    FiChevronDown,
    FiAlertTriangle,
    FiPackage,
    FiActivity,
    FiAward,
    FiAlertCircle,
    FiZap,
    FiUsers,
    FiFileText,
    FiTruck,
    FiBookOpen,
    FiPieChart,
    FiGrid,
    FiPrinter,
} from 'react-icons/fi';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts';

// ==================== EMPLOYEE DASHBOARD - PREMIUM REDESIGN ====================
const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { business } = useBusiness();

    // Billing state
    const [billingActive, setBillingActive] = useState(true); // Always show billing view
    const [bills, setBills] = useState([{
        id: '1',
        name: 'Bill 1',
        items: [],
        createdAt: new Date().toISOString(),
        customer: null,
        customerName: '',
        customerPhone: '',
        billDiscountAmount: 0,
        billDiscountReason: '',
    }]);

    // Cart item inline expansion (for profit details + per-item discount)
    const [expandedItemId, setExpandedItemId] = useState(null);

    // Customer picker
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [searchingCustomers, setSearchingCustomers] = useState(false);
    const [showWalkInConfirm, setShowWalkInConfirm] = useState(false);
    const customerPickerRef = useRef(null);
    const [activeBillId, setActiveBillId] = useState('1');
    const [billCounter, setBillCounter] = useState(1);

    // Products
    const [products, setProducts] = useState([]);
    const [productsCache, setProductsCache] = useState({});
    const [topProducts, setTopProducts] = useState([]);
    const [categories, setCategories] = useState(['All']);
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);

    // Stats
    const [todayStats, setTodayStats] = useState({ totalSales: 0, transactions: 0 });
    const [loading, setLoading] = useState(true);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashGiven, setCashGiven] = useState('');
    const [creditPaidNow, setCreditPaidNow] = useState('');
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const cashInputRef = useRef(null);


    // Toast
    const [toast, setToast] = useState({ show: false, message: '', icon: '' });

    useEffect(() => {
        loadData();
        loadSavedBills();
    }, []);

    // Debounced customer search
    useEffect(() => {
        if (!showCustomerPicker) return;
        const q = customerQuery.trim();
        if (q.length === 0) {
            setCustomerResults([]);
            return;
        }
        setSearchingCustomers(true);
        const timer = setTimeout(async () => {
            try {
                const res = await searchCustomers(q);
                setCustomerResults(res.data || []);
            } catch (err) {
                console.error('Customer search error:', err);
                setCustomerResults([]);
                const msg = err?.response?.data?.message || 'Failed to search customers';
                showToast(msg);
            } finally {
                setSearchingCustomers(false);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [customerQuery, showCustomerPicker]);

    // Close customer picker on outside click
    useEffect(() => {
        if (!showCustomerPicker) return;
        const handler = (e) => {
            if (customerPickerRef.current && !customerPickerRef.current.contains(e.target)) {
                setShowCustomerPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCustomerPicker]);

    const showToast = (message, icon = '✦') => {
        setToast({ show: true, message, icon });
        setTimeout(() => setToast({ show: false, message: '', icon: '' }), 2400);
    };


    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const currentBill = bills.find(b => b.id === activeBillId);
            const hasItems = currentBill?.items?.length > 0;
            const anyModalOpen = showPaymentModal;

            // Ctrl+K or Cmd+K - Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                return;
            }

            // Ctrl+0 - Pay
            if ((e.ctrlKey || e.metaKey) && e.key === '0' && hasItems && !anyModalOpen) {
                e.preventDefault();
                setShowPaymentModal(true);
                setPaymentMethod('cash');
                setCashGiven('');
                return;
            }

            // Escape - Close modals
            if (e.key === 'Escape') {
                if (showSuccess) { setShowSuccess(false); setSuccessData(null); return; }
                if (showPaymentModal) { setShowPaymentModal(false); return; }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [bills, activeBillId, showPaymentModal, showSuccess]);

    useEffect(() => {
        if (showPaymentModal && paymentMethod === 'cash') {
            setTimeout(() => cashInputRef.current?.focus(), 100);
        }
    }, [showPaymentModal, paymentMethod]);

    const loadData = async () => {
        try {
            // Load products
            const productRes = await getProducts();
            const productList = productRes.data || [];
            setProducts(productList);

            // Build cache
            const cache = {};
            productList.forEach(p => {
                if (p.barcode) cache[p.barcode] = p;
                if (p.sku) cache[p.sku] = p;
                cache[p._id] = p;
            });
            setProductsCache(cache);

            // Extract categories
            const cats = ['All', ...new Set(productList.map(p => p.category).filter(Boolean))];
            setCategories(cats);

            // Load top products
            try {
                const topRes = await getTopProducts(12);
                if (topRes.data && topRes.data.length > 0) {
                    setTopProducts(topRes.data);
                } else {
                    // Fallback to first 12 products if no sales data
                    setTopProducts(productList.slice(0, 12).map(p => ({
                        _id: p._id,
                        name: p.name,
                        price: p.sellingPrice || p.price,
                        category: p.category || 'General',
                        emoji: p.emoji || getProductEmoji(p.category),
                    })));
                }
            } catch (err) {
                // Fallback
                setTopProducts(productList.slice(0, 12).map(p => ({
                    _id: p._id,
                    name: p.name,
                    price: p.sellingPrice || p.price,
                    category: p.category || 'General',
                    emoji: p.emoji || getProductEmoji(p.category),
                })));
            }

            // Load today's stats for sidebar revenue bar
            const todayStatsRes = await getReceiptStats({ filter: 'today' });
            setTodayStats({
                totalSales: todayStatsRes.data?.grossRevenue || 0,
                transactions: todayStatsRes.data?.totalOrders || 0,
            });
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getProductEmoji = (category) => {
        const emojiMap = {
            'Drinks': '🥤',
            'Beverages': '🥤',
            'Snacks': '🍿',
            'Food': '🍔',
            'Electronics': '📱',
            'Stationery': '📝',
            'Misc': '📦',
            'General': '📦',
        };
        return emojiMap[category] || '📦';
    };

    const loadSavedBills = () => {
        try {
            const saved = localStorage.getItem('retailBills');
            const savedActiveId = localStorage.getItem('retailActiveBillId');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0) {
                    setBills(parsed);
                    const maxNum = Math.max(...parsed.map(b => parseInt(b.name.replace('Bill ', '')) || 0));
                    setBillCounter(maxNum);
                    setActiveBillId(savedActiveId && parsed.find(b => b.id === savedActiveId) ? savedActiveId : parsed[0].id);
                    setBillingActive(true);
                }
            }
        } catch (error) {
            console.error('Error loading saved bills:', error);
        }
    };

    const saveBills = (billsToSave, activeId) => {
        try {
            localStorage.setItem('retailBills', JSON.stringify(billsToSave));
            if (activeId !== undefined) {
                localStorage.setItem('retailActiveBillId', activeId || '');
            }
        } catch (error) {
            console.error('Error saving bills:', error);
        }
    };

    const createNewBill = () => {
        const newNum = billCounter + 1;
        const newBill = {
            id: Date.now().toString(),
            name: `Bill ${newNum}`,
            items: [],
            createdAt: new Date().toISOString(),
            customer: null,
            customerName: '',
            customerPhone: '',
            billDiscountAmount: 0,
            billDiscountReason: '',
        };
        setBillCounter(newNum);
        const updated = [...bills, newBill];
        setBills(updated);
        setActiveBillId(newBill.id);
        saveBills(updated, newBill.id);
        showToast('New bill created ✦');
    };

    const switchBill = (billId) => {
        setActiveBillId(billId);
        saveBills(bills, billId);
        const bill = bills.find(b => b.id === billId);
        showToast(`Switched to ${bill?.name || 'Bill'}`);
    };

    const deleteBill = (billId) => {
        if (bills.length === 1) {
            // Reset to empty bill
            const newBill = {
                id: Date.now().toString(),
                name: 'Bill 1',
                items: [],
                createdAt: new Date().toISOString(),
                customer: null,
                customerName: '',
                customerPhone: '',
                billDiscountAmount: 0,
                billDiscountReason: '',
            };
            setBills([newBill]);
            setActiveBillId(newBill.id);
            setBillCounter(1);
            saveBills([newBill], newBill.id);
        } else {
            // Filter out the deleted bill and renumber remaining bills
            const filtered = bills.filter(b => b.id !== billId);
            const updated = filtered.map((bill, index) => ({
                ...bill,
                name: `Bill ${index + 1}`
            }));
            const newActiveId = billId === activeBillId ? updated[0]?.id : activeBillId;
            setBills(updated);
            setActiveBillId(newActiveId);
            setBillCounter(updated.length);
            saveBills(updated, newActiveId);
        }
    };

    const addProductToBill = (product) => {
        if (!activeBillId) return;

        if (product.trackStock && product.stockQuantity <= 0) {
            showToast(`${product.name} is out of stock`);
            return;
        }

        const emoji = product.emoji || getProductEmoji(product.category);

        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === activeBillId) {
                    const existingIndex = bill.items.findIndex(item => item._id === product._id);
                    if (existingIndex >= 0) {
                        const currentQty = bill.items[existingIndex].qty;
                        if (product.trackStock && currentQty >= product.stockQuantity) {
                            showToast(`Only ${product.stockQuantity} in stock`);
                            return bill;
                        }
                        const newItems = [...bill.items];
                        newItems[existingIndex] = { ...newItems[existingIndex], qty: currentQty + 1 };
                        return { ...bill, items: newItems };
                    } else {
                        return {
                            ...bill,
                            items: [...bill.items, {
                                _id: product._id,
                                name: product.name,
                                price: product.sellingPrice || product.price,
                                costPrice: product.costPrice || 0,
                                gst: product.gst || 0,
                                qty: 1,
                                discountAmount: 0,
                                emoji: emoji,
                                barcode: product.barcode,
                                trackStock: product.trackStock,
                                stockQuantity: product.stockQuantity,
                                category: product.category,
                            }]
                        };
                    }
                }
                return bill;
            });
            saveBills(updated, activeBillId);
            return updated;
        });

        showToast(`${emoji} ${product.name} added`);
    };

    const updateQuantity = (itemId, delta) => {
        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === activeBillId) {
                    const newItems = bill.items.map(item => {
                        if (item._id === itemId) {
                            const newQty = item.qty + delta;
                            if (newQty <= 0) return null;
                            if (delta > 0 && item.trackStock && newQty > item.stockQuantity) {
                                showToast(`Only ${item.stockQuantity} in stock`);
                                return item;
                            }
                            return { ...item, qty: newQty };
                        }
                        return item;
                    }).filter(Boolean);
                    return { ...bill, items: newItems };
                }
                return bill;
            });
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    const removeItem = (itemId) => {
        setBills(prev => {
            const updated = prev.map(bill => {
                if (bill.id === activeBillId) {
                    return { ...bill, items: bill.items.filter(item => item._id !== itemId) };
                }
                return bill;
            });
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    // Mirrors the backend pre-save math so the UI stays consistent with what the
    // server will compute. Returns subtotal (after item discounts), tax, bill
    // discount, total, totalCost, billProfit.
    const getBillTotal = (bill) => {
        const gross = bill.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const itemDiscounts = bill.items.reduce((sum, item) => sum + (Number(item.discountAmount) || 0), 0);
        const subtotal = bill.items.reduce(
            (sum, item) => sum + (item.price * item.qty - (Number(item.discountAmount) || 0)),
            0
        );
        const tax = bill.items.reduce(
            (sum, item) => sum + (item.price * (item.gst || 0) / 100) * item.qty,
            0
        );
        const beforeBillDiscount = subtotal + tax;
        const billDiscount = Math.min(Number(bill.billDiscountAmount) || 0, beforeBillDiscount);
        const total = Math.max(0, beforeBillDiscount - billDiscount);
        const totalCost = bill.items.reduce((sum, item) => sum + (Number(item.costPrice) || 0) * item.qty, 0);
        const billProfit = total - totalCost;
        return {
            gross,
            itemDiscounts,
            subtotal,
            tax,
            billDiscount,
            total,
            totalCost,
            billProfit,
        };
    };

    // Compute per-item profit mirroring the backend (distributes bill-level
    // discount proportionally so profit stays correct either way).
    const getItemProfit = (bill, item) => {
        const lineGross = item.price * item.qty;
        const itemDiscount = Number(item.discountAmount) || 0;
        const lineAfterItemDiscount = Math.max(0, lineGross - itemDiscount);
        const totals = getBillTotal(bill);
        let share = 0;
        if (totals.billDiscount > 0 && totals.subtotal > 0) {
            share = (lineAfterItemDiscount / totals.subtotal) * totals.billDiscount;
        }
        const effectivePrice = (lineAfterItemDiscount - share) / (item.qty || 1);
        const profit = (effectivePrice - (Number(item.costPrice) || 0)) * item.qty;
        const margin = effectivePrice > 0 ? ((effectivePrice - (item.costPrice || 0)) / effectivePrice) * 100 : 0;
        return { effectivePrice, profit, margin, lineAfterItemDiscount };
    };

    // ── Mutators for new POS features ────────────────────────────
    const updateActiveBill = (updater) => {
        setBills((prev) => {
            const updated = prev.map((b) => (b.id === activeBillId ? updater(b) : b));
            saveBills(updated, activeBillId);
            return updated;
        });
    };

    const setItemDiscount = (itemId, amount) => {
        const amt = Math.max(0, Number(amount) || 0);
        updateActiveBill((bill) => {
            // Enforce: clearing bill-level discount when any item has a discount.
            const newItems = bill.items.map((i) => (i._id === itemId ? { ...i, discountAmount: amt } : i));
            const anyItemHasDiscount = newItems.some((i) => (Number(i.discountAmount) || 0) > 0);
            return {
                ...bill,
                items: newItems,
                billDiscountAmount: anyItemHasDiscount ? 0 : bill.billDiscountAmount,
                billDiscountReason: anyItemHasDiscount ? '' : bill.billDiscountReason,
            };
        });
    };

    const setBillDiscount = (amount, reason) => {
        const amt = Math.max(0, Number(amount) || 0);
        updateActiveBill((bill) => {
            // Enforce: clear all per-item discounts if setting a bill discount.
            const clearedItems =
                amt > 0
                    ? bill.items.map((i) => ({ ...i, discountAmount: 0 }))
                    : bill.items;
            return {
                ...bill,
                items: clearedItems,
                billDiscountAmount: amt,
                billDiscountReason: reason ?? bill.billDiscountReason,
            };
        });
    };

    const attachCustomer = (customer) => {
        updateActiveBill((bill) => ({
            ...bill,
            customer: customer?._id || null,
            customerName: customer?.name || '',
            customerPhone: customer?.phone || '',
            customerBalance: customer?.balance || 0,
        }));
        setShowCustomerPicker(false);
        setCustomerQuery('');
        setCustomerResults([]);
    };

    const detachCustomer = () => {
        updateActiveBill((bill) => ({
            ...bill,
            customer: null,
            customerName: '',
            customerPhone: '',
        }));
    };

    const handleCheckout = async (confirmedWalkIn = false) => {
        const bill = bills.find(b => b.id === activeBillId);
        if (!bill || bill.items.length === 0) return;

        // Credit requires a real customer
        if (paymentMethod === 'credit' && !bill.customer) {
            showToast('Attach a customer to use credit');
            return;
        }

        // Walk-in guard: if no customer attached, confirm before proceeding
        // (credit mode already requires a customer, so it never trips this)
        if (!confirmedWalkIn && !bill.customer) {
            setShowWalkInConfirm(true);
            return;
        }

        const totals = getBillTotal(bill);
        const currentEffectiveTotal = totals.total;
        const currentChangeAmount = Math.max(0, parseFloat(cashGiven || 0) - currentEffectiveTotal);

        if (paymentMethod === 'cash' && parseFloat(cashGiven || 0) < currentEffectiveTotal) {
            showToast('Cash amount is less than total');
            return;
        }

        const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        let amountPaid;
        if (paymentMethod === 'cash') {
            amountPaid = Math.min(parseFloat(cashGiven || 0), currentEffectiveTotal);
        } else if (paymentMethod === 'credit') {
            amountPaid = Math.max(0, Math.min(parseFloat(creditPaidNow || 0), currentEffectiveTotal));
        } else {
            amountPaid = currentEffectiveTotal;
        }

        // Backend only accepts: cash | card | online | store_credit
        // Map UI-only methods to backend-valid ones
        const backendPaymentMethod =
            paymentMethod === 'upi' ? 'online' :
            paymentMethod === 'credit' ? 'cash' :
            paymentMethod;

        setProcessing(true);
        try {
            const response = await createBill({
                items: bill.items.map((item) => ({
                    product: item._id,
                    name: item.name,
                    barcode: item.barcode || '',
                    category: item.category || 'General',
                    qty: item.qty,
                    price: item.price,
                    costPrice: Number(item.costPrice) || 0,
                    gst: item.gst || 0,
                    discountAmount: Number(item.discountAmount) || 0,
                })),
                status: 'completed',
                customer: bill.customer || null,
                customerName: bill.customerName || 'Walk-in',
                customerPhone: bill.customerPhone || '',
                billDiscountAmount: Number(bill.billDiscountAmount) || 0,
                billDiscountReason: bill.billDiscountReason || '',
                paymentMethod: backendPaymentMethod,
                amountPaid,
                cashGiven: paymentMethod === 'cash' ? parseFloat(cashGiven || 0) : 0,
                idempotencyKey,
            });


            // Reset bill
            if (bills.length > 1) {
                const updated = bills.filter(b => b.id !== bill.id);
                setBills(updated);
                setActiveBillId(updated[0]?.id);
                saveBills(updated, updated[0]?.id);
            } else {
                const newBill = {
                    id: Date.now().toString(),
                    name: 'Bill 1',
                    items: [],
                    createdAt: new Date().toISOString(),
                    customer: null,
                    customerName: '',
                    customerPhone: '',
                    billDiscountAmount: 0,
                    billDiscountReason: '',
                };
                setBills([newBill]);
                setActiveBillId(newBill.id);
                setBillCounter(1);
                saveBills([newBill], newBill.id);
            }

            const sData = {
                billNumber: response.data?.billNumber,
                total: currentEffectiveTotal,
                cashGiven: parseFloat(cashGiven || 0),
                change: currentChangeAmount,
                paymentMethod,
                amountPaid,
                bill: { ...bill, items: [...bill.items] },
            };
            setSuccessData(sData);
            setShowPaymentModal(false);
            setCashGiven('');
            setCreditPaidNow('');
            setPaymentMethod('cash');
            setShowSuccess(true);

            // Auto-print receipt (only in Electron — browser shows print dialog which is disruptive)
            if (window.electronAPI?.printReceipt) printReceipt(sData, sData.bill);

            loadData();
        } catch (error) {
            console.error('Checkout error:', error);
            if (error.response?.status === 409) {
                showToast('Bill already paid');
                deleteBill(bill.id);
            } else {
                showToast(error.response?.data?.message || 'Failed to complete sale');
            }
        } finally {
            setProcessing(false);
        }
    };

    const printReceipt = (billData, bill) => {
        const totals = getBillTotal(bill);
        printReceiptUtil({
            store: business,
            currency: business?.currency || 'Rs.',
            billNumber: billData.billNumber || '-',
            date: new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }),
            customerName: bill.customerName || 'Walk-in',
            cashierName: user?.name || '',
            customerBalance: bill.customerBalance || 0,
            items: bill.items.map(item => ({
                name: item.name,
                qty: item.qty,
                price: item.price,
                discountAmount: item.discountAmount || 0,
            })),
            subtotal: totals.subtotal,
            tax: totals.tax,
            itemDiscounts: totals.itemDiscounts,
            billDiscount: totals.billDiscount,
            total: totals.total,
            paymentMethod: billData.paymentMethod,
            amountPaid: billData.amountPaid ?? 0,
            cashGiven: billData.cashGiven || 0,
            change: billData.change || 0,
        });
    };

    const activeBill = bills.find(b => b.id === activeBillId);
    const activeTotal = activeBill ? getBillTotal(activeBill) : { subtotal: 0, tax: 0, total: 0 };
    const activeItemCount = activeBill ? activeBill.items.reduce((sum, item) => sum + item.qty, 0) : 0;
    const effectiveTotal = activeTotal.total;
    const changeAmount = Math.max(0, parseFloat(cashGiven || 0) - effectiveTotal);

    const formatCurrency = (amount) => `Rs. ${(amount || 0).toLocaleString()}`;

    // Search suggestions
    const suggestions = searchQuery.trim().length >= 2
        ? products.filter(p =>
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.barcode?.includes(searchQuery) ||
            p.sku?.includes(searchQuery)
        ).slice(0, 8)
        : [];

    const isBarcodeLike = (value) => /^\d{4,}$/.test(value.trim());

    const handleBarcodeInput = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        setSelectedIndex(0);

        if (value.trim()) {
            const product = productsCache[value.trim()];
            if (product) {
                addProductToBill(product);
                setSearchQuery('');
                setShowSuggestions(false);
                return;
            }
        }

        if (value.trim().length >= 2 && !isBarcodeLike(value)) {
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectSuggestion = (product) => {
        addProductToBill(product);
        setSearchQuery('');
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            setSearchQuery('');
            return;
        }

        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % suggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                selectSuggestion(suggestions[selectedIndex]);
                return;
            }
        }

        if (e.key === 'Enter' && searchQuery.trim()) {
            let product = productsCache[searchQuery.trim()];
            if (!product) {
                product = products.find(p =>
                    p.barcode === searchQuery.trim() ||
                    p.sku === searchQuery.trim() ||
                    p.name?.toLowerCase() === searchQuery.toLowerCase().trim()
                );
            }
            if (product) {
                addProductToBill(product);
                setSearchQuery('');
                setShowSuggestions(false);
            } else if (suggestions.length > 0) {
                selectSuggestion(suggestions[0]);
            } else {
                showToast(`Product not found: ${searchQuery}`);
            }
        }
    };

    // Filter products for Quick Add
    // When "All" is selected, show top selling products
    // When a category is selected, show products from that category
    const filteredQuickAddProducts = selectedCategory === 'All'
        ? topProducts
        : products
            .filter(p => p.category?.toLowerCase() === selectedCategory.toLowerCase())
            .slice(0, 12)
            .map(p => ({
                _id: p._id,
                name: p.name,
                price: p.sellingPrice || p.price,
                category: p.category,
                emoji: p.emoji || '📦',
            }));

    // Target progress
    const target = 5000;
    const progressPercent = Math.min(100, (todayStats.totalSales / target) * 100);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-d-bg animate-fade-slide-up">
            {/* Topbar */}
            <div className="relative z-40 flex items-center gap-4 px-6 py-3 border-b border-slate-200 dark:border-d-border bg-white/70 dark:bg-[rgba(11,14,26,0.7)] backdrop-blur-xl flex-shrink-0">
                {/* Live Badge */}
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-[rgba(52,232,161,0.08)] border border-emerald-200 dark:border-[rgba(52,232,161,0.2)] rounded-full px-3 py-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-d-green animate-live-pulse" />
                    <span className="text-[13px] font-medium text-emerald-600 dark:text-d-green">Live</span>
                </div>

                {/* Today's Stats */}
                <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-d-muted">
                    <span className="font-display text-[17px] font-semibold text-amber-600 dark:text-d-accent tracking-wide">
                        {formatCurrency(todayStats.totalSales)}
                    </span>
                    <span className="text-slate-300 dark:text-d-faint">·</span>
                    <span>{todayStats.transactions} sales today</span>
                </div>

                {/* Customer Picker */}
                <div className="relative ml-auto" ref={customerPickerRef}>
                    {activeBill?.customer ? (
                        <button
                            onClick={() => setShowCustomerPicker((o) => !o)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-d-border bg-white dark:bg-d-glass text-[13px] hover:border-amber-300 dark:hover:border-d-border-hover transition-all"
                        >
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-[rgba(52,232,161,0.15)] flex items-center justify-center">
                                <FiUserCheck className="text-emerald-600 dark:text-d-green" size={12} />
                            </div>
                            <div className="leading-tight text-left">
                                <div className="font-medium text-slate-800 dark:text-d-text">{activeBill.customerName}</div>
                                {activeBill.customerPhone && (
                                    <div className="text-[10px] text-slate-400 dark:text-d-faint">{activeBill.customerPhone}</div>
                                )}
                            </div>
                            <span
                                role="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    detachCustomer();
                                }}
                                className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 dark:text-d-faint hover:bg-red-50 dark:hover:bg-[rgba(255,107,107,0.12)] hover:text-red-500 cursor-pointer"
                                title="Remove customer"
                            >
                                <FiX size={12} />
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowCustomerPicker((o) => !o)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-400 dark:border-d-accent bg-amber-50/40 dark:bg-[rgba(255,185,50,0.05)] text-[13px] text-amber-700 dark:text-d-accent hover:bg-amber-50 dark:hover:bg-[rgba(255,185,50,0.1)] transition-all"
                        >
                            <FiUser size={13} />
                            <span className="font-semibold">Select Customer</span>
                            <FiChevronDown size={12} />
                        </button>
                    )}
                    {showCustomerPicker && (
                        <>
                            <div className="absolute right-0 top-full mt-2 w-[340px] bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl shadow-2xl z-[100] overflow-hidden">
                                <div className="p-3 border-b border-slate-200 dark:border-d-border">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={customerQuery}
                                        onChange={(e) => setCustomerQuery(e.target.value)}
                                        placeholder="Search by name or phone…"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                    />
                                </div>
                                <div className="max-h-[260px] overflow-y-auto dark-scrollbar">
                                    {searchingCustomers && (
                                        <div className="px-4 py-3 text-xs text-slate-400 dark:text-d-faint">Searching…</div>
                                    )}
                                    {!searchingCustomers && customerQuery && customerResults.length === 0 && (
                                        <div className="px-4 py-3 text-xs text-slate-400 dark:text-d-faint">No customers found</div>
                                    )}
                                    {!searchingCustomers && !customerQuery && (
                                        <div className="px-4 py-3 text-xs text-slate-400 dark:text-d-faint">Type to search customers</div>
                                    )}
                                    {customerResults.map((c) => (
                                        <button
                                            key={c._id}
                                            onClick={() => attachCustomer(c)}
                                            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-d-glass border-t border-slate-100 dark:border-[rgba(255,255,255,0.04)] flex items-center justify-between"
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-slate-800 dark:text-d-text">{c.name}</div>
                                                <div className="text-[11px] text-slate-500 dark:text-d-muted">{c.phone}</div>
                                            </div>
                                            {c.balance > 0 && (
                                                <span className="text-[11px] font-medium text-red-500 dark:text-d-red">
                                                    Due {formatCurrency(c.balance)}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-2 border-t border-slate-200 dark:border-d-border bg-slate-50 dark:bg-d-bg">
                                    <button
                                        onClick={() => attachCustomer(null)}
                                        className="w-full px-3 py-2 text-xs text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text"
                                    >
                                        Use Walk-in customer
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Bill Tabs */}
                <div className="flex items-center gap-2">
                    {bills.map((bill) => {
                        const isActive = bill.id === activeBillId;
                        const itemCount = bill.items.reduce((sum, item) => sum + item.qty, 0);
                        return (
                            <div
                                key={bill.id}
                                className={`group flex items-center gap-1 pl-4 pr-2 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                                    isActive
                                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card font-bold shadow-md dark:shadow-[0_4px_16px_rgba(255,185,50,0.35)]'
                                        : 'border border-slate-200 dark:border-d-border text-slate-600 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass hover:text-slate-800 dark:hover:text-d-text'
                                }`}
                                onClick={() => switchBill(bill.id)}
                            >
                                <span>{bill.name}</span>
                                {itemCount > 0 && !isActive && (
                                    <span className="bg-amber-500 dark:bg-d-accent text-white dark:text-d-card text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {itemCount}
                                    </span>
                                )}
                                {bills.length > 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (bill.items.length > 0) {
                                                if (window.confirm(`Cancel ${bill.name} with ${bill.items.length} items?`)) {
                                                    deleteBill(bill.id);
                                                }
                                            } else {
                                                deleteBill(bill.id);
                                            }
                                        }}
                                        className={`ml-1 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all ${
                                            isActive
                                                ? 'hover:bg-[rgba(0,0,0,0.15)] text-white/70 dark:text-d-muted hover:text-white dark:hover:text-d-heading'
                                                : 'opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-[rgba(255,107,107,0.15)] text-slate-400 dark:text-d-muted hover:text-red-500 dark:hover:text-d-red'
                                        }`}
                                        title={`Close ${bill.name}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    <button
                        onClick={createNewBill}
                        className="w-[34px] h-[34px] rounded-lg border border-slate-200 dark:border-d-border bg-slate-50 dark:bg-d-glass text-slate-500 dark:text-d-muted flex items-center justify-center text-lg hover:border-amber-300 dark:hover:border-d-border-hover hover:text-amber-600 dark:hover:text-d-accent hover:bg-amber-50 dark:hover:bg-[rgba(255,210,100,0.12)] transition-all duration-200"
                    >
                        +
                    </button>
                </div>

                {/* Returns */}
                <button
                    onClick={() => navigate('/returns')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-d-border bg-d-glass text-d-muted text-[13px] font-medium hover:bg-[rgba(255,255,255,0.06)] hover:text-d-text transition-all duration-200"
                >
                    <FiCornerUpLeft size={14} />
                    Returns
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Cart Panel (Left) */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Search Box */}
                    <div className="p-5 pb-4">
                        <div className="relative">
                            <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint transition-colors" size={17} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchQuery}
                                onChange={handleBarcodeInput}
                                onKeyDown={handleKeyDown}
                                onFocus={() => searchQuery.length >= 2 && !isBarcodeLike(searchQuery) && setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                placeholder="Scan barcode or type product name..."
                                className="w-full py-4 px-5 pl-14 bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl text-[14px] text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint outline-none focus:border-amber-300 dark:focus:border-d-border-hover focus:bg-amber-50/30 dark:focus:bg-[rgba(255,210,100,0.03)] focus:shadow-[0_0_0_4px_rgba(245,158,11,0.1)] dark:focus:shadow-[0_0_0_4px_rgba(255,185,50,0.07),0_8px_32px_rgba(0,0,0,0.35)] transition-all duration-300"
                                autoFocus
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <span className="text-[10px] text-slate-400 dark:text-d-faint bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border px-2 py-1 rounded">⌘K</span>
                            </div>

                            {/* Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl overflow-hidden z-50 max-h-80 overflow-y-auto shadow-xl">
                                    {suggestions.map((product, index) => {
                                        const outOfStock = product.trackStock && (product.stockQuantity || 0) <= 0;
                                        return (
                                            <div
                                                key={product._id}
                                                onClick={() => !outOfStock && selectSuggestion(product)}
                                                className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-all ${
                                                    index === selectedIndex ? 'bg-amber-50 dark:bg-[rgba(255,210,100,0.08)]' : 'hover:bg-slate-50 dark:hover:bg-d-glass'
                                                } ${outOfStock ? 'opacity-50 cursor-not-allowed' : ''} ${
                                                    index > 0 ? 'border-t border-slate-100 dark:border-[rgba(255,255,255,0.05)]' : ''
                                                }`}
                                            >
                                                <span className="text-2xl">{product.emoji || getProductEmoji(product.category)}</span>
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-slate-800 dark:text-d-text">{product.name}</h4>
                                                    <p className="text-sm text-slate-500 dark:text-d-muted">{formatCurrency(product.sellingPrice || product.price)}</p>
                                                </div>
                                                {!outOfStock && (
                                                    <div className="w-6 h-6 rounded-full bg-amber-500 dark:bg-d-accent text-white dark:text-d-card flex items-center justify-center text-sm">+</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto px-5 pb-4 dark-scrollbar">
                        {activeBill?.items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center pb-10">
                                <div className="w-[100px] h-[100px] rounded-full border-2 border-amber-200 dark:border-[rgba(255,210,100,0.15)] flex items-center justify-center relative animate-spin-ring">
                                    <div className="absolute inset-[-2px] rounded-full border-2 border-transparent border-t-amber-500 dark:border-t-d-accent animate-spin-fast" />
                                    <div className="w-[70px] h-[70px] rounded-full bg-gradient-to-br from-amber-100 dark:from-[rgba(255,210,100,0.1)] to-amber-50 dark:to-[rgba(255,185,50,0.05)] border border-amber-200 dark:border-[rgba(255,210,100,0.12)] flex items-center justify-center text-3xl animate-spin-ring-reverse">
                                        🛒
                                    </div>
                                </div>
                                <h3 className="font-display text-xl font-semibold text-slate-700 dark:text-d-heading mt-6">Cart is empty</h3>
                                <p className="text-[13px] text-slate-500 dark:text-d-muted mt-2 text-center max-w-[210px] leading-relaxed">
                                    Scan a barcode, search by name, or pick from Quick Add →
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeBill?.items.map((item) => {
                                    const expanded = expandedItemId === item._id;
                                    const profitInfo = getItemProfit(activeBill, item);
                                    const hasItemDiscount = (Number(item.discountAmount) || 0) > 0;
                                    const hasBillDiscount = (Number(activeBill.billDiscountAmount) || 0) > 0;
                                    return (
                                        <div
                                            key={item._id}
                                            className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl animate-pop-in hover:border-amber-400 dark:hover:border-d-border-hover hover:bg-amber-50 dark:hover:bg-[rgba(255,210,100,0.03)] transition-all duration-200 relative overflow-hidden shadow-sm"
                                            style={{ '--item-color': item.category === 'Drinks' ? '#5b9cf6' : '#f59e0b' }}
                                        >
                                            <div className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l bg-[var(--item-color,#f59e0b)] dark:bg-[var(--item-color,#ffd264)]" />
                                            <div
                                                onClick={() => setExpandedItemId(expanded ? null : item._id)}
                                                className="flex items-center gap-4 p-4 cursor-pointer"
                                            >
                                                <span className="text-2xl flex-shrink-0">{item.emoji || '📦'}</span>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-[14px] text-slate-800 dark:text-d-text truncate">{item.name}</h4>
                                                    <p className="text-[11px] text-slate-500 dark:text-d-muted tracking-wide">
                                                        {item._id?.slice(-4)} · {formatCurrency(item.price)} each
                                                        {hasItemDiscount && (
                                                            <span className="ml-2 text-emerald-500 dark:text-d-green">
                                                                − {formatCurrency(item.discountAmount)} off
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => updateQuantity(item._id, -1)}
                                                        className="w-7 h-7 rounded-lg border border-slate-300 dark:border-d-border bg-slate-100 dark:bg-d-glass text-slate-700 dark:text-d-text flex items-center justify-center hover:border-amber-400 dark:hover:border-d-border-hover hover:text-amber-600 dark:hover:text-d-accent hover:bg-amber-100 dark:hover:bg-[rgba(255,210,100,0.12)] transition-all"
                                                    >
                                                        −
                                                    </button>
                                                    <span className="font-display font-semibold text-base min-w-[22px] text-center text-slate-800 dark:text-d-text">{item.qty}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item._id, 1)}
                                                        className="w-7 h-7 rounded-lg border border-slate-300 dark:border-d-border bg-slate-100 dark:bg-d-glass text-slate-700 dark:text-d-text flex items-center justify-center hover:border-amber-400 dark:hover:border-d-border-hover hover:text-amber-600 dark:hover:text-d-accent hover:bg-amber-100 dark:hover:bg-[rgba(255,210,100,0.12)] transition-all"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <span className="font-display text-[15px] font-semibold text-amber-600 dark:text-d-accent min-w-[80px] text-right">
                                                    {formatCurrency(profitInfo.lineAfterItemDiscount)}
                                                </span>
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => removeItem(item._id)}
                                                        className="text-slate-400 dark:text-d-faint hover:text-red-500 dark:hover:text-d-red transition-colors text-lg p-1"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>

                                            {expanded && (
                                                <div className="px-4 pb-4 pt-0 border-t border-slate-100 dark:border-[rgba(255,255,255,0.05)] animate-fade-slide-up">
                                                    <div className="grid grid-cols-4 gap-3 mt-3 mb-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Cost</div>
                                                            <div className="text-[13px] font-semibold text-slate-700 dark:text-d-text">{formatCurrency(item.costPrice || 0)}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Sell</div>
                                                            <div className="text-[13px] font-semibold text-slate-700 dark:text-d-text">{formatCurrency(item.price)}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Profit</div>
                                                            <div className={`text-[13px] font-semibold ${profitInfo.profit >= 0 ? 'text-emerald-500 dark:text-d-green' : 'text-red-500 dark:text-d-red'}`}>
                                                                {formatCurrency(profitInfo.profit)}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Margin</div>
                                                            <div className={`text-[13px] font-semibold ${profitInfo.margin >= 0 ? 'text-emerald-500 dark:text-d-green' : 'text-red-500 dark:text-d-red'}`}>
                                                                {profitInfo.margin.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[11px] text-slate-500 dark:text-d-muted flex-shrink-0">Discount (Rs)</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.discountAmount || ''}
                                                            onChange={(e) => setItemDiscount(item._id, e.target.value)}
                                                            disabled={hasBillDiscount}
                                                            placeholder="0"
                                                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                        {hasBillDiscount && (
                                                            <span className="text-[10px] text-slate-400 dark:text-d-faint">
                                                                Bill-level discount active
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Add Panel (Right) */}
                <div className="w-[270px] border-l border-slate-200 dark:border-d-border flex flex-col bg-slate-50/50 dark:bg-[rgba(10,11,18,0.4)] backdrop-blur-lg flex-shrink-0 animate-fade-slide-right">
                    {/* Header */}
                    <div className="p-5 pb-3 border-b border-slate-200 dark:border-d-border">
                        <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400 dark:text-d-faint mb-3">Quick Add</h3>
                        <div className="flex flex-wrap gap-1">
                            {categories.slice(0, 4).map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 ${
                                        selectedCategory === cat
                                            ? 'bg-amber-100 dark:bg-[rgba(255,210,100,0.12)] border-amber-300 dark:border-d-border-hover text-amber-600 dark:text-d-accent'
                                            : 'border-slate-200 dark:border-d-border text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass hover:text-slate-700 dark:hover:text-d-text'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 auto-rows-min dark-scrollbar">
                        {filteredQuickAddProducts.map((product) => (
                            <div
                                key={product._id || product.name}
                                onClick={() => {
                                    // Try to find by ID first, then by name as fallback
                                    const fullProduct = products.find(p => p._id === product._id)
                                        || products.find(p => p.name === product.name)
                                        || product;
                                    // Skip if no valid _id (can't track stock properly)
                                    if (!fullProduct._id || fullProduct._id === fullProduct.name) {
                                        showToast('Product not found in inventory');
                                        return;
                                    }
                                    addProductToBill(fullProduct);
                                }}
                                className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl p-3 cursor-pointer flex flex-col gap-2 transition-all duration-200 hover:border-amber-300 dark:hover:border-d-border-hover hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-100/50 dark:from-[rgba(255,210,100,0.08)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-2xl">{product.emoji || getProductEmoji(product.category)}</span>
                                <span className="text-[12px] font-medium text-slate-700 dark:text-d-text leading-tight">{product.name}</span>
                                <span className="font-display text-[13px] font-semibold text-amber-600 dark:text-d-accent">{formatCurrency(product.price)}</span>
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 dark:bg-d-accent text-white dark:text-d-card flex items-center justify-center text-xs opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200">
                                    +
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stats Strip */}
                    <div className="p-4 border-t border-slate-200 dark:border-d-border bg-white/50 dark:bg-[rgba(11,14,26,0.5)]">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] text-slate-500 dark:text-d-muted">Today's Revenue</span>
                            <span className="font-display text-[14px] font-semibold text-amber-600 dark:text-d-accent">{formatCurrency(todayStats.totalSales)}</span>
                        </div>
                        <div className="h-1 bg-slate-200 dark:bg-d-faint rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s transition-all duration-700"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-500 dark:text-d-muted">Target: {formatCurrency(target)}</span>
                            <span className="font-display text-[12px] font-semibold text-emerald-500 dark:text-d-green">{progressPercent.toFixed(0)}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cart Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-d-border bg-white/80 dark:bg-[rgba(11,14,26,0.6)] backdrop-blur-lg flex-shrink-0">

                {/* Totals */}
                <div className="flex flex-col gap-2 mb-4">
                    <div className="flex justify-between text-[13px]">
                        <span className="text-slate-500 dark:text-d-muted">Subtotal ({activeItemCount} items)</span>
                        <span className="font-medium text-slate-700 dark:text-d-text">{formatCurrency(activeTotal.gross)}</span>
                    </div>

                    {activeTotal.itemDiscounts > 0 && (
                        <div className="flex justify-between text-[13px]">
                            <span className="text-slate-500 dark:text-d-muted">Item discounts</span>
                            <span className="text-emerald-500 dark:text-d-green">— {formatCurrency(activeTotal.itemDiscounts)}</span>
                        </div>
                    )}

                    {/* Bill-level discount input */}
                    <div className="flex justify-between items-center text-[13px]">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-d-muted">
                            <FiPercent size={12} />
                            <span>Bill discount</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={activeBill?.billDiscountAmount || ''}
                                onChange={(e) => setBillDiscount(e.target.value, activeBill?.billDiscountReason || '')}
                                disabled={activeTotal.itemDiscounts > 0 || !activeBill || activeBill.items.length === 0}
                                placeholder="0"
                                className="w-20 px-2 py-1 text-right bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            {activeTotal.billDiscount > 0 && (
                                <span className="text-emerald-500 dark:text-d-green text-[11px] min-w-[55px] text-right">
                                    — {formatCurrency(activeTotal.billDiscount)}
                                </span>
                            )}
                        </div>
                    </div>

                    {activeTotal.itemDiscounts > 0 && (
                        <div className="text-[10px] text-slate-400 dark:text-d-faint italic">
                            Bill discount disabled — clear item discounts to use it
                        </div>
                    )}

                    {activeTotal.billDiscount > 0 && (
                        <input
                            type="text"
                            value={activeBill?.billDiscountReason || ''}
                            onChange={(e) => setBillDiscount(activeBill?.billDiscountAmount || 0, e.target.value)}
                            placeholder="Discount reason (optional)"
                            className="px-2 py-1 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-[11px] text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                        />
                    )}

                    {activeTotal.tax > 0 && (
                        <div className="flex justify-between text-[13px]">
                            <span className="text-slate-500 dark:text-d-muted">Tax</span>
                            <span className="text-slate-700 dark:text-d-text">{formatCurrency(activeTotal.tax)}</span>
                        </div>
                    )}

                    {activeBill && activeBill.items.length > 0 && (
                        <div className="flex justify-between text-[13px]">
                            <span className="text-slate-500 dark:text-d-muted">Bill profit</span>
                            <span className={`font-medium ${activeTotal.billProfit >= 0 ? 'text-emerald-500 dark:text-d-green' : 'text-red-500 dark:text-d-red'}`}>
                                {formatCurrency(activeTotal.billProfit)}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between items-end pt-3 mt-1 border-t border-slate-200 dark:border-d-border">
                        <span className="font-display text-[15px] font-semibold text-slate-800 dark:text-d-text">Total</span>
                        <span className="font-display text-[28px] font-bold text-amber-600 dark:text-d-accent leading-none tracking-tight">{formatCurrency(effectiveTotal)}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => { setShowPaymentModal(true); setPaymentMethod('cash'); setCashGiven(''); setCreditPaidNow(''); }}
                        disabled={!activeBill || activeBill.items.length === 0}
                        className="flex-[2] py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card font-bold text-[14px] flex items-center justify-center gap-2 shadow-md dark:shadow-[0_6px_24px_rgba(255,185,50,0.3)] hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-[0_10px_36px_rgba(255,185,50,0.45)] active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                    >
                        <div className="absolute top-[-50%] left-[-60%] w-[40%] h-[200%] bg-[rgba(255,255,255,0.15)] transform skew-x-[-20deg] group-hover:left-[160%] transition-all duration-500" />
                        <FiShoppingCart size={15} />
                        Pay · {formatCurrency(effectiveTotal)}
                        <span className="text-[10px] opacity-65 font-normal">Ctrl+0</span>
                    </button>
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-[rgba(255,255,255,0.1)] rounded-2xl p-6 w-full max-w-md animate-pop-in shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-d-text">Payment</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-[rgba(255,255,255,0.05)] rounded-lg text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text transition-colors">
                                <FiX size={20} />
                            </button>
                        </div>

                        <div className="text-center mb-6 p-4 bg-amber-50 dark:bg-[rgba(255,210,100,0.05)] border border-amber-200 dark:border-[rgba(255,210,100,0.1)] rounded-xl">
                            <p className="text-sm text-slate-500 dark:text-d-muted mb-1">Total Amount</p>
                            <p className="font-display text-3xl font-bold text-amber-600 dark:text-d-accent">{formatCurrency(effectiveTotal)}</p>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm font-medium text-slate-500 dark:text-d-muted mb-2">Payment Method</p>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { id: 'cash', label: 'Cash', icon: FiDollarSign },
                                    { id: 'card', label: 'Card', icon: FiCreditCard },
                                    { id: 'upi', label: 'UPI', icon: FiSmartphone },
                                    { id: 'credit', label: 'Credit', icon: FiUser },
                                ].map((method) => {
                                    const creditDisabled = method.id === 'credit' && !activeBill?.customer;
                                    return (
                                        <button
                                            key={method.id}
                                            onClick={() => !creditDisabled && setPaymentMethod(method.id)}
                                            disabled={creditDisabled}
                                            title={creditDisabled ? 'Attach a customer to enable credit' : ''}
                                            className={`py-3 rounded-xl font-medium flex items-center justify-center gap-1.5 text-sm transition-all ${
                                                paymentMethod === method.id
                                                    ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card'
                                                    : creditDisabled
                                                        ? 'bg-slate-50 dark:bg-[rgba(255,255,255,0.02)] border border-slate-200 dark:border-d-border text-slate-300 dark:text-d-faint cursor-not-allowed'
                                                        : 'bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border text-slate-600 dark:text-d-muted hover:bg-slate-200 dark:hover:bg-d-glass-hover'
                                            }`}
                                        >
                                            <method.icon size={16} />
                                            {method.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {paymentMethod === 'credit' && !activeBill?.customer && (
                                <p className="text-xs text-red-500 dark:text-d-red mt-2">
                                    Attach a customer first to use credit.
                                </p>
                            )}
                        </div>

                        {paymentMethod === 'credit' && activeBill?.customer && (
                            <div className="mb-6">
                                <label className="text-sm font-medium text-slate-500 dark:text-d-muted mb-2 block">Amount Paid Now (optional)</label>
                                <input
                                    type="number"
                                    value={creditPaidNow}
                                    onChange={(e) => setCreditPaidNow(e.target.value)}
                                    placeholder="0 — leave empty for full credit"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border rounded-xl text-lg text-slate-800 dark:text-d-text focus:border-amber-400 dark:focus:border-d-border-hover focus:bg-amber-50 dark:focus:bg-[rgba(255,210,100,0.03)] outline-none transition-all"
                                />
                                {(() => {
                                    const paid = Math.max(0, Math.min(parseFloat(creditPaidNow || 0), effectiveTotal));
                                    const due = effectiveTotal - paid;
                                    return (
                                        <div className="mt-3 p-4 bg-amber-50 dark:bg-[rgba(255,185,50,0.08)] border border-amber-200 dark:border-[rgba(255,185,50,0.2)] rounded-xl space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500 dark:text-d-muted">Paid now</span>
                                                <span className="font-semibold text-slate-800 dark:text-d-text">{formatCurrency(paid)}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-2 border-t border-amber-200 dark:border-[rgba(255,185,50,0.15)]">
                                                <span className="text-sm text-amber-700 dark:text-d-accent font-medium">
                                                    Added to {activeBill.customerName}'s balance
                                                </span>
                                                <span className="font-display text-xl font-bold text-amber-600 dark:text-d-accent">{formatCurrency(due)}</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {paymentMethod === 'cash' && (
                            <div className="mb-6">
                                <label className="text-sm font-medium text-slate-500 dark:text-d-muted mb-2 block">Cash Received</label>
                                <input
                                    ref={cashInputRef}
                                    type="number"
                                    value={cashGiven}
                                    onChange={(e) => setCashGiven(e.target.value)}
                                    placeholder="Enter amount..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-d-border rounded-xl text-lg text-slate-800 dark:text-d-text focus:border-amber-400 dark:focus:border-d-border-hover focus:bg-amber-50 dark:focus:bg-[rgba(255,210,100,0.03)] outline-none transition-all"
                                />

                                <div className="flex gap-2 mt-2">
                                    {[effectiveTotal, Math.ceil(effectiveTotal / 100) * 100, Math.ceil(effectiveTotal / 500) * 500, Math.ceil(effectiveTotal / 1000) * 1000].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).map((amount) => (
                                        <button
                                            key={amount}
                                            onClick={() => setCashGiven(amount.toString())}
                                            className="flex-1 py-2 bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] text-slate-600 dark:text-d-muted rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-d-glass-hover transition-colors"
                                        >
                                            {amount.toLocaleString()}
                                        </button>
                                    ))}
                                </div>

                                {parseFloat(cashGiven || 0) >= effectiveTotal && (
                                    <div className="mt-4 p-4 bg-emerald-50 dark:bg-[rgba(52,232,161,0.1)] border border-emerald-200 dark:border-[rgba(52,232,161,0.2)] rounded-xl">
                                        <div className="flex justify-between items-center">
                                            <span className="text-emerald-600 dark:text-d-green font-medium">Change to Return</span>
                                            <span className="font-display text-2xl font-bold text-emerald-600 dark:text-d-green">{formatCurrency(changeAmount)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => handleCheckout()}
                            disabled={
                                processing ||
                                (paymentMethod === 'cash' && parseFloat(cashGiven || 0) < effectiveTotal) ||
                                (paymentMethod === 'credit' && !activeBill?.customer)
                            }
                            className="w-full py-4 bg-emerald-500 dark:bg-d-green text-white dark:text-d-card font-bold rounded-xl hover:shadow-[0_4px_20px_rgba(52,232,161,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {processing ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white dark:border-d-card border-t-transparent rounded-full animate-spin" />
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

            {/* Walk-in Confirmation Modal */}
            {showWalkInConfirm && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[200] backdrop-blur-sm">
                    <div className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-[rgba(255,255,255,0.1)] rounded-2xl p-6 w-full max-w-md animate-pop-in shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-[rgba(255,185,50,0.15)] flex items-center justify-center">
                                <FiUser className="text-amber-600 dark:text-d-accent" size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-d-text">Walk-in Customer</h3>
                                <p className="text-xs text-slate-500 dark:text-d-muted">No customer attached to this bill</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-d-muted leading-relaxed mb-5">
                            This bill will <span className="font-semibold text-slate-800 dark:text-d-text">not be added to any customer ledger</span>. You won't be able to track this sale against a specific customer later.
                            <br /><br />
                            Are you sure you want to continue?
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    setShowWalkInConfirm(false);
                                    handleCheckout(true);
                                }}
                                className="w-full py-3 bg-emerald-500 dark:bg-d-green text-white dark:text-d-card font-semibold rounded-xl hover:shadow-[0_4px_20px_rgba(52,232,161,0.3)] transition-all"
                            >
                                Yes, continue as Walk-in
                            </button>
                            <button
                                onClick={() => {
                                    setShowWalkInConfirm(false);
                                    setShowCustomerPicker(true);
                                }}
                                className="w-full py-3 border-2 border-amber-400 dark:border-d-accent text-amber-700 dark:text-d-accent font-semibold rounded-xl hover:bg-amber-50 dark:hover:bg-[rgba(255,185,50,0.1)] transition-all"
                            >
                                Attach a Customer
                            </button>
                            <button
                                onClick={() => setShowWalkInConfirm(false)}
                                className="w-full py-2 text-sm text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-d-elevated border border-emerald-200 dark:border-[rgba(52,232,161,0.2)] rounded-2xl p-8 text-center animate-pop-in w-96 shadow-2xl">
                        <div className="w-20 h-20 bg-emerald-50 dark:bg-[rgba(52,232,161,0.1)] rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiCheck size={40} className="text-emerald-500 dark:text-d-green" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-d-text mb-2">Sale Complete!</h3>
                        {successData && (
                            <div className="text-left bg-slate-50 dark:bg-[rgba(255,255,255,0.03)] rounded-xl p-4 mt-4 space-y-2">
                                {successData.billNumber && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-d-muted">Bill #</span>
                                        <span className="font-medium text-slate-800 dark:text-d-text">{successData.billNumber}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 dark:text-d-muted">Total</span>
                                    <span className="font-medium text-slate-800 dark:text-d-text">{formatCurrency(successData.total)}</span>
                                </div>
                                {successData.paymentMethod === 'cash' && successData.change > 0 && (
                                    <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-[rgba(255,255,255,0.05)] text-emerald-600 dark:text-d-green font-medium">
                                        <span>Change</span>
                                        <span>{formatCurrency(successData.change)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => { setShowSuccess(false); setSuccessData(null); }}
                                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] text-slate-600 dark:text-d-muted text-sm font-medium hover:bg-slate-200 dark:hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                            >
                                Close
                            </button>
                            {successData?.bill && (
                                <button
                                    onClick={() => printReceipt(successData, successData.bill)}
                                    className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                                >
                                    <FiPrinter size={16} />
                                    Print Receipt
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            <div className={`fixed bottom-7 left-1/2 -translate-x-1/2 bg-white dark:bg-gradient-to-r dark:from-d-elevated dark:to-d-card border border-amber-300 dark:border-[rgba(255,210,100,0.3)] text-slate-800 dark:text-d-text text-[13px] font-medium px-6 py-3 rounded-full shadow-lg dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex items-center gap-2 transition-all duration-300 z-[999] ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <span className="text-base">{toast.icon}</span>
                <span>{toast.message}</span>
            </div>
        </div>
    );
};

// ==================== ADMIN DASHBOARD ====================
const AdminDashboard = () => {
    const navigate = useNavigate();
    const { business } = useBusiness();
    const [timeFilter, setTimeFilter] = useState('today');
    const [stats, setStats] = useState({ totalSales: 0, totalOrders: 0, avgOrderValue: 0, growth: 0 });
    const [profitLoss, setProfitLoss] = useState({ grossRevenue: 0, returns: 0, netRevenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, profitMargin: 0 });
    const [chartData, setChartData] = useState([]);
    const [peakData, setPeakData] = useState({ value: 0, time: '' });
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showDetail, setShowDetail] = useState(null);

    // Product intelligence
    const [topSellingProducts, setTopSellingProducts] = useState([]);
    const [salesByProductData, setSalesByProductData] = useState([]);
    const [deadStockData, setDeadStockData] = useState({ products: [], summary: {} });
    const [lowStockData, setLowStockData] = useState([]);
    const [cashInHand, setCashInHand] = useState(0);
    const [insightsLoading, setInsightsLoading] = useState(true);

    // Employee & Payment data
    const [cashierData, setCashierData] = useState([]);
    const [employeeList, setEmployeeList] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [supplyStats, setSupplyStats] = useState(null);

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch financial data on filter change
    useEffect(() => {
        fetchDashboardData();
    }, [timeFilter]);

    // Fetch product intelligence once on mount
    useEffect(() => {
        fetchInsights();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const now = new Date();
            let startDate = new Date();
            switch (timeFilter) {
                case 'today': startDate.setHours(0, 0, 0, 0); break;
                case 'week': startDate.setDate(now.getDate() - 7); break;
                case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
            }

            const dateParams = { startDate: startDate.toISOString(), endDate: now.toISOString() };

            const [statsRes, expensesRes, salesByProdRes, cashierRes, payMethodRes] = await Promise.all([
                getReceiptStats({ filter: timeFilter, chart: 'true' }),
                getApprovedExpenses({ status: 'approved' }).catch(() => ({ data: [] })),
                getSalesByProduct(dateParams).catch(() => ({ data: { products: [] } })),
                getSalesByCashier(dateParams).catch(() => ({ data: { cashiers: [] } })),
                getPaymentMethodReport(dateParams).catch(() => ({ data: { methods: [] } })),
            ]);

            const backendStats = statsRes.data;

            const allExpenses = Array.isArray(expensesRes.data) ? expensesRes.data : expensesRes.data?.expenses || [];
            const periodExpenses = allExpenses.filter(e => new Date(e.date || e.createdAt) >= startDate);
            const expenses = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

            const linkedReturns = backendStats.linkedReturns || 0;
            const standaloneRefunds = backendStats.standaloneRefunds || 0;
            const returns = linkedReturns + standaloneRefunds;
            const cogs = backendStats.adjustedCogs ?? backendStats.totalCost ?? 0;
            const netRevenue = backendStats.netRevenue || 0;
            const grossProfit = netRevenue - cogs;
            const netProfit = grossProfit - expenses;
            const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

            setStats({
                totalSales: backendStats.grossRevenue,
                totalOrders: backendStats.totalOrders,
                avgOrderValue: backendStats.avgOrderValue,
                growth: backendStats.growth
            });

            setProfitLoss({
                grossRevenue: backendStats.grossRevenue,
                returns,
                linkedReturns,
                standaloneRefunds,
                netRevenue: netRevenue,
                cogs,
                grossProfit,
                expenses,
                netProfit,
                profitMargin
            });

            setSalesByProductData(salesByProdRes.data?.products || []);
            setCashierData(cashierRes.data?.cashiers || []);
            setPaymentMethods(payMethodRes.data?.methods || payMethodRes.data || []);
            generateChartDataFromStats(backendStats.chartData || [], startDate, now, timeFilter);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInsights = async () => {
        setInsightsLoading(true);
        try {
            const [topRes, deadRes, lowRes, cashRes, empRes, supplyStatsRes] = await Promise.all([
                getTopProducts(10).catch(() => ({ data: [] })),
                getDeadStock(30).catch(() => ({ data: { deadStock: [], summary: {} } })),
                getLowStockProducts().catch(() => ({ data: [] })),
                getCashBalance().catch(() => ({ data: { balance: 0 } })),
                getEmployees().catch(() => ({ data: [] })),
                getSupplyStats().catch(() => ({ data: null })),
            ]);
            setTopSellingProducts(Array.isArray(topRes.data) ? topRes.data : []);
            setDeadStockData({
                products: deadRes.data?.deadStock || [],
                summary: deadRes.data?.summary || {},
            });
            setLowStockData(Array.isArray(lowRes.data) ? lowRes.data : []);
            setCashInHand(cashRes.data?.balance ?? 0);
            setEmployeeList(Array.isArray(empRes.data) ? empRes.data : empRes.data?.employees || []);
            setSupplyStats(supplyStatsRes.data || null);
        } catch (error) {
            console.error('Error fetching insights:', error);
        } finally {
            setInsightsLoading(false);
        }
    };

    const generateChartDataFromStats = (chartItems, startDate, _endDate, filter) => {
        const dataMap = {};
        chartItems.forEach(item => {
            dataMap[item._id] = { revenue: item.revenue, orders: item.orders };
        });

        const data = [];
        let maxSales = 0;
        let maxTime = '';

        if (filter === 'today') {
            for (let h = 0; h < 24; h++) {
                const sales = dataMap[h]?.revenue || 0;
                const orders = dataMap[h]?.orders || 0;
                data.push({ name: `${h}:00`, sales, orders });
                if (sales > maxSales) { maxSales = sales; maxTime = `${h}:00`; }
            }
        } else if (filter === 'week') {
            for (let i = 0; i < 7; i++) {
                const day = new Date(startDate);
                day.setDate(startDate.getDate() + i);
                const key = toLocalDateStr(day);
                const dayName = day.toLocaleDateString('en', { weekday: 'short' });
                const sales = dataMap[key]?.revenue || 0;
                const orders = dataMap[key]?.orders || 0;
                data.push({ name: dayName, sales, orders });
                if (sales > maxSales) { maxSales = sales; maxTime = dayName; }
            }
        } else {
            for (let w = 0; w < 5; w++) {
                const ws = new Date(startDate);
                ws.setDate(startDate.getDate() + w * 7);
                const we = new Date(ws);
                we.setDate(ws.getDate() + 7);
                let weekSales = 0, weekOrders = 0;
                Object.entries(dataMap).forEach(([key, val]) => {
                    const d = new Date(key);
                    if (d >= ws && d < we) { weekSales += val.revenue; weekOrders += val.orders; }
                });
                data.push({ name: `W${w + 1}`, sales: weekSales, orders: weekOrders });
                if (weekSales > maxSales) { maxSales = weekSales; maxTime = `W${w + 1}`; }
            }
        }
        setChartData(data);
        setPeakData({ value: maxSales, time: maxTime });
    };

    // Derived: best margin products
    const bestMarginProducts = useMemo(() => {
        return salesByProductData
            .filter(p => p.transactionCount >= 2 && p.netRevenue > 0)
            .map(p => ({ ...p, margin: (p.totalProfit / p.netRevenue) * 100 }))
            .sort((a, b) => b.margin - a.margin)
            .slice(0, 5);
    }, [salesByProductData]);

    // Derived: peak insights from chart data
    const peakInsights = useMemo(() => {
        if (!chartData.length) return [];
        const sorted = [...chartData].filter(d => d.sales > 0).sort((a, b) => b.sales - a.sales);
        return sorted.slice(0, 3);
    }, [chartData]);

    const formatCurrency = (amount) => (amount || 0).toLocaleString();
    const formatCurrencyShort = (amount) => {
        const num = amount || 0;
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toLocaleString();
    };

    const currency = business?.currency || 'Rs.';

    // Detail Popup
    const detailPopupData = useMemo(() => ({
        grossRevenue: {
            title: 'Gross Revenue Calculation',
            items: [
                { label: 'Total Sales', value: stats.totalSales, color: '#34e8a1' },
                { label: 'Number of Orders', value: `${stats.totalOrders} orders`, isText: true },
                { label: 'Average Order', value: stats.avgOrderValue, color: '#5b9cf6' },
            ],
            formula: 'Sum of all receipt totals (excluding refunds)'
        },
        netProfit: {
            title: 'Net Profit Calculation',
            items: [
                { label: 'Gross Revenue', value: profitLoss.grossRevenue, color: '#34e8a1', sign: '' },
                { label: 'Bill Returns', value: profitLoss.linkedReturns, color: '#ff6b6b', sign: '\u2212', sub: true },
                { label: 'Standalone Refunds', value: profitLoss.standaloneRefunds, color: '#ff9f43', sign: '\u2212', sub: true },
                { label: 'Total Returns', value: profitLoss.returns, color: '#ff6b6b', sign: '\u2212' },
                { label: 'Net Revenue', value: profitLoss.netRevenue, color: '#5b9cf6', sign: '=' },
                { label: 'Cost of Goods', value: profitLoss.cogs, color: '#ff6b6b', sign: '\u2212' },
                { label: 'Gross Profit', value: profitLoss.grossProfit, color: '#ffd264', sign: '=' },
                { label: 'Expenses', value: profitLoss.expenses, color: '#ff6b6b', sign: '\u2212' },
                { label: 'Net Profit', value: profitLoss.netProfit, color: profitLoss.netProfit >= 0 ? '#34e8a1' : '#ff6b6b', sign: '=', isBold: true },
            ],
            formula: 'Revenue \u2212 (Bill Returns + Standalone Refunds) \u2212 COGS \u2212 Expenses = Net Profit'
        },
        cogs: {
            title: 'Cost of Goods Sold',
            items: [
                { label: 'Total COGS', value: profitLoss.cogs, color: '#ff6b6b' },
                { label: 'As % of Revenue', value: `${profitLoss.grossRevenue > 0 ? ((profitLoss.cogs / profitLoss.grossRevenue) * 100).toFixed(1) : 0}%`, isText: true },
            ],
            formula: 'Sum of (costPrice \u00d7 quantity) for all sold items'
        },
        avgOrder: {
            title: 'Average Order Value',
            items: [
                { label: 'Gross Revenue', value: stats.totalSales, color: '#34e8a1' },
                { label: 'Total Orders', value: `${stats.totalOrders} orders`, isText: true },
                { label: 'Avg Order Value', value: stats.avgOrderValue, color: '#ffd264', isBold: true },
            ],
            formula: 'Gross Revenue \u00f7 Number of Orders'
        },
    }), [stats, profitLoss]);

    const renderDetailPopup = () => {
        if (!showDetail) return null;
        const detail = detailPopupData[showDetail];
        if (!detail) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowDetail(null)}>
                <div className="bg-[#0d0f17] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 min-w-[320px] max-w-[400px] shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ animation: 'popIn 0.2s ease-out forwards' }}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bebas text-xl tracking-wide text-d-heading">{detail.title}</h3>
                        <button onClick={() => setShowDetail(null)} className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-d-muted hover:text-white transition-colors">&times;</button>
                    </div>
                    <div className="space-y-3 mb-4">
                        {detail.items.map((item, idx) => (
                            <div key={idx} className={`flex items-center justify-between ${item.sub ? 'py-1 pl-6 opacity-70' : 'py-2'} ${item.isBold ? 'border-t border-[rgba(255,255,255,0.1)] pt-3' : ''}`}>
                                <span className={`${item.sub ? 'text-xs' : 'text-sm'} text-d-muted flex items-center gap-2`}>
                                    {item.sign && <span className="text-d-muted font-mono">{item.sign}</span>}
                                    {item.label}
                                </span>
                                <span className={`font-bebas ${item.sub ? 'text-base' : 'text-lg'} ${item.isBold ? 'text-xl' : ''}`} style={{ color: item.color || '#fef9ec' }}>
                                    {item.isText ? item.value : `${currency} ${formatCurrency(item.value)}`}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="bg-[rgba(255,210,100,0.05)] border border-[rgba(255,210,100,0.15)] rounded-lg p-3">
                        <p className="text-[11px] text-d-muted font-mono-dm"><span className="text-d-accent">Formula:</span> {detail.formula}</p>
                    </div>
                </div>
            </div>
        );
    };

    const formatDate = (date) => date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    const formatTime = (date) => date.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-d-bg grain-overlay">
            {/* Topbar */}
            <div className="flex items-center gap-4 px-7 py-3 border-b border-slate-200 dark:border-[rgba(255,255,255,0.06)] backdrop-blur-xl bg-white/80 dark:bg-[rgba(7,8,13,0.65)] flex-shrink-0">
                <div>
                    <h1 className="font-bebas text-[26px] tracking-[0.08em] text-slate-800 dark:text-d-heading leading-none">DASHBOARD</h1>
                    <p className="font-mono-dm text-[10px] text-slate-500 dark:text-d-faint tracking-[0.06em] mt-0.5">
                        {formatDate(currentTime)} &middot; {formatTime(currentTime)}
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-[rgba(52,232,161,0.07)] border border-[rgba(52,232,161,0.2)] rounded-full px-3 py-1 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-d-green shadow-[0_0_8px_#34e8a1] animate-blink" />
                    <span className="font-mono-dm text-[10px] font-medium text-d-green tracking-[0.06em]">LIVE</span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <span className="text-sm text-slate-500 dark:text-d-muted">
                        Welcome back, <span className="text-amber-600 dark:text-d-accent font-semibold">{business?.name || 'Store'}</span>
                    </span>
                    <div className="flex bg-slate-100 dark:bg-[#0d0f17] border border-slate-200 dark:border-[rgba(255,255,255,0.06)] rounded-xl p-1 gap-0.5">
                        {['today', 'week', 'month'].map((f) => (
                            <button key={f} onClick={() => setTimeFilter(f)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-[0.03em] transition-all duration-200 ${
                                    timeFilter === f
                                        ? 'bg-gradient-to-r from-d-accent to-d-accent-s text-d-bg shadow-[0_4px_16px_rgba(255,185,50,0.3)]'
                                        : 'text-slate-500 dark:text-d-muted hover:text-slate-800 dark:hover:text-[#f0f2f8] hover:bg-slate-200/50 dark:hover:bg-d-glass'
                                }`}
                            >
                                {f === 'today' ? 'Today' : f === 'week' ? 'Week' : 'Month'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 dark-scrollbar">

                {/* ─── ROW 1: KPI Cards ─── */}
                <div className="grid grid-cols-5 gap-2.5">
                    {/* Gross Revenue */}
                    <div onClick={() => setShowDetail('grossRevenue')} className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-3.5 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] cursor-pointer hover:border-[rgba(255,210,100,0.22)] transition-all">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-accent shadow-[0_0_6px_#ffd264]" />
                            <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-slate-500 dark:text-d-faint">Revenue</span>
                        </div>
                        <div className="font-bebas text-[28px] leading-none text-amber-600 dark:text-d-accent">{currency} {formatCurrency(stats.totalSales)}</div>
                        <div className={`inline-flex items-center gap-1 font-mono-dm text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-1.5 ${
                            stats.growth >= 0 ? 'bg-[rgba(52,232,161,0.1)] text-d-green border border-[rgba(52,232,161,0.2)]' : 'bg-[rgba(255,107,107,0.09)] text-d-red border border-[rgba(255,107,107,0.18)]'
                        }`}>
                            {stats.growth >= 0 ? '\u2191' : '\u2193'} {Math.abs(stats.growth).toFixed(1)}%
                        </div>
                    </div>

                    {/* Net Profit */}
                    <div onClick={() => setShowDetail('netProfit')} className="bg-[rgba(52,232,161,0.04)] rounded-xl p-3.5 border border-[rgba(52,232,161,0.12)] cursor-pointer hover:border-[rgba(52,232,161,0.22)] transition-all">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-green shadow-[0_0_6px_#34e8a1]" />
                            <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-slate-500 dark:text-d-faint">Net Profit</span>
                        </div>
                        <div className={`font-bebas text-[28px] leading-none ${profitLoss.netProfit >= 0 ? 'text-d-green' : 'text-d-red'}`}>
                            {currency} {formatCurrency(Math.abs(profitLoss.netProfit))}
                        </div>
                        <div className={`inline-flex items-center font-mono-dm text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-1.5 ${
                            profitLoss.netProfit >= 0 ? 'bg-[rgba(52,232,161,0.1)] text-d-green border border-[rgba(52,232,161,0.2)]' : 'bg-[rgba(255,107,107,0.09)] text-d-red border border-[rgba(255,107,107,0.18)]'
                        }`}>
                            {profitLoss.profitMargin.toFixed(0)}% margin
                        </div>
                    </div>

                    {/* Total Orders */}
                    <div className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-3.5 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-blue" />
                            <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-slate-500 dark:text-d-faint">Orders</span>
                        </div>
                        <div className="font-bebas text-[28px] leading-none text-d-blue">{stats.totalOrders}</div>
                        <div className="font-mono-dm text-[9px] text-slate-500 dark:text-d-muted mt-1.5">avg {currency} {formatCurrency(stats.avgOrderValue)}</div>
                    </div>

                    {/* Cash in Hand */}
                    <div className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-3.5 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#c084fc]" />
                            <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-slate-500 dark:text-d-faint">Cash in Hand</span>
                        </div>
                        <div className="font-bebas text-[28px] leading-none text-[#c084fc]">{currency} {formatCurrency(cashInHand)}</div>
                    </div>

                    {/* P&L Mini */}
                    <div onClick={() => setShowDetail('cogs')} className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-3.5 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] cursor-pointer hover:border-[rgba(255,107,107,0.25)] transition-all">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-d-red" />
                            <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-slate-500 dark:text-d-faint">Costs</span>
                        </div>
                        <div className="space-y-0.5 font-mono-dm text-[10px]">
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-d-faint">COGS</span><span className="text-d-red">{formatCurrencyShort(profitLoss.cogs)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-d-faint">Returns</span><span className="text-d-red">{formatCurrencyShort(profitLoss.returns)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-d-faint">Expenses</span><span className="text-d-red">{formatCurrencyShort(profitLoss.expenses)}</span></div>
                        </div>
                    </div>
                </div>

                {/* ─── ROW 2: Charts (compact) ─── */}
                <div className="grid grid-cols-12 gap-2.5">
                    {/* Sales Trend */}
                    <div className="col-span-7 bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] h-[200px] flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bebas text-[16px] tracking-[0.07em] text-slate-800 dark:text-d-heading">SALES & ORDERS</h3>
                            {peakData.value > 0 && (
                                <div className="font-mono-dm text-[9px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,210,100,0.1)] text-d-accent border border-[rgba(255,210,100,0.22)]">
                                    Peak {currency} {formatCurrency(peakData.value)} at {peakData.time}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
                                    <XAxis dataKey="name" stroke="#2a2f45" fontSize={8} fontFamily="DM Mono" tickLine={false} axisLine={false} interval={timeFilter === 'today' ? 2 : 0} />
                                    <YAxis yAxisId="left" stroke="#2a2f45" fontSize={8} fontFamily="DM Mono" tickLine={false} axisLine={false} tickFormatter={formatCurrencyShort} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#2a2f45" fontSize={8} fontFamily="DM Mono" tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0d0f17', border: '1px solid rgba(255,210,100,0.2)', borderRadius: '8px', padding: '8px' }}
                                        labelStyle={{ fontFamily: 'DM Mono', fontSize: '9px', color: '#4a5068' }}
                                        formatter={(value, name) => [name === 'sales' ? `${currency} ${formatCurrency(value)}` : `${value} orders`, name === 'sales' ? 'Revenue' : 'Orders']}
                                    />
                                    <defs>
                                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#ffd264" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#ffd264" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area yAxisId="left" type="monotone" dataKey="sales" stroke="#ffd264" strokeWidth={2} fill="url(#salesGrad)" dot={false} activeDot={{ r: 4, fill: '#ffd264' }} />
                                    <Bar yAxisId="right" dataKey="orders" fill="rgba(91,156,246,0.4)" radius={[3, 3, 0, 0]} maxBarSize={12} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Peak Times + Quick Stats */}
                    <div className="col-span-5 bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)] h-[200px] flex flex-col">
                        <div className="flex items-center gap-1.5 mb-3">
                            <FiZap size={13} className="text-[#c084fc]" />
                            <h3 className="font-bebas text-[16px] tracking-[0.07em] text-slate-800 dark:text-d-heading">PEAK TIMES & INSIGHTS</h3>
                        </div>
                        <div className="flex-1 space-y-2 overflow-y-auto">
                            {peakInsights.length > 0 ? peakInsights.map((p, i) => (
                                <div key={i} className="flex items-center justify-between px-3 py-2 bg-[rgba(192,132,252,0.06)] border border-[rgba(192,132,252,0.12)] rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-md bg-[rgba(192,132,252,0.15)] flex items-center justify-center text-[10px] font-bold text-[#c084fc]">{i + 1}</span>
                                        <span className="font-mono-dm text-[11px] text-slate-700 dark:text-d-text font-medium">{p.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bebas text-[14px] text-[#c084fc]">{currency} {formatCurrency(p.sales)}</div>
                                        <div className="font-mono-dm text-[9px] text-slate-500 dark:text-d-faint">{p.orders} orders</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex items-center justify-center h-full text-slate-400 dark:text-d-faint text-xs">No sales data yet</div>
                            )}
                            {/* Summary stats */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <div className="px-3 py-2 bg-[rgba(52,232,161,0.06)] border border-[rgba(52,232,161,0.12)] rounded-lg">
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-d-faint">Avg Revenue</div>
                                    <div className="font-bebas text-[14px] text-d-green">{currency} {formatCurrency(stats.totalOrders > 0 ? stats.totalSales / (chartData.filter(c => c.sales > 0).length || 1) : 0)}</div>
                                    <div className="text-[9px] text-slate-500 dark:text-d-faint">per active {timeFilter === 'today' ? 'hour' : 'day'}</div>
                                </div>
                                <div className="px-3 py-2 bg-[rgba(91,156,246,0.06)] border border-[rgba(91,156,246,0.12)] rounded-lg">
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-d-faint">Active {timeFilter === 'today' ? 'Hours' : 'Days'}</div>
                                    <div className="font-bebas text-[14px] text-d-blue">{chartData.filter(c => c.orders > 0).length}</div>
                                    <div className="text-[9px] text-slate-500 dark:text-d-faint">of {chartData.length} total</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── ROW 3: Product Intelligence ─── */}
                <div className="grid grid-cols-3 gap-2.5">
                    {/* Super Hit Products */}
                    <div className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-[rgba(52,232,161,0.1)] border border-[rgba(52,232,161,0.22)] flex items-center justify-center">
                                <FiAward size={12} className="text-d-green" />
                            </div>
                            <h3 className="font-bebas text-[15px] tracking-[0.06em] text-slate-800 dark:text-d-heading">TOP SELLERS</h3>
                            <span className="ml-auto text-[9px] font-mono-dm text-slate-500 dark:text-d-faint">All time</span>
                        </div>
                        {insightsLoading ? (
                            <div className="flex items-center justify-center h-[120px] text-slate-400 dark:text-d-faint text-xs">Loading...</div>
                        ) : topSellingProducts.length === 0 ? (
                            <div className="flex items-center justify-center h-[120px] text-slate-400 dark:text-d-faint text-xs">No sales yet</div>
                        ) : (
                            <div className="space-y-1.5">
                                {topSellingProducts.slice(0, 5).map((p, i) => {
                                    const maxQty = topSellingProducts[0]?.totalQtySold || 1;
                                    return (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-md bg-[rgba(52,232,161,0.1)] flex items-center justify-center text-[10px] font-bold text-d-green flex-shrink-0">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] text-slate-700 dark:text-d-text font-medium truncate">{p.name}</div>
                                                <div className="w-full bg-[rgba(52,232,161,0.08)] rounded-full h-1 mt-0.5">
                                                    <div className="h-1 rounded-full bg-d-green" style={{ width: `${(p.totalQtySold / maxQty) * 100}%` }} />
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-[11px] font-semibold text-d-green">{p.totalQtySold} sold</div>
                                                <div className="text-[9px] text-slate-500 dark:text-d-faint">{currency} {formatCurrencyShort(p.totalRevenue)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Best Margins */}
                    <div className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-[rgba(255,210,100,0.1)] border border-[rgba(255,210,100,0.22)] flex items-center justify-center">
                                <FiActivity size={12} className="text-d-accent" />
                            </div>
                            <h3 className="font-bebas text-[15px] tracking-[0.06em] text-slate-800 dark:text-d-heading">BEST MARGINS</h3>
                            <span className="ml-auto text-[9px] font-mono-dm text-slate-500 dark:text-d-faint capitalize">{timeFilter}</span>
                        </div>
                        {bestMarginProducts.length === 0 ? (
                            <div className="flex items-center justify-center h-[120px] text-slate-400 dark:text-d-faint text-xs">Not enough data yet</div>
                        ) : (
                            <div className="space-y-1.5">
                                {bestMarginProducts.map((p, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-md bg-[rgba(255,210,100,0.1)] flex items-center justify-center text-[10px] font-bold text-d-accent flex-shrink-0">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] text-slate-700 dark:text-d-text font-medium truncate">{p.name}</div>
                                            <div className="text-[9px] text-slate-500 dark:text-d-faint">{p.totalQtySold} sold</div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-[11px] font-bold text-d-accent">{p.margin.toFixed(0)}%</div>
                                            <div className="text-[9px] text-d-green">{currency} {formatCurrencyShort(p.totalProfit)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Dead Products */}
                    <div className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-[rgba(255,107,107,0.1)] border border-[rgba(255,107,107,0.22)] flex items-center justify-center">
                                <FiAlertCircle size={12} className="text-d-red" />
                            </div>
                            <h3 className="font-bebas text-[15px] tracking-[0.06em] text-slate-800 dark:text-d-heading">DEAD STOCK</h3>
                            <span className="ml-auto text-[9px] font-mono-dm text-slate-500 dark:text-d-faint">30 days</span>
                        </div>
                        {insightsLoading ? (
                            <div className="flex items-center justify-center h-[120px] text-slate-400 dark:text-d-faint text-xs">Loading...</div>
                        ) : deadStockData.products.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[120px] text-d-green">
                                <FiCheck size={20} />
                                <p className="text-xs mt-1">No dead stock found</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-[rgba(255,107,107,0.06)] border border-[rgba(255,107,107,0.12)] rounded-lg">
                                    <FiAlertTriangle size={11} className="text-d-red flex-shrink-0" />
                                    <span className="text-[10px] text-d-red font-medium">
                                        {deadStockData.products.length} products &middot; {currency} {formatCurrencyShort(deadStockData.summary.totalDeadValue || 0)} stuck
                                    </span>
                                </div>
                                <div className="space-y-1.5">
                                    {deadStockData.products.slice(0, 5).map((p, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-md bg-[rgba(255,107,107,0.1)] flex items-center justify-center text-[10px] font-bold text-d-red flex-shrink-0">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] text-slate-700 dark:text-d-text font-medium truncate">{p.name}</div>
                                                <div className="text-[9px] text-slate-500 dark:text-d-faint">{p.category || 'General'}</div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-[11px] font-semibold text-d-red">{p.stockQuantity} in stock</div>
                                                <div className="text-[9px] text-slate-500 dark:text-d-faint">{currency} {formatCurrencyShort(p.stockValue || 0)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ─── ROW 4: Low Stock Alerts ─── */}
                {lowStockData.length > 0 && (
                    <div className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-[rgba(255,185,50,0.1)] border border-[rgba(255,185,50,0.22)] flex items-center justify-center">
                                <FiPackage size={12} className="text-d-accent" />
                            </div>
                            <h3 className="font-bebas text-[15px] tracking-[0.06em] text-slate-800 dark:text-d-heading">LOW STOCK ALERTS</h3>
                            <span className="ml-1 px-2 py-0.5 bg-[rgba(255,185,50,0.1)] text-d-accent text-[10px] font-bold rounded-full border border-[rgba(255,185,50,0.22)]">
                                {lowStockData.length}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {lowStockData.slice(0, 12).map((p, i) => {
                                const pct = p.lowStockAlert > 0 ? Math.min((p.stockQuantity / p.lowStockAlert) * 100, 100) : 0;
                                const isVeryLow = pct < 25;
                                return (
                                    <div key={i} className={`px-3 py-2 rounded-lg border ${isVeryLow ? 'bg-[rgba(255,107,107,0.05)] border-[rgba(255,107,107,0.15)]' : 'bg-[rgba(255,185,50,0.05)] border-[rgba(255,185,50,0.15)]'}`}>
                                        <div className="text-[11px] text-slate-700 dark:text-d-text font-medium truncate">{p.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 bg-[rgba(255,255,255,0.06)] rounded-full h-1.5">
                                                <div className={`h-1.5 rounded-full ${isVeryLow ? 'bg-d-red' : 'bg-d-accent'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className={`text-[10px] font-bold ${isVeryLow ? 'text-d-red' : 'text-d-accent'}`}>{p.stockQuantity}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ─── ROW 5: Employee Performance & Payment Methods ─── */}
                <div className="grid grid-cols-12 gap-2.5">
                    {/* Employee Performance */}
                    <div className="col-span-7 bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-[rgba(91,156,246,0.1)] border border-[rgba(91,156,246,0.22)] flex items-center justify-center">
                                <FiUsers size={12} className="text-d-blue" />
                            </div>
                            <h3 className="font-bebas text-[15px] tracking-[0.06em] text-slate-800 dark:text-d-heading">EMPLOYEE PERFORMANCE</h3>
                            <span className="ml-auto text-[9px] font-mono-dm text-slate-500 dark:text-d-faint capitalize">{timeFilter}</span>
                        </div>
                        {cashierData.length === 0 ? (
                            <div className="flex items-center justify-center h-[120px] text-slate-400 dark:text-d-faint text-xs">No sales data for this period</div>
                        ) : (
                            <div className="space-y-0.5">
                                {/* Header */}
                                <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-d-faint">
                                    <div className="col-span-3">Employee</div>
                                    <div className="col-span-2 text-right">Sales</div>
                                    <div className="col-span-2 text-right">Orders</div>
                                    <div className="col-span-2 text-right">Profit</div>
                                    <div className="col-span-3 text-right">Avg Order</div>
                                </div>
                                {cashierData.sort((a, b) => b.totalSales - a.totalSales).map((emp, i) => {
                                    const maxSales = cashierData[0]?.totalSales || 1;
                                    return (
                                        <div key={i} className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg hover:bg-[rgba(91,156,246,0.04)] transition-colors">
                                            <div className="col-span-3 flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-md bg-[rgba(91,156,246,0.1)] flex items-center justify-center text-[10px] font-bold text-d-blue flex-shrink-0">{i + 1}</span>
                                                <span className="text-[11px] text-slate-700 dark:text-d-text font-medium truncate">{emp.cashierName}</span>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <div className="text-[11px] font-semibold text-d-green">{currency} {formatCurrencyShort(emp.totalSales)}</div>
                                                <div className="w-full bg-[rgba(52,232,161,0.08)] rounded-full h-1 mt-0.5">
                                                    <div className="h-1 rounded-full bg-d-green" style={{ width: `${(emp.totalSales / maxSales) * 100}%` }} />
                                                </div>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <span className="text-[11px] text-d-blue font-semibold">{emp.billCount}</span>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <span className={`text-[11px] font-semibold ${emp.totalProfit >= 0 ? 'text-d-green' : 'text-d-red'}`}>
                                                    {currency} {formatCurrencyShort(emp.totalProfit)}
                                                </span>
                                            </div>
                                            <div className="col-span-3 text-right">
                                                <span className="text-[11px] text-d-accent font-semibold">{currency} {formatCurrencyShort(emp.avgOrderValue)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Employee count summary */}
                                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200 dark:border-[rgba(255,255,255,0.06)] px-3">
                                    <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-d-faint font-bold">Total Employees</span>
                                    <span className="font-bebas text-[14px] text-d-blue">{employeeList.length}</span>
                                    <span className="text-[9px] text-slate-500 dark:text-d-faint mx-2">|</span>
                                    <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-d-faint font-bold">Active Sellers</span>
                                    <span className="font-bebas text-[14px] text-d-green">{cashierData.length}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Payment Methods */}
                    <div className="col-span-5 bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-[rgba(192,132,252,0.1)] border border-[rgba(192,132,252,0.22)] flex items-center justify-center">
                                <FiCreditCard size={12} className="text-[#c084fc]" />
                            </div>
                            <h3 className="font-bebas text-[15px] tracking-[0.06em] text-slate-800 dark:text-d-heading">PAYMENT METHODS</h3>
                            <span className="ml-auto text-[9px] font-mono-dm text-slate-500 dark:text-d-faint capitalize">{timeFilter}</span>
                        </div>
                        {(() => {
                            const methods = Array.isArray(paymentMethods) ? paymentMethods : [];
                            const totalAmount = methods.reduce((sum, m) => sum + (m.totalAmount || m.total || 0), 0);
                            if (methods.length === 0) {
                                return <div className="flex items-center justify-center h-[120px] text-slate-400 dark:text-d-faint text-xs">No payment data</div>;
                            }
                            const colors = { cash: '#34e8a1', online: '#5b9cf6', card: '#c084fc', upi: '#ffd264', credit: '#ff6b6b', bank: '#38bdf8' };
                            return (
                                <div className="space-y-2">
                                    {methods.map((m, i) => {
                                        const name = (m._id || m.method || 'Other').toLowerCase();
                                        const displayName = (m._id || m.method || 'Other');
                                        const amount = m.totalAmount || m.total || 0;
                                        const count = m.count || m.billCount || 0;
                                        const pct = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
                                        const color = colors[name] || '#5b9cf6';
                                        return (
                                            <div key={i} className="px-3 py-2.5 rounded-lg border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)]">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                                        <span className="text-[11px] text-slate-700 dark:text-d-text font-medium capitalize">{displayName}</span>
                                                        <span className="text-[9px] text-slate-500 dark:text-d-faint">({count} bills)</span>
                                                    </div>
                                                    <span className="font-bebas text-[14px]" style={{ color }}>{currency} {formatCurrencyShort(amount)}</span>
                                                </div>
                                                <div className="w-full bg-[rgba(255,255,255,0.06)] rounded-full h-1.5">
                                                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                                                </div>
                                                <div className="text-right mt-0.5">
                                                    <span className="text-[9px] text-slate-500 dark:text-d-faint">{pct.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="flex items-center justify-between px-3 pt-2 border-t border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                                        <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-d-faint font-bold">Total Collection</span>
                                        <span className="font-bebas text-[16px] text-d-accent">{currency} {formatCurrency(totalAmount)}</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* ─── ROW 6: Quick Actions ─── */}
                <div className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-[rgba(255,210,100,0.1)] border border-[rgba(255,210,100,0.22)] flex items-center justify-center">
                            <FiZap size={12} className="text-d-accent" />
                        </div>
                        <h3 className="font-bebas text-[15px] tracking-[0.06em] text-slate-800 dark:text-d-heading">QUICK ACTIONS</h3>
                    </div>
                    <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                        {[
                            { label: 'New Sale', icon: FiShoppingCart, path: '/sales', color: '#34e8a1', bg: 'rgba(52,232,161,0.08)', border: 'rgba(52,232,161,0.18)' },
                            { label: 'Products', icon: FiPackage, path: '/products', color: '#ffd264', bg: 'rgba(255,210,100,0.08)', border: 'rgba(255,210,100,0.18)' },
                            { label: 'Vendors', icon: FiTruck, path: '/vendors', color: '#5b9cf6', bg: 'rgba(91,156,246,0.08)', border: 'rgba(91,156,246,0.18)' },
                            { label: 'Customers', icon: FiUser, path: '/customers', color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.18)' },
                            { label: 'Expenses', icon: FiFileText, path: '/expenses', color: '#ff6b6b', bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.18)' },
                            { label: 'Cashbook', icon: FiBookOpen, path: '/cashbook', color: '#38bdf8', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.18)' },
                            { label: 'Reports', icon: FiPieChart, path: '/reports', color: '#f472b6', bg: 'rgba(244,114,182,0.08)', border: 'rgba(244,114,182,0.18)' },
                            { label: 'Employees', icon: FiUsers, path: '/employees', color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.18)' },
                        ].map((action, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(action.path)}
                                className="flex flex-col items-center gap-2 px-3 py-3 rounded-xl border transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                                style={{ backgroundColor: action.bg, borderColor: action.border }}
                            >
                                <action.icon size={18} style={{ color: action.color }} />
                                <span className="text-[10px] font-semibold tracking-wide text-slate-700 dark:text-d-text">{action.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─── ROW 7: Inventory & Vendor Summary ─── */}
                <div className="grid grid-cols-2 gap-2.5">
                    {/* Inventory Snapshot */}
                    <div className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.22)] flex items-center justify-center">
                                <FiGrid size={12} className="text-[#38bdf8]" />
                            </div>
                            <h3 className="font-bebas text-[15px] tracking-[0.06em] text-slate-800 dark:text-d-heading">INVENTORY SNAPSHOT</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center px-3 py-3 bg-[rgba(52,232,161,0.06)] border border-[rgba(52,232,161,0.12)] rounded-lg">
                                <div className="font-bebas text-[22px] text-d-green">{topSellingProducts.length > 0 ? topSellingProducts.reduce((s, p) => s + (p.totalQtySold || 0), 0) : 0}</div>
                                <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-d-faint font-bold mt-1">Units Sold</div>
                                <div className="text-[9px] text-slate-500 dark:text-d-faint">all time</div>
                            </div>
                            <div className="text-center px-3 py-3 bg-[rgba(255,107,107,0.06)] border border-[rgba(255,107,107,0.12)] rounded-lg">
                                <div className="font-bebas text-[22px] text-d-red">{deadStockData.products.length}</div>
                                <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-d-faint font-bold mt-1">Dead Items</div>
                                <div className="text-[9px] text-slate-500 dark:text-d-faint">{currency} {formatCurrencyShort(deadStockData.summary.totalDeadValue || 0)} value</div>
                            </div>
                            <div className="text-center px-3 py-3 bg-[rgba(255,185,50,0.06)] border border-[rgba(255,185,50,0.12)] rounded-lg">
                                <div className="font-bebas text-[22px] text-d-accent">{lowStockData.length}</div>
                                <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-d-faint font-bold mt-1">Low Stock</div>
                                <div className="text-[9px] text-slate-500 dark:text-d-faint">need reorder</div>
                            </div>
                        </div>
                    </div>

                    {/* Vendor / Supply Summary */}
                    <div className="bg-slate-100 dark:bg-[#0d0f17] rounded-xl p-4 border border-slate-200 dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-[rgba(251,146,60,0.1)] border border-[rgba(251,146,60,0.22)] flex items-center justify-center">
                                <FiTruck size={12} className="text-[#fb923c]" />
                            </div>
                            <h3 className="font-bebas text-[15px] tracking-[0.06em] text-slate-800 dark:text-d-heading">SUPPLY OVERVIEW</h3>
                        </div>
                        {(() => {
                            const ov = supplyStats?.overall || {};
                            return (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center px-3 py-3 bg-[rgba(91,156,246,0.06)] border border-[rgba(91,156,246,0.12)] rounded-lg">
                                        <div className="font-bebas text-[22px] text-d-blue">{ov.count || 0}</div>
                                        <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-d-faint font-bold mt-1">Total Supplies</div>
                                    </div>
                                    <div className="text-center px-3 py-3 bg-[rgba(52,232,161,0.06)] border border-[rgba(52,232,161,0.12)] rounded-lg">
                                        <div className="font-bebas text-[22px] text-d-green">{currency} {formatCurrencyShort(ov.totalPaid || 0)}</div>
                                        <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-d-faint font-bold mt-1">Total Paid</div>
                                    </div>
                                    <div className="text-center px-3 py-3 bg-[rgba(255,107,107,0.06)] border border-[rgba(255,107,107,0.12)] rounded-lg">
                                        <div className="font-bebas text-[22px] text-d-red">{currency} {formatCurrencyShort(ov.totalRemaining || 0)}</div>
                                        <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-d-faint font-bold mt-1">Outstanding</div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

            </div>

            {/* Detail Popup */}
            {renderDetailPopup()}
        </div>
    );
};

// ==================== MAIN DASHBOARD WRAPPER ====================
const Dashboard = () => {
    const { isEmployee } = useAuth();
    return isEmployee ? <EmployeeDashboard /> : <AdminDashboard />;
};

export default Dashboard;
