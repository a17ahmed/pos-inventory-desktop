// The design system's building blocks (design/03-components.md). Import from here:
//   import { Button, SectionCard, StatusBadge, Money } from '../components/ui';
export { cn } from './cn';
export { Button, IconButton, BUTTON_VARIANTS, BUTTON_SIZES } from './Button';
export { Input, Textarea, Select, SearchInput } from './Input';
export { Field } from './Field';
export { Checkbox, Switch, SegmentedControl } from './Choice';
export { StatusChip, StatusBadge, CHIP_TONES } from './StatusChip';
export { Card, CardTitle, CardDescription, InsetCard, SectionCard, CARD_FRAME, INSET_FRAME, FOOTER_GROUND, HERO_WASH } from './Card';
export { Money } from './Money';
export { Spinner, Skeleton, IndeterminateBar } from './Spinner';
export { EmptyState, NoResults, StateCard } from './EmptyState';
// Stage 4 — overlays and feedback
export { Dialog, DialogShell, DialogFooter, ConfirmDialog, DIALOG_SIZES } from './Dialog';
export { Drawer, DrawerShell, DrawerSection, DetailList, DRAWER_SIZES } from './Drawer';
export { Menu } from './Menu';
export { Tooltip } from './Tooltip';
export { toast, useToast, dismissToast, Toaster, setToastPlacement } from './Toast';
export { Banner, Alert } from './Banner';
// Stage 5 — app shell
export { PageHeader } from './PageHeader';
export { Tabs } from './Tabs';
export { DataTable, rowActions, Dash } from './DataTable';
export { TablePager, TableToolbar, TABLE_CARD, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD, TABLE_GROUP_ROW, TABLE_GROUP_TD, TABLE_SCROLL, TABLE_MAX_HEIGHT, TableScroll, useFillHeight, skeletonRowsFor } from './tableSurface';
// Stage 7 — KPI tiles, charts, insight windows
export { KpiCard, KpiStrip, Stat, DeltaChip, percentChange } from './Kpi';
export { ChartPanel, BarChart, BarLineChart, GroupedBarChart, AreaChart, DonutChart, HorizontalBarChart, Sparkline, ChartTable, useChartTheme } from './Charts';
export { InsightDrawer, PeriodControl, periodFor, periodLabel, summaryFilterFor, todayYmd, daysBetween, ymd, parseYmd } from './InsightDrawer';
export { Popover } from './Popover';
export { TopLoadingBar } from './TopLoadingBar';
export { PageSkeleton, TableSkeleton } from './PageSkeleton';
export { FilterButton, DateRangeFields, rangeFor, rangeLabel, presetOf } from './FilterButton';
