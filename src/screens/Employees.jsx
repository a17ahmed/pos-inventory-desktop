import React, { useState, useEffect } from 'react';
import { PageHeader, Button, DataTable, rowActions, Dash, SegmentedControl, StatusBadge, StatusChip } from '../components/ui';
import { DialogShell } from '../components/ui/Dialog';
import { todayLocalDate, toLocalDateStr } from '../utils/date';
import { useBusiness } from '../context/BusinessContext';
import { getEmployees, getEmployeePrefix, createEmployee, updateEmployee, deleteEmployee, reactivateEmployee } from '../services/api/employees';
import { getEmployeeAccess, updateEmployeeAccess } from '../services/api/access';
import { appAlert, appConfirm } from '../components/AppDialog';
import { useMoneyBook } from '../context/MoneyBookContext';
import {
    FiPlus,
    FiSearch,
    FiEdit2,
    FiTrash2,
    FiUsers,
    FiX,
    FiSave,
    FiMail,
    FiPhone,
    FiPercent,
    FiHash,
    FiShield,
    FiDollarSign,
    FiClock,
    FiCalendar,
    FiCheck,
    FiRefreshCw,
    FiFilter,
} from 'react-icons/fi';

// Business type detection
const getBusinessType = (config) => {
    const code = config?.type?.toLowerCase() || '';
    if (['salon', 'spa', 'clinic', 'service', 'ser', 'sal', 'cli'].some(t => code.includes(t))) return 'service';
    if (['restaurant', 'food', 'cafe', 'kitchen', 'res', 'caf'].some(t => code.includes(t))) return 'restaurant';
    return 'retail';
};

const STATUS_OPTIONS = [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'On Leave', value: 'on_leave' },
];

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Access control module definitions
const ACCESS_MODULES = [
    { key: 'pos', label: 'POS / Sales', actions: ['view', 'create', 'viewProfit', 'saveCustomerRates', 'sellBeyondLimit', 'cancelBill', 'amendBill'] },
    { key: 'returns', label: 'Returns', actions: ['view', 'create', 'standalone', 'cancel'] },
    { key: 'products', label: 'Products', actions: ['view', 'create', 'edit', 'delete', 'updateStock'] },
    { key: 'vendors', label: 'Vendors', actions: ['view', 'create', 'edit', 'delete', 'pay'] },
    { key: 'supplies', label: 'Supplies', actions: ['view', 'create', 'edit', 'delete', 'recordPayment', 'processReturn'] },
    { key: 'expenses', label: 'Expenses', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { key: 'customers', label: 'Customers', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'employees', label: 'Employees', actions: ['view', 'create', 'edit', 'delete', 'resetPassword'] },
    { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
    { key: 'reports', label: 'Reports', actions: ['view'] },
    { key: 'closing', label: 'Store Closing', actions: ['view', 'create'] },
    { key: 'settings', label: 'Settings', actions: ['view', 'edit'] },
];

const ACTION_LABELS = {
    view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
    standalone: 'Standalone', updateStock: 'Update Stock', pay: 'Pay', recordPayment: 'Record Payment',
    processReturn: 'Process Return', approve: 'Approve', resetPassword: 'Reset Password',
    resume: 'Resume', cancel: 'Cancel', viewProfit: 'View Profit',
    saveCustomerRates: 'Save Customer Rates', sellBeyondLimit: 'Sell Beyond Discount Limit',
    cancelBill: 'Cancel Bills', amendBill: "Add to today's bill",
    manage: 'Deposit / Withdraw', transfer: 'Transfer between accounts',
};

// Actions the backend treats as ON unless explicitly turned off (missing = allowed)
const DEFAULT_ON_ACTIONS = { pos: ['amendBill'] };
const isDefaultOn = (module, action) => (DEFAULT_ON_ACTIONS[module] || []).includes(action);
const permissionOn = (perms, module, action) =>
    isDefaultOn(module, action) ? perms[module]?.[action] !== false : !!perms[module]?.[action];

// Shown only when the shop has the Money Book on (shops without it keep the
// editor exactly as before)
const MONEY_BOOK_MODULE = { key: 'cashbook', label: 'Money Book', actions: ['view', 'manage', 'transfer'] };

const Employees = () => {
    const { config } = useBusiness();
    const { isOn: moneyBookOn } = useMoneyBook();
    const accessModules = moneyBookOn ? [...ACCESS_MODULES, MONEY_BOOK_MODULE] : ACCESS_MODULES;
    const businessType = getBusinessType(config);
    const isService = businessType === 'service';

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [prefix, setPrefix] = useState('emp@');
    const [generatedId, setGeneratedId] = useState('');

    // Access control state
    const [showAccessModal, setShowAccessModal] = useState(false);
    const [accessEmployee, setAccessEmployee] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [loadingAccess, setLoadingAccess] = useState(false);
    const [savingAccess, setSavingAccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        requirePasswordChange: true,
        status: 'active',
        isManager: false,
        salary: '',
        joiningDate: todayLocalDate(),
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00',
        daysOff: [],
        commissionRate: '',
        specializations: '',
    });

    useEffect(() => {
        fetchEmployees();
        fetchPrefix();
    }, []);

    const [loadError, setLoadError] = useState(null);
    const fetchEmployees = async () => {
        setLoadError(null);
        try {
            const res = await getEmployees();
            setEmployees(res.data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
            setLoadError(error.response?.data?.message || (!navigator.onLine ? 'You seem to be offline.' : 'The server didn\'t answer.'));
        } finally {
            setLoading(false);
        }
    };

    const fetchPrefix = async () => {
        try {
            const res = await getEmployeePrefix();
            setPrefix(res.data?.prefix || 'emp@');
        } catch (error) {
            // fallback handled by default state
        }
    };

    const updateName = (name) => {
        setFormData(prev => ({ ...prev, name }));
        if (!editingEmployee) {
            const username = name.toLowerCase().replace(/\s+/g, '');
            setGeneratedId(username ? `${prefix}${username}` : '');
        }
    };

    const toggleDayOff = (day) => {
        setFormData(prev => ({
            ...prev,
            daysOff: prev.daysOff.includes(day)
                ? prev.daysOff.filter(d => d !== day)
                : [...prev.daysOff, day]
        }));
    };

    const filteredEmployees = employees.filter((e) => {
        if (statusFilter !== 'all' && e.status !== statusFilter) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            e.name?.toLowerCase().includes(q) ||
            e.employeeId?.toLowerCase().includes(q) ||
            e.email?.toLowerCase().includes(q) ||
            e.phone?.includes(searchQuery)
        );
    });

    const openModal = (employee = null) => {
        if (employee) {
            setEditingEmployee(employee);
            setGeneratedId(employee.employeeId || '');
            setFormData({
                name: employee.name || '',
                email: employee.email || '',
                phone: employee.phone || '',
                password: '',
                requirePasswordChange: false,
                status: employee.status || 'active',
                isManager: employee.role === 'manager',
                salary: employee.salary || '',
                joiningDate: employee.joiningDate
                    ? toLocalDateStr(employee.joiningDate)
                    : '',
                workingHoursStart: employee.workingHours?.start || '09:00',
                workingHoursEnd: employee.workingHours?.end || '18:00',
                daysOff: employee.daysOff || [],
                commissionRate: employee.commissionRate || '',
                specializations: (employee.specializations || []).join(', '),
            });
        } else {
            setEditingEmployee(null);
            setGeneratedId('');
            setFormData({
                name: '',
                email: '',
                phone: '',
                password: '',
                requirePasswordChange: true,
                status: 'active',
                isManager: false,
                salary: '',
                joiningDate: todayLocalDate(),
                workingHoursStart: '09:00',
                workingHoursEnd: '18:00',
                daysOff: [],
                commissionRate: '',
                specializations: '',
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const data = {
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                status: formData.status,
                role: formData.isManager ? 'manager' : 'employee',
                salary: Number(formData.salary) || 0,
                joiningDate: formData.joiningDate || undefined,
                workingHours: {
                    start: formData.workingHoursStart,
                    end: formData.workingHoursEnd,
                },
                daysOff: formData.daysOff,
            };

            if (formData.password) data.password = formData.password;

            if (!editingEmployee) {
                data.username = formData.name.toLowerCase().replace(/\s+/g, '');
                data.requirePasswordChange = formData.requirePasswordChange;
                if (!data.password) {
                    appAlert('Password is required');
                    return;
                }
            }

            if (isService) {
                data.commissionRate = parseInt(formData.commissionRate) || 0;
                data.specializations = formData.specializations
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
            }

            if (editingEmployee) {
                await updateEmployee(editingEmployee._id, data);
            } else {
                await createEmployee(data);
            }

            setShowModal(false);
            fetchEmployees();
        } catch (error) {
            console.error('Error saving employee:', error);
            appAlert(error.response?.data?.message || 'Failed to save employee');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (employeeId) => {
        if (!(await appConfirm('Are you sure you want to deactivate this employee? They will not be able to login.', { danger: true }))) return;
        try {
            await deleteEmployee(employeeId);
            fetchEmployees();
        } catch (error) {
            console.error('Error deactivating employee:', error);
            appAlert(error.response?.data?.message || 'Failed to deactivate employee');
        }
    };

    const handleReactivate = async (employeeId) => {
        if (!(await appConfirm('Reactivate this employee? They will be able to login again.', { danger: true }))) return;
        try {
            await reactivateEmployee(employeeId);
            fetchEmployees();
        } catch (error) {
            console.error('Error reactivating employee:', error);
            appAlert(error.response?.data?.message || 'Failed to reactivate employee');
        }
    };

    // Access control handlers
    const openAccessModal = async (employee) => {
        setAccessEmployee(employee);
        setShowAccessModal(true);
        setLoadingAccess(true);
        try {
            const res = await getEmployeeAccess(employee._id);
            setPermissions(res.data?.access?.permissions || {});
        } catch (error) {
            console.error('Error fetching access:', error);
            setPermissions({});
        } finally {
            setLoadingAccess(false);
        }
    };

    const togglePermission = (module, action) => {
        setPermissions(prev => ({
            ...prev,
            [module]: {
                ...prev[module],
                [action]: !permissionOn(prev, module, action)
            }
        }));
    };

    const toggleAllModule = (moduleKey, actions) => {
        const allEnabled = actions.every(a => permissionOn(permissions, moduleKey, a));
        setPermissions(prev => ({
            ...prev,
            [moduleKey]: Object.fromEntries(actions.map(a => [a, !allEnabled]))
        }));
    };

    const handleSaveAccess = async () => {
        setSavingAccess(true);
        try {
            await updateEmployeeAccess(accessEmployee._id, permissions);
            setShowAccessModal(false);
        } catch (error) {
            console.error('Error saving access:', error);
            appAlert('Failed to save permissions');
        } finally {
            setSavingAccess(false);
        }
    };

    const employeeColumns = [
        {
            id: 'name',
            header: 'Name',
            accessorFn: (e) => e.name || '',
            cell: ({ row: { original: e } }) => (
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 flex-none rounded-full bg-accent text-accent-foreground inline-flex items-center justify-center text-caption font-semibold">
                        {(e.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                        <p className="font-medium truncate">{e.name}</p>
                        {e.employeeId ? <p className="font-mono text-mono-xs text-muted-foreground">{e.employeeId}</p> : null}
                    </div>
                </div>
            ),
        },
        {
            id: 'role',
            header: 'Role',
            accessorFn: (e) => (e.role === 'manager' ? 'Manager' : 'Staff'),
            cell: ({ getValue }) => (getValue() === 'Manager' ? <StatusChip size="sm" tone="accent" label="Manager" /> : <span className="text-muted-foreground">Staff</span>),
        },
        {
            id: 'status',
            header: 'Status',
            accessorFn: (e) => e.status || 'active',
            cell: ({ getValue }) => <StatusBadge kind="active" value={String(getValue() !== 'inactive')} size="sm" />,
        },
        { id: 'email', header: 'Email', accessorFn: (e) => e.email || '', cell: ({ getValue }) => getValue() || <Dash /> },
        { id: 'phone', header: 'Phone', accessorFn: (e) => e.phone || '', meta: { mono: true }, cell: ({ getValue }) => getValue() || <Dash /> },
        {
            id: 'salary',
            header: 'Salary / month',
            accessorFn: (e) => Number(e.salary) || 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => (getValue() > 0 ? getValue().toLocaleString() : <Dash />),
        },
        {
            id: 'hours',
            header: 'Hours',
            accessorFn: (e) => (e.workingHours ? `${e.workingHours.start} - ${e.workingHours.end}` : ''),
            cell: ({ getValue }) => (getValue() ? <span className="text-muted-foreground whitespace-nowrap">{getValue()}</span> : <Dash />),
        },
        ...(isService
            ? [
                  {
                      id: 'commission',
                      header: 'Commission',
                      accessorFn: (e) => Number(e.commissionRate) || 0,
                      meta: { align: 'right' },
                      cell: ({ getValue }) => (getValue() > 0 ? `${getValue()}%` : <Dash />),
                  },
              ]
            : []),
        rowActions(
            (e) =>
                e.status === 'inactive'
                    ? [{ label: 'Reactivate', icon: FiRefreshCw, onSelect: () => handleReactivate(e._id) }]
                    : [
                          { label: 'Edit', icon: FiEdit2, onSelect: () => openModal(e) },
                          { label: 'Access control', icon: FiShield, onSelect: () => openAccessModal(e) },
                          { separator: true },
                          { label: 'Deactivate', icon: FiTrash2, danger: true, onSelect: () => handleDelete(e._id) },
                      ],
            { label: 'Employee actions' }
        ),
    ];

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return 'bg-success-chip text-success';
            case 'inactive':
                return 'bg-destructive-chip text-destructive';
            case 'on_leave':
                return 'bg-warning-chip text-warning-chip-foreground';
            default:
                return 'bg-muted text-muted-foreground';
        }
    };

    const inputClass = "w-full px-4 py-2 bg-card border border-hairline rounded-xl text-foreground placeholder:text-placeholder focus:outline-none focus:border-primary/30";
    const labelClass = "block text-sm font-medium text-foreground mb-1";

    return (
        <div className="p-6 animate-fadeIn min-h-full">
            {/* Header */}
            <PageHeader
                title={config?.staffLabel || 'Staff'}
                subtitle={`${employees.length} ${employees.length === 1 ? 'person' : 'people'} who can sign in at the counter`}
                actions={
                    <Button onClick={() => openModal()}>
                        <FiPlus aria-hidden="true" />
                        Add person
                    </Button>
                }
            />

            <DataTable
                id="employees"
                caption="Employees"
                data={filteredEmployees}
                columns={employeeColumns}
                getRowId={(e) => e._id}
                loading={loading}
                error={loadError ? { message: loadError, onRetry: () => { setLoading(true); fetchEmployees(); } } : null}
                search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search by name, ID, email or phone' }}
                filters={
                    <SegmentedControl
                        label="Status"
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: 'Inactive' },
                            { value: 'all', label: 'All' },
                        ]}
                    />
                }
                isFiltered={!!searchQuery || (statusFilter !== 'all' && employees.length > 0)}
                onClearFilters={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                }}
                empty={{ icon: FiUsers, title: 'No employees yet', description: 'Add the people who sell at your counter.' }}
                onRowClick={(e) => (e.status === 'inactive' ? null : openModal(e))}
                rowLabel={(e) => `Edit ${e.name}`}
                rowClassName={(e) => (e.status === 'inactive' ? 'opacity-70' : '')}
                initialSort={[{ id: 'name', desc: false }]}
            />

            {/* Add/Edit Employee Modal */}
            {showModal && (
                <DialogShell size="md" className="max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-hairline sticky top-0 bg-card rounded-t-2xl z-10">
                            <h3 className="text-xl font-semibold text-foreground">
                                {editingEmployee ? 'Edit Employee' : 'Add Employee'}
                            </h3>
                            <button data-dialog-close
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg transition-colors text-muted-foreground"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className={labelClass}>Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => updateName(e.target.value)}
                                    className={inputClass}
                                    required
                                    placeholder="Full name"
                                />
                            </div>

                            {/* Employee ID */}
                            <div>
                                <label className={labelClass}>Employee ID</label>
                                <div className={`${inputClass} bg-muted/40 flex items-center gap-2`}>
                                    <FiHash size={14} className="text-muted-foreground" />
                                    <span className={generatedId || editingEmployee?.employeeId ? 'text-foreground' : 'text-muted-foreground'}>
                                        {editingEmployee ? editingEmployee.employeeId : (generatedId || 'Auto-generated from name')}
                                    </span>
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className={labelClass}>
                                    {editingEmployee ? 'New Password (leave empty to keep)' : 'Password *'}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={inputClass}
                                    required={!editingEmployee}
                                    placeholder={editingEmployee ? 'Leave empty to keep current' : 'Min 4 characters'}
                                    minLength={formData.password ? 4 : undefined}
                                />
                            </div>

                            {/* Require Password Change */}
                            {!editingEmployee && (
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.requirePasswordChange}
                                        onChange={(e) => setFormData({ ...formData, requirePasswordChange: e.target.checked })}
                                        className="w-4 h-4 rounded border-border text-primary focus:ring-ring"
                                    />
                                    <span className="text-sm text-foreground">
                                        Require password change on first login
                                    </span>
                                </label>
                            )}

                            {/* Phone & Email */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Phone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className={inputClass}
                                        placeholder="Phone number"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className={inputClass}
                                        placeholder="Email address"
                                    />
                                </div>
                            </div>

                            {/* Status & Salary */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className={inputClass}
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Salary</label>
                                    <input
                                        type="number"
                                        value={formData.salary}
                                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                                        className={inputClass}
                                        placeholder="Monthly salary"
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Manager toggle */}
                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-accent rounded-xl border border-primary/30">
                                <input
                                    type="checkbox"
                                    checked={formData.isManager}
                                    onChange={(e) => setFormData({ ...formData, isManager: e.target.checked })}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-ring"
                                />
                                <div>
                                    <span className="text-sm font-medium text-primary">Manager Access</span>
                                    <p className="text-xs text-primary">Can manage other employees and their permissions</p>
                                </div>
                            </label>

                            {/* Working Hours & Joining Date */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>Start Time</label>
                                    <input
                                        type="time"
                                        value={formData.workingHoursStart}
                                        onChange={(e) => setFormData({ ...formData, workingHoursStart: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>End Time</label>
                                    <input
                                        type="time"
                                        value={formData.workingHoursEnd}
                                        onChange={(e) => setFormData({ ...formData, workingHoursEnd: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Joining Date</label>
                                    <input
                                        type="date"
                                        value={formData.joiningDate}
                                        onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            {/* Days Off */}
                            <div>
                                <label className={labelClass}>Days Off</label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map(day => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleDayOff(day)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                formData.daysOff.includes(day)
                                                    ? 'bg-accent text-primary border border-primary/30'
                                                    : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
                                            }`}
                                        >
                                            {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Service-only fields */}
                            {isService && (
                                <>
                                    <div>
                                        <label className={labelClass}>Specializations</label>
                                        <input
                                            type="text"
                                            value={formData.specializations}
                                            onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
                                            className={inputClass}
                                            placeholder="e.g. Haircut, Coloring, Styling"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Comma-separated</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Commission Rate (%)</label>
                                        <input
                                            type="number"
                                            value={formData.commissionRate}
                                            onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                                            className={inputClass}
                                            min="0" max="100" placeholder="0"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 border border-hairline rounded-xl font-medium text-muted-foreground hover:bg-[var(--hover-overlay)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <FiSave /> {submitting ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </DialogShell>
            )}

            {/* Access Control Modal */}
            {showAccessModal && accessEmployee && (
                <DialogShell size="lg" className="max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-hairline sticky top-0 bg-card rounded-t-2xl z-10">
                            <div>
                                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                    <FiShield className="text-primary" />
                                    Access Control
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {accessEmployee.name} ({accessEmployee.employeeId})
                                </p>
                            </div>
                            <button data-dialog-close
                                onClick={() => setShowAccessModal(false)}
                                className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg transition-colors text-muted-foreground"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className="p-6">
                            {loadingAccess ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {accessModules.map(mod => {
                                        const allEnabled = mod.actions.every(a => permissionOn(permissions, mod.key, a));
                                        const someEnabled = mod.actions.some(a => permissionOn(permissions, mod.key, a));

                                        return (
                                            <div key={mod.key} className="border border-hairline rounded-xl overflow-hidden">
                                                {/* Module header */}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAllModule(mod.key, mod.actions)}
                                                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-[var(--hover-overlay)] transition-colors"
                                                >
                                                    <span className="font-medium text-foreground text-sm">{mod.label}</span>
                                                    <div className={`w-5 h-5 rounded flex items-center justify-center text-white text-xs ${
                                                        allEnabled ? 'bg-primary' : someEnabled ? 'bg-primary/25' : 'bg-border'
                                                    }`}>
                                                        {allEnabled && <FiCheck size={12} />}
                                                        {someEnabled && !allEnabled && <span className="w-2 h-0.5 bg-card rounded" />}
                                                    </div>
                                                </button>

                                                {/* Actions */}
                                                <div className="px-4 py-3 flex flex-wrap gap-2">
                                                    {mod.actions.map(action => (
                                                        <button
                                                            key={action}
                                                            type="button"
                                                            onClick={() => togglePermission(mod.key, action)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                                permissionOn(permissions, mod.key, action)
                                                                    ? 'bg-accent text-primary border border-primary/30'
                                                                    : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
                                                            }`}
                                                        >
                                                            {ACTION_LABELS[action] || action}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="flex gap-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAccessModal(false)}
                                    className="flex-1 py-3 border border-hairline rounded-xl font-medium text-muted-foreground hover:bg-[var(--hover-overlay)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveAccess}
                                    disabled={savingAccess || loadingAccess}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingAccess ? (
                                        <div className="w-5 h-5 border-2 border-hairline border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FiShield />
                                    )}
                                    Save Permissions
                                </button>
                            </div>
                        </div>
                    </DialogShell>
            )}
        </div>
    );
};

export default Employees;
