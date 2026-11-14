import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, IconButton, Input, Textarea, Select, SearchInput, Field, SegmentedControl, StatusChip, Alert, CARD_FRAME } from '../components/ui';
import { DialogShell } from '../components/ui/Dialog';
import { useBusiness } from '../context/BusinessContext';
import { getTodaySummary, getReturnByReceipt, getReturnProductByBarcode, createReturn } from '../services/api/returns';
import { getCashBalance } from '../services/api/cashbook';
import AccountPicker from '../components/AccountPicker';
import { useMoneyBook } from '../context/MoneyBookContext';
import { apiErrorMessage } from '../utils/moneyBook';
import { getProducts } from '../services/api/products';
import { searchCustomers, getCustomer } from '../services/api/customers';
import { mergeReceiptItems } from '../utils/receiptItems';
import {
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
    FiChevronRight,
    FiArrowLeft,
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
    { value: 'cash', label: 'Cash' },
    // { value: 'card', label: 'Card', icon: '💳' },
    // { value: 'store_credit', label: 'Store Credit', icon: '🎫' },
];

// One numbered step card of the return flow (outside the screen so typing never remounts it)
const Step = ({ n, title, hint, done, action, children }) => (
    <section className={`${CARD_FRAME} min-w-0`}>
        <header className="flex items-center gap-3 px-5 pt-4 pb-3">
            <span
                className={`w-7 h-7 flex-none rounded-full inline-flex items-center justify-center text-body-sm font-semibold ${
                    done ? 'bg-success-chip text-success-chip-foreground' : 'bg-primary text-primary-foreground'
                }`}
                aria-hidden="true"
            >
                {done ? <FiCheck className="w-4 h-4" /> : n}
            </span>
            <div className="flex-1 min-w-0">
                <h2 className="font-heading text-h4 text-foreground">{title}</h2>
                {hint ? <p className="text-body-sm text-muted-foreground">{hint}</p> : null}
            </div>
            {action}
        </header>
        <div className="px-5 pb-5">{children}</div>
    </section>
);


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
    const [activeResult, setActiveResult] = useState(-1); // keyboard-highlighted search result
    const customerSearchRef = useRef(null);
    const searchTimerRef = useRef(null);

    // Search mode
    const [searchMode, setSearchMode] = useState('customer'); // 'customer' | 'bill' | 'product'

    // Refund details
    const [refundMethod, setRefundMethod] = useState('cash');
    // Money Book (only when the shop has it on): account the refund is paid from
    const { isOn: moneyBookOn, drawerId, moneyFields, handleMoneyError } = useMoneyBook();
    const [refundAccountId, setRefundAccountId] = useState(null);
    const [refundShort, setRefundShort] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [notes, setNotes] = useState('');

    // Processing state
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [returnResult, setReturnResult] = useState(null);
    const [error, setError] = useState('');

    // Full return (whole bill / remaining items in one request)
    const [showFullReturn, setShowFullReturn] = useState(false);
    const [fullReturnReason, setFullReturnReason] = useState('changed_mind');
    const [fullReturnNote, setFullReturnNote] = useState('');
    const [fullReturnError, setFullReturnError] = useState('');

    // Today's summary
    const [todaySummary, setTodaySummary] = useState({ totalReturns: 0, totalRefunded: 0 });

    // Cash balance for validation
    const [cashBalance, setCashBalance] = useState(null);

    // /returns?bill=171 (from a receipt's "Return items") opens that bill straight away
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const n = searchParams.get('bill');
        if (!n) return;
        setBillNumber(n);
        lookupBill(n);
        setSearchParams({}, { replace: true });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        loadTodaySummary();
        getCashBalance().then(res => setCashBalance(res.data?.balance ?? null)).catch(() => {});
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

    // Where a customer return's credit went: applied to unpaid bills (the backend
    // moves it automatically, oldest first) or kept on the account. Balance is
    // read best-effort — cashiers without customers.view just see the moves.
    const describeCredit = async (data, bill) => {
        const moves = data?.creditSettlement || [];
        if (!bill?.customer || moves.length > 0) return { creditMoves: moves, keptCredit: 0 };
        try {
            const res = await getCustomer(bill.customer?._id || bill.customer);
            const balance = Number(res.data?.balance) || 0;
            const refund = Number(data?.refundAmount) || 0;
            return { creditMoves: [], keptCredit: balance < 0 ? Math.min(refund, -balance) : 0 };
        } catch {
            return { creditMoves: [], keptCredit: 0 };
        }
    };

    const formatCurrency = (amount) => {
        return `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;
    };

    // Lookup bill by number
    const lookupBill = async (num = billNumber) => {
        const wanted = String(num || '').trim().replace(/^#/, '');
        if (!wanted) {
            setError('Enter a bill number');
            return;
        }

        setLoadingBill(true);
        setError('');
        try {
            const response = await getReturnByReceipt(wanted);
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

    const switchMode = (mode) => {
        if (mode === searchMode) return;
        // Clear state of the mode being left
        clearCustomer();
        setLinkedBill(null);
        setBillNumber('');
        setReturnItems([]);
        setError('');
        setSearchMode(mode);
    };

    // Linked bill's lines with the same product combined (items added to the
    // bill later are separate lines in the backend). Each keeps the original
    // lines in `parts` so the return can be split back across them.
    const billLines = mergeReceiptItems(linkedBill?.items || []).map((group) => {
        const parts = group.lines.map((line) => ({
            itemId: line._id,
            remaining: line.remainingQty !== undefined ? line.remainingQty : line.qty - (line.returnedQty || 0),
        }));
        return {
            ...group,
            groupId: group.lines[0]._id,
            parts,
            remainingQty: parts.reduce((sum, p) => sum + Math.max(0, p.remaining), 0),
        };
    });

    // A combined line's return quantity, spread over its original lines (newest
    // first) — processReturn takes one entry per bill line.
    const splitAcrossLines = (item) => {
        let left = item.quantity;
        return [...item.parts].reverse().flatMap((part) => {
            const quantity = Math.min(left, Math.max(0, part.remaining));
            left -= quantity;
            return quantity > 0 ? [{ itemId: part.itemId, quantity, reason: item.reason }] : [];
        });
    };

    // Add item from linked bill (a combined line from billLines)
    const addItemFromBill = (item) => {
        const remainingQty = item.remainingQty;
        if (remainingQty <= 0) {
            setError('All items already returned');
            return;
        }

        const existingIndex = returnItems.findIndex(ri => ri.groupId === item.groupId);
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
                groupId: item.groupId,
                parts: item.parts,         // original bill lines — processReturn needs their _id
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

    // Full return preview — everything still returnable on the linked bill. The
    // backend decides the exact items and amount when it processes the request,
    // so the estimate is only shown as "≈" and the result uses the response.
    const fullReturnLines = (linkedBill?.items || [])
        .map((item) => ({
            ...item,
            remaining: item.remainingQty !== undefined ? item.remainingQty : item.qty - (item.returnedQty || 0),
        }))
        .filter((item) => item.remaining > 0);
    const canFullReturn = !!linkedBill && linkedBill.returnStatus !== 'full' && fullReturnLines.length > 0;
    const isPartiallyReturned = linkedBill?.returnStatus === 'partial'
        || (linkedBill?.items || []).some((item) => (item.returnedQty || 0) > 0);
    // Spread a bill-level discount over items by their share of the line totals.
    const linesNetTotal = (linkedBill?.items || []).reduce((sum, item) => sum + (item.itemTotal ?? item.price * item.qty), 0);
    const billDiscountFactor = linesNetTotal > 0 && linkedBill?.total != null ? linkedBill.total / linesNetTotal : 1;
    const fullReturnEstimate = fullReturnLines.reduce((sum, item) => {
        const lineTotal = item.itemTotal ?? item.price * item.qty;
        return sum + (lineTotal / (item.qty || 1)) * item.remaining * billDiscountFactor;
    }, 0);
    const fullReturnQty = fullReturnLines.reduce((sum, item) => sum + item.remaining, 0);

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
        // (so it has bill line ids). Block mixed scans to avoid silent drops.
        if (linkedBill) {
            const orphan = returnItems.find((i) => !i.parts?.length);
            if (orphan) {
                setError(`"${orphan.name}" is not on bill #${linkedBill.billNumber}. Remove it or clear the linked bill.`);
                return;
            }
        }

        // Cash refund validation
        const isCashRefund = linkedBill ? !linkedBill.customer : refundMethod === 'cash';
        if (!moneyBookOn && isCashRefund && cashBalance != null && totalRefund > cashBalance) {
            setError(`Insufficient cash. Available: ${formatCurrency(cashBalance)}`);
            return;
        }
        // Money Book: the picked account must hold the refund (customer bills
        // go to their ledger — no money moves, no picker)
        const paysOut = linkedBill ? !linkedBill.customer : refundMethod !== 'store_credit';
        if (moneyBookOn && paysOut && refundShort) {
            setError('Not enough money in the selected account. Choose another account.');
            return;
        }

        setProcessing(true);
        setError('');
        try {
            let payload;
            if (linkedBill) {
                payload = {
                    billId: linkedBill._id,
                    items: returnItems.flatMap(splitAcrossLines),
                    notes,
                    ...(!linkedBill.customer ? moneyFields({ refundAccountId }) : {}),
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
                    ...(refundMethod !== 'store_credit' ? moneyFields({ refundAccountId }) : {}),
                };
            }

            const response = await createReturn(payload);
            const data = response.data;

            // Normalize — the two endpoints return different shapes
            if (linkedBill) {
                // processReturn → { returnNumber, refundAmount, cashRefundAmount, debtCancelled, bill }
                const returnEntry = data.bill?.returns?.slice(-1)[0];
                setReturnResult({
                    returnNumber: data.returnNumber,
                    totalItems: returnItems.reduce((s, i) => s + i.quantity, 0),
                    refundAmount: data.refundAmount,
                    cashRefundAmount: data.cashRefundAmount ?? data.refundAmount,
                    debtCancelled: data.debtCancelled ?? 0,
                    refundMethod: returnEntry?.refundMethod || 'ledger_adjust',
                    ...(await describeCredit(data, linkedBill)),
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
            handleMoneyError(error);
            setError(apiErrorMessage(error, 'Failed to process return'));
        } finally {
            setProcessing(false);
        }
    };

    const openFullReturn = () => {
        setFullReturnReason('changed_mind');
        setFullReturnNote('');
        setFullReturnError('');
        setShowFullReturn(true);
    };

    // Return everything still returnable on the linked bill in one request.
    // Sends { fullReturn: true } — never the item list; the backend works out
    // what's remaining at processing time and computes the exact refund.
    const processFullReturn = async () => {
        if (!linkedBill || processing) return;

        const isCashRefund = !linkedBill.customer;
        if (!moneyBookOn && isCashRefund && cashBalance != null && fullReturnEstimate > cashBalance) {
            setFullReturnError(`Insufficient cash. Available: ${formatCurrency(cashBalance)}`);
            return;
        }
        if (moneyBookOn && isCashRefund && refundShort) {
            setFullReturnError('Not enough money in the selected account. Choose another account.');
            return;
        }

        setProcessing(true);
        setFullReturnError('');
        try {
            const note = fullReturnNote.trim();
            const response = await createReturn({
                billId: linkedBill._id,
                fullReturn: true,
                reason: fullReturnReason,
                ...(note ? { reasonNote: note } : {}),
                ...(isCashRefund ? moneyFields({ refundAccountId }) : {}),
            });
            const data = response.data;
            const returnEntry = data.bill?.returns?.slice(-1)[0];
            const returnedQty = returnEntry?.items?.reduce((sum, i) => sum + (i.qty ?? i.quantity ?? 0), 0);
            setReturnResult({
                returnNumber: data.returnNumber,
                totalItems: returnedQty || fullReturnQty,
                refundAmount: data.refundAmount,
                cashRefundAmount: data.cashRefundAmount ?? data.refundAmount,
                debtCancelled: data.debtCancelled ?? 0,
                refundMethod: returnEntry?.refundMethod || (linkedBill.customer ? 'ledger_adjust' : 'cash'),
                ...(await describeCredit(data, linkedBill)),
            });
            setShowFullReturn(false);
            setShowSuccess(true);
            loadTodaySummary();
        } catch (err) {
            console.error('Error processing full return:', err);
            handleMoneyError(err);
            setFullReturnError(apiErrorMessage(err, 'Failed to process return'));
        } finally {
            setProcessing(false);
        }
    };

    // "Return full bill" / "Return remaining items" — shown under a linked bill's items.
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
        setShowFullReturn(false);
        setFullReturnError('');
        setSearchMode('customer');
        clearCustomer();
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    };

    // ── Layout (design: 1 find the sale → 2 what comes back → 3 refund panel, like the till) ──
    const MODES = [
        { value: 'customer', label: 'Customer', hint: 'Find their bill by name or phone' },
        { value: 'bill', label: 'Bill number', hint: 'Type the number on the receipt' },
        { value: 'product', label: 'No bill', hint: 'Scan or search the product' },
    ];
    const dateOf = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
    const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
    const returningFor = (groupId) => returnItems.find((ri) => ri.groupId === groupId);
    const reasonLabel = (v) => RETURN_REASONS.find((r) => r.value === v)?.label || v;

    // Arrow keys + Enter in the search results
    const pickKeys = (list, onPick, close) => (e) => {
        if (!list.length) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveResult((i) => (e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length));
        } else if (e.key === 'Enter' && activeResult >= 0 && list[activeResult]) {
            e.preventDefault();
            onPick(list[activeResult]);
            setActiveResult(-1);
        } else if (e.key === 'Escape') {
            close();
            setActiveResult(-1);
        }
    };

    const resultsBox = 'absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-hairline bg-popover text-popover-foreground shadow-2 max-h-80 overflow-y-auto py-1';
    const resultRow = (active) =>
        `w-full flex items-center gap-3 px-3 py-2.5 text-left ${active ? 'bg-[var(--hover-overlay)]' : 'hover:bg-[var(--hover-overlay)]'}`;

    // Step 1 body per mode
    const findSale = () => {
        if (searchMode === 'customer') {
            if (!selectedCustomer) {
                return (
                    <div className="relative" ref={customerSearchRef}>
                        <SearchInput
                            size="touch"
                            autoFocus
                            value={customerQuery}
                            onChange={(e) => {
                                handleCustomerSearch(e.target.value);
                                setActiveResult(-1);
                            }}
                            onFocus={() => customerQuery.trim() && setShowCustomerDropdown(true)}
                            onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                            onKeyDown={pickKeys(customerResults, selectCustomer, () => setShowCustomerDropdown(false))}
                            placeholder="Customer name or phone number"
                            aria-label="Customer name or phone number"
                        />
                        {showCustomerDropdown && customerQuery.trim() && (
                            <div className={resultsBox} role="listbox" aria-label="Customers">
                                {customerResults.length === 0 ? (
                                    <p className="px-3 py-3 text-body-sm text-muted-foreground">No customer matches “{customerQuery.trim()}”.</p>
                                ) : (
                                    customerResults.map((c, i) => (
                                        <button key={c._id} type="button" role="option" aria-selected={i === activeResult} onMouseDown={() => selectCustomer(c)} className={resultRow(i === activeResult)}>
                                            <span className="w-8 h-8 flex-none rounded-full bg-accent text-accent-foreground inline-flex items-center justify-center text-caption font-semibold">{initials(c.name)}</span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-body font-medium text-foreground truncate">{c.name}</span>
                                                <span className="block text-caption text-muted-foreground font-mono">{c.phone || 'No phone'}</span>
                                            </span>
                                            {(c.balance || 0) > 0 ? (
                                                <StatusChip tone="destructive" size="sm" label={`Owes ${formatCurrency(c.balance)}`} />
                                            ) : (c.balance || 0) < 0 ? (
                                                <StatusChip tone="success" size="sm" label={`Credit ${formatCurrency(-c.balance)}`} />
                                            ) : null}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                );
            }
            return (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 rounded-xl border border-hairline px-3 py-2.5">
                        <span className="w-9 h-9 flex-none rounded-full bg-accent text-accent-foreground inline-flex items-center justify-center text-body-sm font-semibold">{initials(selectedCustomer.name)}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-body-lg font-medium text-foreground truncate">{selectedCustomer.name}</p>
                            <p className="text-caption text-muted-foreground font-mono">{selectedCustomer.phone}</p>
                        </div>
                        <Button size="xs" variant="ghost" onClick={clearCustomer}>
                            Change customer
                        </Button>
                    </div>
                    {loadingCustomer ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-body-sm text-muted-foreground">
                            <FiRefreshCw className="animate-spin" aria-hidden="true" /> Loading their bills…
                        </div>
                    ) : linkedBill ? null : customerBills.length === 0 ? (
                        <p className="py-4 text-center text-body-sm text-muted-foreground">This customer has no completed bills.</p>
                    ) : (
                        <div>
                            <p className="mb-2 text-body-sm font-medium text-foreground">Which bill are they returning from?</p>
                            <ul className="rounded-xl border border-hairline overflow-hidden max-h-72 overflow-y-auto">
                                {customerBills.map((bill) => (
                                    <li key={bill._id}>
                                        <button
                                            type="button"
                                            onClick={() => selectBillFromCustomer(bill)}
                                            className="w-full flex items-center gap-3 px-3 py-3 text-left shadow-[inset_0_-1px_0_var(--hairline)] hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                                        >
                                            <span className="w-14 flex-none font-mono text-body text-foreground">#{bill.billNumber}</span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-body text-foreground truncate">{bill.items?.map((i) => i.name).join(', ')}</span>
                                                <span className="block text-caption text-muted-foreground">
                                                    {dateOf(bill.createdAt)} · {bill.items?.length || 0} product{bill.items?.length === 1 ? '' : 's'}
                                                </span>
                                            </span>
                                            {bill.returnStatus !== 'none' ? <StatusChip tone="warning" size="sm" label="Has returns" /> : null}
                                            <span className="w-24 text-right text-body font-semibold tabular-nums text-foreground flex-none">{formatCurrency(bill.total)}</span>
                                            <FiChevronRight className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            );
        }
        if (searchMode === 'bill') {
            return (
                <div className="flex gap-2">
                    <SearchInput
                        size="touch"
                        autoFocus
                        className="flex-1"
                        value={billNumber}
                        onChange={(e) => setBillNumber(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && lookupBill()}
                        placeholder="Bill number, e.g. 171"
                        aria-label="Bill number"
                        inputMode="numeric"
                    />
                    <Button variant="primary" size="touch" onClick={() => lookupBill()} loading={loadingBill} disabled={loadingBill}>
                        Find bill
                    </Button>
                </div>
            );
        }
        // No bill: search products
        return (
            <form onSubmit={(e) => (activeResult >= 0 && productSuggestions[activeResult] ? (e.preventDefault(), addProductFromSuggestion(productSuggestions[activeResult]), setActiveResult(-1)) : handleBarcodeSubmit(e))}>
                <div className="relative" ref={productDropdownRef}>
                    <SearchInput
                        ref={barcodeInputRef}
                        size="touch"
                        value={barcode}
                        onChange={(e) => {
                            handleSearchChange(e.target.value);
                            setActiveResult(-1);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') pickKeys(productSuggestions, addProductFromSuggestion, () => setShowProductDropdown(false))(e);
                        }}
                        placeholder="Scan the barcode or type the product name"
                        aria-label="Product barcode or name"
                    />
                    {showProductDropdown && (
                        <div className={resultsBox} role="listbox" aria-label="Products">
                            {productSuggestions.map((p, i) => (
                                <button key={p._id} type="button" role="option" aria-selected={i === activeResult} onClick={() => addProductFromSuggestion(p)} className={resultRow(i === activeResult)}>
                                    <span className="w-8 h-8 flex-none rounded-lg bg-muted text-muted-foreground inline-flex items-center justify-center">
                                        <FiPackage className="w-4 h-4" aria-hidden="true" />
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-body font-medium text-foreground truncate">{p.name}</span>
                                        <span className="block text-caption text-muted-foreground font-mono">{p.barcode || p.sku || '—'}</span>
                                    </span>
                                    <span className="text-body font-semibold tabular-nums text-foreground">{formatCurrency(p.sellingPrice || 0)}</span>
                                    <FiPlus className="w-4 h-4 text-primary flex-none" aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <p className="mt-2 text-caption text-muted-foreground">Press Enter after scanning. Use this only when the customer has no bill — the refund uses today’s selling price.</p>
            </form>
        );
    };

    // Step 2: every item on the bill with two buttons —
    //   Remove     → one more of it comes back (−1 from what is left on the bill)
    //   Remove all → everything still left of it comes back
    const returnAllOf = (item) => {
        if (item.remainingQty <= 0) return;
        setReturnItems((prev) => {
            const i = prev.findIndex((r) => r.groupId === item.groupId);
            if (i >= 0) {
                const next = [...prev];
                next[i] = { ...next[i], quantity: item.remainingQty };
                return next;
            }
            return [
                ...prev,
                {
                    id: Date.now().toString(),
                    groupId: item.groupId,
                    parts: item.parts,
                    name: item.name,
                    productName: item.name,
                    price: item.price,
                    quantity: item.remainingQty,
                    maxQty: item.remainingQty,
                    reason: 'changed_mind',
                    fromBill: true,
                },
            ];
        });
        setError('');
    };

    const billTable = () => (
        <ul className="rounded-xl border border-hairline overflow-hidden">
            {billLines.map((item) => {
                const ri = returningFor(item.groupId);
                const taken = ri?.quantity || 0;
                const left = item.remainingQty - taken; // still on the bill after this return
                const done = item.remainingQty <= 0;
                return (
                    <li key={item.groupId} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 shadow-[inset_0_-1px_0_var(--hairline)] last:shadow-none ${taken ? 'bg-accent/40' : ''}`}>
                        {/* Left: name + what is left; the "coming back" tag sits here so nothing pushes the buttons */}
                        <div className="min-w-0">
                            <p className={`text-body-lg font-medium truncate ${done ? 'text-muted-foreground' : 'text-foreground'}`}>{item.name}</p>
                            <p className="text-body-sm text-muted-foreground tabular-nums">
                                {formatCurrency(item.price)} each ·{' '}
                                {done ? (
                                    'all returned before'
                                ) : (
                                    <>
                                        <span className="font-medium text-foreground">{left}</span> of {item.qty} left on the bill
                                    </>
                                )}
                            </p>
                            {/* always takes its line (hidden at 0) so the row height — and the buttons — never move */}
                            {!done ? (
                                <p className={`mt-1 text-body-sm font-medium text-destructive tabular-nums ${taken ? '' : 'invisible'}`} aria-hidden={!taken}>
                                    {taken || 0} coming back · {formatCurrency(item.price * (taken || 0))}
                                </p>
                            ) : null}
                        </div>
                        {/* Right: the buttons — same place and size on every row, whatever happens */}
                        {done ? (
                            <div className="flex items-center justify-end gap-2 w-[300px]">
                                <StatusChip tone="neutral" size="sm" label="Returned" />
                            </div>
                        ) : (
                            <div className="flex items-center justify-end gap-2 w-[300px]">
                                <Button size="xs" variant="outline" className="w-[110px] justify-center" disabled={left <= 0} onClick={() => addItemFromBill(item)}>
                                    <FiMinus aria-hidden="true" /> Remove
                                </Button>
                                <Button size="xs" variant="outline" className="w-[130px] justify-center tabular-nums" disabled={left <= 0} onClick={() => returnAllOf(item)}>
                                    Remove all{left > 0 ? ` (${left})` : ''}
                                </Button>
                                <span className={`w-8 flex-none ${taken ? '' : 'invisible'}`}>
                                    <IconButton label={`Keep all ${item.name} on the bill`} size="xs" onClick={() => ri && removeItem(ri.id)} tabIndex={taken ? 0 : -1}>
                                        <FiRotateCcw />
                                    </IconButton>
                                </span>
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );

    // Step 2 without a bill: the products added
    const looseItems = () =>
        returnItems.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-muted-foreground">Nothing added yet — scan or search a product above.</p>
        ) : (
            <ul className="rounded-xl border border-hairline overflow-hidden">
                {returnItems.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3 shadow-[inset_0_-1px_0_var(--hairline)] last:shadow-none">
                        <div className="flex-1 min-w-[160px]">
                            <p className="text-body font-medium text-foreground truncate">{item.name}</p>
                            <p className="text-caption text-muted-foreground tabular-nums">{formatCurrency(item.price)} each</p>
                        </div>
                        <div className="inline-flex items-center rounded-lg border border-border">
                            <IconButton label="One less" size="2xs" onClick={() => updateQuantity(item.id, -1)}>
                                <FiMinus />
                            </IconButton>
                            <span className="min-w-[28px] text-center text-body font-semibold tabular-nums">{item.quantity}</span>
                            <IconButton label="One more" size="2xs" onClick={() => updateQuantity(item.id, 1)}>
                                <FiPlus />
                            </IconButton>
                        </div>
                        <Select size="xs" className="w-[170px]" value={item.reason} onChange={(e) => updateReason(item.id, e.target.value)} aria-label={`Reason for ${item.name}`}>
                            {RETURN_REASONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </Select>
                        <span className="w-24 text-right text-body font-semibold tabular-nums text-foreground">{formatCurrency(item.price * item.quantity)}</span>
                        <IconButton label={`Remove ${item.name}`} size="xs" onClick={() => removeItem(item.id)}>
                            <FiTrash2 />
                        </IconButton>
                    </li>
                ))}
            </ul>
        );

    const saleFound = searchMode === 'product' || !!linkedBill;
    const mode = MODES.find((m) => m.value === searchMode);

    return (
        <div className="h-full flex min-h-0">
            {/* Left: the two steps */}
            <div className="flex-1 min-w-0 overflow-y-auto">
                <div className="p-6 max-w-[1100px] mx-auto flex flex-col gap-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h1 className="font-heading text-h2 text-foreground">Returns</h1>
                            <p className="text-body text-muted-foreground">Find the sale, choose what comes back, then refund.</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-hairline bg-card px-3 py-2">
                            <FiRotateCcw className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                            <span className="text-body-sm text-muted-foreground">Today</span>
                            <span className="text-body font-semibold tabular-nums text-foreground">
                                {todaySummary.totalReturns} return{todaySummary.totalReturns === 1 ? '' : 's'}
                            </span>
                            <span className="text-body-sm tabular-nums text-muted-foreground">· {formatCurrency(todaySummary.totalRefunded)}</span>
                        </div>
                    </div>

                    <Step n={1} title="Find the sale" hint={saleFound && searchMode !== 'product' ? undefined : mode?.hint} done={!!linkedBill}>
                        {linkedBill ? (
                            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-accent px-4 py-3">
                                <FiFileText className="w-5 h-5 text-accent-foreground flex-none" aria-hidden="true" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-body-lg font-semibold text-foreground">
                                        Bill #{linkedBill.billNumber} <span className="font-normal text-muted-foreground">· {formatCurrency(linkedBill.total ?? linkedBill.totalBill)}</span>
                                    </p>
                                    <p className="text-body-sm text-muted-foreground">
                                        {linkedBill.customerName || 'Walk-in'} · {dateOf(linkedBill.createdAt)}
                                        {linkedBill.hasReturns ? ' · some items returned before' : ''}
                                    </p>
                                </div>
                                <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => {
                                        setLinkedBill(null);
                                        setReturnItems([]);
                                        setError('');
                                    }}
                                >
                                    Pick another bill
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <SegmentedControl label="Find the sale by" value={searchMode} onChange={switchMode} options={MODES.map(({ value, label }) => ({ value, label }))} />
                                {findSale()}
                                {error && !returnItems.length ? (
                                    <Alert tone="destructive" icon={FiAlertCircle}>
                                        {error}
                                    </Alert>
                                ) : null}
                            </div>
                        )}
                    </Step>

                    <Step
                        n={2}
                        title="What's coming back?"
                        hint={
                            !saleFound
                                ? 'Find the sale first.'
                                : linkedBill
                                  ? 'Remove takes one off the bill; Remove all takes everything left of that item.'
                                  : 'Each product you add shows here.'
                        }
                        done={false}
                        action={
                            canFullReturn ? (
                                <Button variant="outline" size="xs" onClick={openFullReturn} disabled={processing}>
                                    <FiRotateCcw aria-hidden="true" />
                                    {isPartiallyReturned ? 'Return all that is left' : 'Return the whole bill'}
                                </Button>
                            ) : null
                        }
                    >
                        {!saleFound ? (
                            <div className="rounded-xl border border-dashed border-border py-8 text-center text-body-sm text-muted-foreground">The items appear here once you pick the bill.</div>
                        ) : linkedBill ? (
                            billTable()
                        ) : (
                            looseItems()
                        )}
                    </Step>
                </div>
            </div>

            {/* Right: the refund (like the till's "Current sale") */}
            <aside className="w-[320px] xl:w-[360px] flex-none flex flex-col border-l border-hairline bg-card min-h-0" aria-label="Refund">
                <div className="px-5 pt-5 pb-3 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-body-sm font-semibold" aria-hidden="true">
                        3
                    </span>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-heading text-h4 text-foreground">Refund</h2>
                        <p className="text-caption text-muted-foreground">
                            {linkedBill ? (linkedBill.customer ? 'Goes back to the customer’s account.' : 'Paid back in cash.') : searchMode === 'product' ? 'Paid back in cash.' : 'Pick the sale to see the refund.'}
                        </p>
                    </div>
                    {returnItems.length > 0 && (
                        <Button variant="ghost" size="xs" onClick={() => { setReturnItems([]); setError(''); }} title="Put every picked item back on the bill">
                            Clear
                        </Button>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 flex flex-col gap-4">
                    {returnItems.length ? (
                        <ul className="flex flex-col">
                            {returnItems.map((ri) => (
                                <li key={ri.id} className="flex flex-col gap-1.5 py-2.5 shadow-[inset_0_-1px_0_var(--hairline)] last:shadow-none">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="min-w-0 text-body text-foreground truncate">
                                            {ri.name} <span className="text-muted-foreground">× {ri.quantity}</span>
                                        </span>
                                        <span className="text-body font-medium tabular-nums text-foreground flex-none">{formatCurrency(ri.price * ri.quantity)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select size="xs" className="flex-1 min-w-0" value={ri.reason} onChange={(e) => updateReason(ri.id, e.target.value)} aria-label={`Why ${ri.name} came back`}>
                                            {RETURN_REASONS.map((r) => (
                                                <option key={r.value} value={r.value}>
                                                    {r.label}
                                                </option>
                                            ))}
                                        </Select>
                                        <IconButton label={`Undo ${ri.name}`} size="xs" onClick={() => removeItem(ri.id)}>
                                            <FiX />
                                        </IconButton>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
                            <FiRotateCcw className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
                            <p className="mt-2 text-body-sm text-muted-foreground">Nothing picked yet.</p>
                        </div>
                    )}

                    {linkedBill && linkedBill.customer ? (
                        <div className="flex items-start gap-3 rounded-xl bg-muted px-3 py-2.5">
                            <FiUser className="w-4 h-4 mt-0.5 text-muted-foreground flex-none" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="text-body font-medium text-foreground truncate">Refund to {linkedBill.customerName || 'the customer'}’s account</p>
                                <p className="text-caption text-muted-foreground">No cash is paid. It lowers what they owe, or becomes store credit.</p>
                            </div>
                        </div>
                    ) : null}

                    {linkedBill && !linkedBill.customer && !showFullReturn ? (
                        <AccountPicker method="cash" anyType defaultId={drawerId} value={refundAccountId} onChange={(id) => setRefundAccountId(id)} amount={totalRefund} direction="out" onInsufficientChange={setRefundShort} label="Refund from" />
                    ) : null}

                    {!linkedBill && searchMode === 'product' ? (
                        <>
                            <Field label="Customer name" optional>
                                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in" />
                            </Field>
                            <Field label="Note" optional>
                                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why it came back, condition…" rows={2} />
                            </Field>
                            {REFUND_METHODS.length > 1 && (
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-body-sm font-medium text-foreground">Refund as</span>
                                    <SegmentedControl label="Refund as" value={refundMethod} onChange={setRefundMethod} options={REFUND_METHODS.map((m) => ({ value: m.value, label: m.label }))} />
                                </div>
                            )}
                            {!moneyBookOn && refundMethod === 'cash' && cashBalance != null && (
                                <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${totalRefund > cashBalance ? 'bg-destructive-chip text-destructive-chip-foreground' : 'bg-muted text-muted-foreground'}`}>
                                    <span className="text-body-sm">Cash in the drawer</span>
                                    <span className="text-body font-semibold tabular-nums">
                                        {cashBalance < 0 ? '-' : ''}
                                        {formatCurrency(Math.abs(cashBalance))}
                                    </span>
                                </div>
                            )}
                            <AccountPicker method={refundMethod} value={refundAccountId} onChange={(id) => setRefundAccountId(id)} amount={totalRefund} direction="out" onInsufficientChange={setRefundShort} />
                        </>
                    ) : null}
                </div>

                <div className="border-t border-hairline px-5 py-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-body text-muted-foreground">
                        <span>Items coming back</span>
                        <span className="tabular-nums text-foreground">{totalItems}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <span className="text-body-lg font-medium text-foreground">Refund</span>
                        <span className="font-heading text-h2 tabular-nums text-foreground">{formatCurrency(totalRefund)}</span>
                    </div>
                    {error && returnItems.length > 0 ? (
                        <Alert tone="destructive" icon={FiAlertCircle}>
                            {error}
                        </Alert>
                    ) : null}
                    <Button variant="destructive" size="touch" className="w-full" onClick={processReturn} loading={processing} disabled={processing || returnItems.length === 0}>
                        <FiRotateCcw aria-hidden="true" />
                        {processing ? 'Processing…' : returnItems.length ? `Refund ${formatCurrency(totalRefund)}` : 'Pick items to return'}
                    </Button>
                </div>
            </aside>

            {/* Full Return Confirm Modal */}
            {showFullReturn && linkedBill && (
                <DialogShell size="md" className="max-h-[90vh] overflow-y-auto" onClose={() => { if (!processing) setShowFullReturn(false); }}>
                    <div className="p-6 flex flex-col gap-4">
                        <div>
                            <h3 className="font-heading text-h3 text-foreground">{isPartiallyReturned ? 'Return the remaining items' : 'Return the whole bill'}</h3>
                            <p className="text-body-sm text-muted-foreground">
                                Bill #{linkedBill.billNumber} · {linkedBill.customerName || 'Walk-in'}
                            </p>
                        </div>

                        <div>
                            <p className="mb-1.5 font-mono text-overline-lg uppercase text-muted-foreground">Items to return</p>
                            <ul className="rounded-xl border border-hairline overflow-hidden">
                                {fullReturnLines.map((item) => (
                                    <li key={item._id} className="flex items-center justify-between gap-3 px-3 py-2 text-body shadow-[inset_0_-1px_0_var(--hairline)] last:shadow-none">
                                        <span className="text-foreground truncate">{item.name}</span>
                                        <span className="font-semibold tabular-nums text-foreground shrink-0">
                                            × {item.remaining}
                                            {item.remaining !== item.qty && <span className="ml-1 font-normal text-caption text-muted-foreground">of {item.qty}</span>}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <Field label="Reason" hint="Used for every item.">
                            <Select value={fullReturnReason} onChange={(e) => setFullReturnReason(e.target.value)}>
                                {RETURN_REASONS.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Note" optional>
                            <Input value={fullReturnNote} onChange={(e) => setFullReturnNote(e.target.value)} placeholder="Add a note" />
                        </Field>

                        <div className="rounded-xl bg-muted px-4 py-3">
                            <div className="flex items-center justify-between">
                                <span className="text-body text-muted-foreground">Estimated refund</span>
                                <span className="font-heading text-h4 tabular-nums text-foreground">≈ {formatCurrency(Math.round(fullReturnEstimate * 100) / 100)}</span>
                            </div>
                            <p className="mt-1 text-caption text-muted-foreground">
                                {linkedBill.customer ? "Goes to the customer's account balance." : 'Refunded in cash.'} The exact amount is worked out when the return is saved.
                            </p>
                        </div>

                        {!linkedBill.customer && (
                            <AccountPicker
                                method="cash"
                                anyType
                                defaultId={drawerId}
                                value={refundAccountId}
                                onChange={(id) => setRefundAccountId(id)}
                                amount={Math.round(fullReturnEstimate * 100) / 100}
                                direction="out"
                                onInsufficientChange={setRefundShort}
                                label="Refund from"
                            />
                        )}

                        {fullReturnError && (
                            <Alert tone="destructive" icon={FiAlertCircle}>
                                {fullReturnError}
                            </Alert>
                        )}

                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowFullReturn(false)} disabled={processing}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={processFullReturn} loading={processing} disabled={processing}>
                                <FiRotateCcw aria-hidden="true" />
                                {processing ? 'Processing…' : `Return ${fullReturnQty} item${fullReturnQty === 1 ? '' : 's'}`}
                            </Button>
                        </div>
                    </div>
                </DialogShell>
            )}

            {/* Success Modal */}
            {showSuccess && returnResult && (
                <DialogShell size="md">
                    <div className="p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-success-chip text-success-chip-foreground inline-flex items-center justify-center flex-none">
                                <FiCheck className="w-5 h-5" aria-hidden="true" />
                            </span>
                            <div>
                                <h3 className="font-heading text-h3 text-foreground">Return saved</h3>
                                <p className="text-body-sm text-muted-foreground">Return #{returnResult.returnNumber}</p>
                            </div>
                        </div>

                        <dl className="rounded-xl border border-hairline overflow-hidden text-body">
                            <div className="flex justify-between px-4 py-2.5 shadow-[inset_0_-1px_0_var(--hairline)]">
                                <dt className="text-muted-foreground">Items returned</dt>
                                <dd className="font-medium tabular-nums text-foreground">{returnResult.totalItems}</dd>
                            </div>
                            {returnResult.debtCancelled > 0 ? (
                                <>
                                    <div className="flex justify-between px-4 py-2.5 shadow-[inset_0_-1px_0_var(--hairline)]">
                                        <dt className="text-muted-foreground">Items value</dt>
                                        <dd className="font-medium tabular-nums text-foreground">{formatCurrency(returnResult.refundAmount)}</dd>
                                    </div>
                                    <div className="flex justify-between px-4 py-2.5 shadow-[inset_0_-1px_0_var(--hairline)]">
                                        <dt className="text-muted-foreground">Cash to refund</dt>
                                        <dd className="font-semibold tabular-nums text-destructive">{formatCurrency(returnResult.cashRefundAmount)}</dd>
                                    </div>
                                    <div className="flex justify-between px-4 py-2.5 shadow-[inset_0_-1px_0_var(--hairline)]">
                                        <dt className="text-muted-foreground">Debt written off</dt>
                                        <dd className="tabular-nums text-muted-foreground">{formatCurrency(returnResult.debtCancelled)}</dd>
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-between px-4 py-2.5 shadow-[inset_0_-1px_0_var(--hairline)]">
                                    <dt className="text-muted-foreground">{returnResult.refundMethod === 'ledger_adjust' ? 'Credited to their account' : 'Cash to refund'}</dt>
                                    <dd className="font-semibold tabular-nums text-destructive">{formatCurrency(returnResult.cashRefundAmount ?? returnResult.refundAmount)}</dd>
                                </div>
                            )}
                            <div className="flex justify-between px-4 py-2.5">
                                <dt className="text-muted-foreground">Refunded as</dt>
                                <dd className="font-medium text-foreground capitalize">{(returnResult.refundMethod || refundMethod).replace('_', ' ')}</dd>
                            </div>
                        </dl>
                        {returnResult.creditMoves?.length > 0 && (
                            <div className="flex flex-col gap-1">
                                {returnResult.creditMoves.map((m, i) => (
                                    <p key={i} className="text-body-sm text-success">
                                        {formatCurrency(m.amount)} credit applied to Bill #{m.toNumber}
                                    </p>
                                ))}
                            </div>
                        )}
                        {!returnResult.creditMoves?.length && returnResult.keptCredit > 0 && (
                            <p className="text-body-sm text-success">{formatCurrency(returnResult.keptCredit)} kept as credit for the customer</p>
                        )}

                        <Button variant="primary" size="touch" className="w-full" onClick={resetForm}>
                            New return
                        </Button>
                    </div>
                </DialogShell>
            )}
        </div>
    );
};

export default Returns;
