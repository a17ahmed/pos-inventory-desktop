import {
    FiHome,
    FiShoppingCart,
    FiPackage,
    FiRotateCcw,
    FiBarChart2,
    FiUser,
    FiUsers,
    FiFileText,
    FiDollarSign,
    FiSettings,
    FiPieChart,
    FiTruck,
    FiUserPlus,
    FiLayers,
    FiBook,
    FiLock,
} from 'react-icons/fi';

// The sidebar's pages, in groups (design/ROADMAP.md 5.1). Which pages a person sees follows
// exactly the old rules in Layout.jsx: admins see everything; employees see a page when
// permissions[module].view is true ("Home" — the POS — needs the pos permission; Profile is
// always shown).

const page = (path, icon, label, module, extra = {}) => ({ path, icon, label, module, ...extra });

/**
 * Returns [{ id, label, items: [{ path, icon, label, module }] }] for this user, empty groups
 * removed. `labels` = { items, staff, cashBook } from the shop's config.
 */
export function buildNav({ isAdmin, isEmployee, permissions, labels }) {
    const items = labels?.items || 'Products';
    const staff = labels?.staff || 'Employees';
    const cashBook = labels?.cashBook || 'Cash Book';

    const groups = isEmployee
        ? [
              { id: 'sell', label: 'Sell', items: [page('/dashboard', FiShoppingCart, 'Home', 'pos'), page('/analytics', FiBarChart2, 'Dashboard', 'dashboard'), page('/receipts', FiFileText, 'Receipts', 'pos'), page('/returns', FiRotateCcw, 'Returns', 'returns')] },
              { id: 'stock', label: 'Stock', items: [page('/products', FiPackage, items, 'products'), page('/inventory', FiLayers, 'Inventory', 'products'), page('/vendors', FiTruck, 'Vendors', 'vendors')] },
              { id: 'money', label: 'Money', items: [page('/cashbook', FiBook, cashBook, 'cashbook'), page('/expenses', FiDollarSign, 'Expenses', 'expenses'), page('/closing', FiLock, 'Closing', 'closing'), page('/reports', FiPieChart, 'Reports', 'reports')] },
              { id: 'people', label: 'People', items: [page('/customers', FiUserPlus, 'Customers', 'customers'), page('/employees', FiUsers, staff, 'employees')] },
              { id: 'shop', label: 'Shop', items: [page('/settings', FiSettings, 'Settings', 'settings'), page('/profile', FiUser, 'Profile', null)] },
          ]
        : [
              { id: 'sell', label: 'Sell', items: [page('/dashboard', FiHome, 'Dashboard', 'dashboard'), page('/receipts', FiFileText, 'Receipts', 'pos'), page('/returns', FiRotateCcw, 'Returns', 'returns')] },
              { id: 'stock', label: 'Stock', items: [page('/products', FiPackage, items, 'products'), page('/inventory', FiLayers, 'Inventory', 'products'), page('/vendors', FiTruck, 'Vendors', 'vendors')] },
              { id: 'money', label: 'Money', items: [page('/cashbook', FiBook, cashBook, 'cashbook'), page('/expenses', FiDollarSign, 'Expenses', 'expenses'), page('/closing', FiLock, 'Closing', 'closing'), page('/reports', FiPieChart, 'Reports', 'reports')] },
              { id: 'people', label: 'People', items: [page('/customers', FiUserPlus, 'Customers', 'customers'), page('/employees', FiUsers, staff, 'employees')] },
              { id: 'shop', label: 'Shop', items: [page('/settings', FiSettings, 'Settings', 'settings')] },
          ];

    const allowed = (item) => {
        if (!isEmployee) return true; // admin / owner
        if (!item.module) return true; // Profile
        if (!permissions) return item.module === 'pos';
        return permissions[item.module]?.view === true;
    };

    return groups.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length > 0);
}

// Pages below a sidebar page (they show "Parent / This" in the breadcrumb)
const SUB_PAGES = [
    { match: /^\/customers\/[^/]+\/ledger/, parent: '/customers', label: 'Ledger' },
    { match: /^\/vendors\/[^/]+\/ledger/, parent: '/vendors', label: 'Ledger' },
    { match: /^\/closing\/[^/]+/, parent: '/closing', label: 'Closing report' },
    { match: /^\/sales/, parent: '/dashboard', label: 'Sales' },
    { match: /^\/design-lab/, parent: null, label: 'Design Lab', group: 'Development' },
];

/** Breadcrumb for a path: [{ label, to? }] — group, page, and sub-page when there is one. */
export function breadcrumbFor(pathname, groups) {
    const path = pathname === '/' ? '/dashboard' : pathname;
    const find = (p) => {
        for (const g of groups) {
            const it = g.items.find((i) => i.path === p);
            if (it) return { group: g, item: it };
        }
        return null;
    };
    const sub = SUB_PAGES.find((s) => s.match.test(path));
    if (sub) {
        if (!sub.parent) return [{ label: sub.group }, { label: sub.label }];
        const hit = find(sub.parent);
        return hit ? [{ label: hit.group.label }, { label: hit.item.label, to: hit.item.path }, { label: sub.label }] : [{ label: sub.label }];
    }
    const hit = find(path);
    return hit ? [{ label: hit.group.label }, { label: hit.item.label }] : [];
}
