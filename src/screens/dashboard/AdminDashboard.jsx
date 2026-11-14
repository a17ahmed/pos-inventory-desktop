import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiRefreshCw } from 'react-icons/fi';
import { useBusiness } from '../../context/BusinessContext';
import { Button, Tabs } from '../../components/ui';
import OverviewTab from './OverviewTab';
import InsightsTab from './InsightsTab';
import { TodayTab, ProductsTab, CustomersTab, VendorsTab, ExpensesTab, MoneyTab, ClosingsTab } from './ShopTabs';

// Owner's dashboard: one page, one tab per part of the shop (like the platform admin's shop page).
// Each tab is a summary + one focused list; the full screens stay in the sidebar. The open tab
// lives in the URL (?tab=…) so a reload or the back button keeps it.

const TABS = [
    { value: 'overview', label: 'Overview', Body: OverviewTab },
    { value: 'insights', label: 'Insights', Body: InsightsTab },
    { value: 'today', label: 'Today & bills', Body: TodayTab },
    { value: 'products', label: 'Products', Body: ProductsTab },
    { value: 'customers', label: 'Customers', Body: CustomersTab },
    { value: 'vendors', label: 'Vendors & supplies', Body: VendorsTab },
    { value: 'expenses', label: 'Expenses', Body: ExpensesTab },
    { value: 'money', label: 'Money', Body: MoneyTab },
    { value: 'closings', label: 'Closings', Body: ClosingsTab },
];

export default function AdminDashboard() {
    const { business } = useBusiness();
    const [params, setParams] = useSearchParams();
    const current = TABS.find((t) => t.value === params.get('tab')) || TABS[0];
    const setTab = (v) => setParams(v === TABS[0].value ? {} : { tab: v });
    const [refreshKey, setRefreshKey] = useState(0);
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(t);
    }, []);
    const Body = current.Body;

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-6 flex flex-col gap-4 max-w-[1600px] mx-auto">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-mono text-overline-lg uppercase text-muted-foreground">
                            {now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <h1 className="font-heading text-h2 text-foreground">{business?.name || 'Dashboard'}</h1>
                    </div>
                    <Button variant="ghost" size="xs" onClick={() => setRefreshKey((k) => k + 1)}>
                        <FiRefreshCw aria-hidden="true" />
                        Refresh
                    </Button>
                </div>

                <Tabs label="Dashboard sections" value={current.value} onChange={setTab} items={TABS.map(({ value, label }) => ({ value, label }))} />

                <div role="tabpanel" aria-label={current.label} className="flex flex-col gap-4">
                    <Body key={current.value} refreshKey={refreshKey} onOpenTab={setTab} />
                </div>
            </div>
        </div>
    );
}
