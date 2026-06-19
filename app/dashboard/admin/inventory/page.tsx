'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/context';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Store } from '@/lib/db';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import {
    TrendingUp, TrendingDown, ArrowLeft, Calendar, AlertTriangle,
    Search, Boxes, Download, History, Package, ArrowUpDown, ArrowUp, ArrowDown,
    ChevronDown, Filter, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ─────────────────────────────────────────────────── */

interface ProductStat {
    productId: string;
    productName: string;
    category: string;
    openingStock: number;
    totalRestocked: number;
    totalSold: number;
    totalExported: number;
    totalDecrement: number;
    totalRevenue: number;
    currentStock: number;
    closingStock: number;
}

interface InventoryLog {
    id: string;
    productName: string;
    quantity: number;
    createdAt: string;
    type: string;
    note?: string;
}

/* ─── Constants ──────────────────────────────────────────────── */

const CAT_LABELS: Record<string, string> = {
    food: 'Đồ ăn',
    drink: 'Đồ uống',
    dry: 'Đồ khô',
    fruit: 'Trái cây',
};

const WORK_DAY_START_HOUR = 6;

function getWorkingDay(date: Date): Date {
    const d = new Date(date);
    if (d.getHours() < WORK_DAY_START_HOUR) {
        d.setDate(d.getDate() - 1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
}

function getWorkingDayKey(date: Date): string {
    const d = getWorkingDay(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDayShort(d: Date): string {
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const WEEKDAY_SHORT_VI = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function formatDayWithWeekday(d: Date): string {
    return `${WEEKDAY_SHORT_VI[d.getDay()]}, ${formatDayShort(d)}`;
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

function getWeekKey(date: Date): string {
    const d = getWeekStart(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatWeekLabel(weekStart: Date): string {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${formatDayShort(weekStart)} – ${formatDayShort(end)}`;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
const PIE_COLORS = ['#3b82f6', '#10b981', '#f97316', '#a78bfa', '#64748b'];

const PERIOD_OPTIONS = [
    { id: 'monthly', label: 'Tháng' },
    { id: 'yearly', label: 'Năm' },
] as const;

type PeriodType = typeof PERIOD_OPTIONS[number]['id'];

/* ─── Custom Recharts Tooltip ─────────────────────────────────── */

const CustomBarTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs font-semibold text-gray-700">
            Đã bán: <span className="text-emerald-600">{payload[0].value?.toLocaleString('vi-VN')}</span>
        </div>
    );
};

const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs font-semibold text-gray-700">
            {payload[0].name}: <span className="text-blue-600">{payload[0].value?.toLocaleString('vi-VN')}</span>
        </div>
    );
};

const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs font-semibold text-gray-700">
            <p className="text-gray-400 text-[10px] mb-0.5">{label}</p>
            Tổng: <span className="text-emerald-600">{payload[0].value?.toLocaleString('vi-VN')}</span>
        </div>
    );
};

const CustomHistoryBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs font-semibold text-gray-700">
            <p className="text-gray-500 mb-0.5">{label}</p>
            Nhập: <span className="text-emerald-600">+{payload[0].value?.toLocaleString('vi-VN')}</span>
        </div>
    );
};

/* ─── Stock Badge ─────────────────────────────────────────────── */
function StockBadge({ stock }: { stock: number }) {
    return (
        <span className={`
            inline-block px-2.5 py-0.5 rounded-full text-xs font-bold
            ${stock > 5 ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-600'}
        `}>
            {stock}
        </span>
    );
}

function StatusPill({ quantity }: { quantity: number }) {
    return quantity >= 0 ? (
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold border border-emerald-100">
            Nhập
        </span>
    ) : (
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[11px] font-semibold border border-red-100">
            Xuất
        </span>
    );
}

/* ─── Main Page ──────────────────────────────────────────────── */

export default function InventoryStatsPage() {
    const { user } = useAuth();
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [reportType, setReportType] = useState<PeriodType>('monthly');
    const [stats, setStats] = useState<ProductStat[]>([]);
    const [lifetimeStats, setLifetimeStats] = useState<ProductStat[]>([]);
    const [logs, setLogs] = useState<InventoryLog[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [logDirection, setLogDirection] = useState<'all' | 'in' | 'out'>('all');
    const [activeTab, setActiveTab] = useState<'sales' | 'history'>('sales');
    const [monthlyStock, setMonthlyStock] = useState<{
        key: string; label: string;
        rows: { productId: string; productName: string; category: string; opening: number; restock: number; sold: number; exported: number; closing: number }[];
    }[]>([]);
    const [loadingMonthly, setLoadingMonthly] = useState(false);
    const [expandedWeeklyKeys, setExpandedWeeklyKeys] = useState<Record<string, boolean>>({});
    const [statsPage, setStatsPage] = useState(1);
    const [logsPage, setLogsPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    /* ── Fetch stores on mount ─── */
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const res = await fetch('/api/admin/stores');
                let data = await res.json();
                if (user?.storeId && user.storeId !== 'all') {
                    data = data.filter((s: Store) => s.id === user.storeId);
                }
                setStores(data);
                const initialStoreId = (user?.storeId && user.storeId !== 'all') ? user.storeId : (data[0]?.id || '');
                setSelectedStoreId(initialStoreId);
            } catch {
                toast.error('Không thể tải danh sách chi nhánh');
            }
        };
        fetchInitialData();
    }, [user]);

    /* ── Fetch stats when filters change ─── */
    useEffect(() => {
        if (selectedStoreId) fetchInventoryStats();
    }, [selectedStoreId, reportType, startDate, endDate]);

    /* ── Fetch invoices ─── */
    useEffect(() => {
        if (!selectedStoreId) return;
        fetch(`/api/invoices?storeId=${selectedStoreId}`, { cache: 'no-store' })
            .then(r => r.ok ? r.json() : [])
            .then(data => setInvoices(Array.isArray(data) ? data : []))
            .catch(() => setInvoices([]));
    }, [selectedStoreId]);

    /* ── Fetch lifetime stats ─── */
    useEffect(() => {
        if (!selectedStoreId) return;
        fetch(`/api/admin/inventory?storeId=${selectedStoreId}&startDate=1970-01-01&type=daily`, { cache: 'no-store' })
            .then(r => r.ok ? r.json() : { stats: [] })
            .then(data => setLifetimeStats(Array.isArray(data.stats) ? data.stats : []))
            .catch(() => setLifetimeStats([]));
    }, [selectedStoreId]);

    const fetchInventoryStats = async () => {
        setIsLoading(true);
        try {
            let url = `/api/admin/inventory?storeId=${selectedStoreId}&type=${reportType}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setStats(Array.isArray(data.stats) ? data.stats : []);
                setLogs(Array.isArray(data.logs) ? data.logs : []);
            } else {
                setStats([]);
                setLogs([]);
            }
        } catch {
            toast.error('Lỗi khi tải dữ liệu thống kê kho');
        } finally {
            setIsLoading(false);
        }
    };

    /* ── Tính sổ kho theo từng tháng ─── */
    const computeMonthlyStock = async (): Promise<typeof monthlyStock> => {
        if (!selectedStoreId) return [];
        const fmt = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const months: { y: number; m: number }[] = [];
        let cur = new Date(effectivePeriod.start.getFullYear(), effectivePeriod.start.getMonth(), 1);
        const last = new Date(effectivePeriod.end.getFullYear(), effectivePeriod.end.getMonth(), 1);
        while (cur <= last && months.length < 24) {
            months.push({ y: cur.getFullYear(), m: cur.getMonth() });
            cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        }
        const results = await Promise.all(months.map(async ({ y, m }) => {
            const mStart = fmt(new Date(y, m, 1));
            const mEnd = fmt(new Date(y, m + 1, 0));
            const res = await fetch(
                `/api/admin/inventory?storeId=${selectedStoreId}&startDate=${mStart}&endDate=${mEnd}&type=monthly`,
                { cache: 'no-store' }
            );
            const data = res.ok ? await res.json() : { stats: [] };
            const stats: ProductStat[] = Array.isArray(data.stats) ? data.stats : [];
            return {
                key: `${y}-${String(m + 1).padStart(2, '0')}`,
                label: `Tháng ${m + 1}/${y}`,
                rows: stats.map(s => ({
                    productId: s.productId,
                    productName: s.productName,
                    category: s.category,
                    opening: Math.max(0, Math.round(s.openingStock)),
                    restock: Math.round(s.totalRestocked),
                    sold: Math.round(s.totalSold),
                    exported: Math.round(s.totalExported),
                    closing: Math.round(s.closingStock),
                })),
            };
        }));
        results.sort((a, b) => b.key.localeCompare(a.key));
        return results;
    };

    const loadMonthlyStock = async () => {
        if (!selectedStoreId) return;
        setLoadingMonthly(true);
        try {
            setMonthlyStock(await computeMonthlyStock());
        } catch {
            toast.error('Lỗi khi tải sổ kho theo tháng');
        } finally {
            setLoadingMonthly(false);
        }
    };

    /* ── Derived data ─── */
    const productCategoryLookup = useMemo(() => {
        const m = new Map<string, string>();
        for (const s of stats) m.set(s.productId, s.category);
        return m;
    }, [stats]);

    const effectivePeriod = useMemo(() => {
        let start: Date;
        let end: Date;
        if (startDate) {
            start = new Date(startDate); start.setHours(0, 0, 0, 0);
            end = endDate ? new Date(endDate) : new Date();
            end.setHours(23, 59, 59, 999);
        } else {
            const now = new Date();
            end = new Date(); end.setHours(23, 59, 59, 999);
            start = new Date();
            if (reportType === 'monthly') {
                start = new Date(now.getFullYear(), now.getMonth(), 1);
            } else if (reportType === 'yearly') {
                start = new Date(now.getFullYear(), 0, 1);
            } else {
                start.setHours(0, 0, 0, 0);
            }
        }
        return { start, end };
    }, [startDate, endDate, reportType]);

    const salesByProduct = useMemo(() => {
        type ProductSales = { inRoom: number; offsite: number; revenue: number };
        const m = new Map<string, ProductSales>();
        for (const inv of invoices) {
            if (inv.status !== 'paid') continue;
            const t = new Date(inv.startTime);
            if (t < effectivePeriod.start || t > effectivePeriod.end) continue;
            const isOffsite = typeof inv.id === 'string' && (inv.id.startsWith('TKW') || inv.id.startsWith('GFT'));
            for (const item of (inv.items || [])) {
                const cur = m.get(item.productId) || { inRoom: 0, offsite: 0, revenue: 0 };
                if (isOffsite) cur.offsite += item.quantity;
                else cur.inRoom += item.quantity;
                cur.revenue += Number(item.price || 0) * Number(item.quantity || 0);
                m.set(item.productId, cur);
            }
        }
        return m;
    }, [invoices, effectivePeriod]);

    const lifetimeTotalCreatedLookup = useMemo(() => {
        const m = new Map<string, number>();
        for (const s of lifetimeStats) {
            m.set(s.productId, s.openingStock + s.totalRestocked);
        }
        return m;
    }, [lifetimeStats]);

    const augmentedStats = useMemo(() => {
        return stats.map(s => {
            const sales = salesByProduct.get(s.productId) || { inRoom: 0, offsite: 0, revenue: 0 };
            const totalCreated = lifetimeTotalCreatedLookup.get(s.productId) ?? (s.openingStock + s.totalRestocked);
            const inRoom = sales.inRoom;
            const otherOutput = sales.offsite + s.totalExported;
            const remaining = totalCreated - inRoom - otherOutput;
            const salesMetric = inRoom + sales.offsite;
            return {
                ...s,
                totalCreated,
                inRoom,
                otherOutput,
                remaining,
                computedRevenue: sales.revenue,
                salesMetric,
            };
        });
    }, [stats, salesByProduct, lifetimeTotalCreatedLookup]);

    const bestSellers = useMemo(
        () => [...augmentedStats].sort((a, b) => b.salesMetric - a.salesMetric).slice(0, 5),
        [augmentedStats]
    );

    const slowMoving = useMemo(
        () => [...augmentedStats].sort((a, b) => a.salesMetric - b.salesMetric).slice(0, 5),
        [augmentedStats]
    );

    const lowStockProducts = useMemo(
        () => stats.filter(s => s.currentStock <= 5),
        [stats]
    );

    const categoryData = useMemo(() => {
        const groups: Record<string, number> = {};
        augmentedStats.forEach(s => {
            groups[s.category] = (groups[s.category] || 0) + s.salesMetric;
        });
        return Object.entries(groups).map(([key, value]) => ({
            name: CAT_LABELS[key] ?? 'Khác',
            value,
        }));
    }, [augmentedStats]);

    const filteredStats = useMemo(
        () => augmentedStats.filter(s => s.productName.toLowerCase().includes(searchTerm.toLowerCase())),
        [augmentedStats, searchTerm]
    );

    const isCancelReturnLog = (l: InventoryLog) =>
        l.id?.startsWith('RETURN-') || (l.note ?? '').startsWith('Hoàn kho do hủy phòng');

    const filteredLogs = useMemo(
        () => logs.filter(l => {
            if (isCancelReturnLog(l)) return false;
            if (!l.productName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (logDirection === 'in' && l.quantity < 0) return false;
            if (logDirection === 'out' && l.quantity >= 0) return false;
            return true;
        }),
        [logs, searchTerm, logDirection]
    );

    const paginatedLogs = useMemo(() => {
        const start = (logsPage - 1) * pageSize;
        return filteredLogs.slice(start, start + pageSize);
    }, [filteredLogs, logsPage, pageSize]);

    const logsByMonth = useMemo(() => {
        const groups: { key: string; label: string; items: InventoryLog[]; totalIn: number; totalOut: number }[] = [];
        const index: Record<string, number> = {};
        for (const log of paginatedLogs) { // Thay đổi ở đây: lặp qua dữ liệu đã phân trang
            const d = new Date(log.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (index[key] === undefined) {
                index[key] = groups.length;
                groups.push({ key, label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`, items: [], totalIn: 0, totalOut: 0 });
            }
            const g = groups[index[key]];
            g.items.push(log);
            if (log.quantity >= 0) g.totalIn += log.quantity;
            else g.totalOut += Math.abs(log.quantity);
        }
        return groups;
    }, [paginatedLogs]); // FIX: trước đây là [filteredLogs] khiến đổi pageSize/logsPage không cập nhật bảng

    /* ── Sản lượng bán theo ngày trong tháng (ma trận) ─── */
    const dailySalesMatrix = useMemo(() => {
        // Tính tất cả các ngày trong period
        const dayKeys: string[] = [];
        const dayLabels: { key: string; date: Date; label: string }[] = [];
        const cur = new Date(effectivePeriod.start);
        cur.setHours(0, 0, 0, 0);
        while (cur <= effectivePeriod.end && dayLabels.length < 31) {
            const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
            dayKeys.push(key);
            dayLabels.push({ key, date: new Date(cur), label: `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}` });
            cur.setDate(cur.getDate() + 1);
        }

        // productId -> { productName, days: dayKey -> qty }
        const productMap = new Map<string, { productName: string; days: Map<string, number> }>();
        for (const inv of invoices) {
            if (inv.status !== 'paid') continue;
            const t = new Date(inv.startTime);
            if (t < effectivePeriod.start || t > effectivePeriod.end) continue;
            const dayDate = getWorkingDay(t);
            const dayKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
            for (const item of (inv.items || [])) {
                if (!productMap.has(item.productId)) {
                    productMap.set(item.productId, { productName: item.productName, days: new Map() });
                }
                const p = productMap.get(item.productId)!;
                p.days.set(dayKey, (p.days.get(dayKey) || 0) + item.quantity);
            }
        }

        const rows = [...productMap.entries()].map(([productId, p]) => {
            const total = [...p.days.values()].reduce((a, b) => a + b, 0);
            return { productId, productName: p.productName, days: p.days, total };
        }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);

        const grandTotalByDay = new Map<string, number>();
        for (const row of rows) {
            for (const [dk, qty] of row.days.entries()) {
                grandTotalByDay.set(dk, (grandTotalByDay.get(dk) || 0) + qty);
            }
        }

        return { dayLabels, rows, grandTotalByDay };
    }, [invoices, effectivePeriod]);

    /* ── History monthly chart data (cho tab lịch sử) ─── */
    const historyMonthlyChart = useMemo(() => {
        const m = new Map<string, number>();
        for (const log of logs) {
            if (log.quantity <= 0) continue;
            const d = new Date(log.createdAt);
            const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            m.set(key, (m.get(key) || 0) + log.quantity);
        }
        return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label));
    }, [logs]);

    /* ── History KPIs ─── */
    const historyKpis = useMemo(() => {
        const totalLogs = filteredLogs.length;
        const totalIn = filteredLogs.filter(l => l.quantity > 0).reduce((a, l) => a + l.quantity, 0);
        const mostIn = [...augmentedStats].sort((a, b) => b.totalRestocked - a.totalRestocked)[0];
        const leastIn = [...augmentedStats].sort((a, b) => a.totalRestocked - b.totalRestocked)[0];
        return { totalLogs, totalIn, mostIn, leastIn };
    }, [filteredLogs, augmentedStats]);

    /* ── Sản lượng theo TUẦN × sản phẩm ─── */
    const weeklySalesRows = useMemo(() => {
        type DailyEntry = { dayKey: string; dayDate: Date; inRoom: number; takeawayGift: number; revenue: number };
        type ProductBucket = {
            productName: string;
            category: string;
            totalInRoom: number;
            totalTakeawayGift: number;
            totalRevenue: number;
            days: Map<string, DailyEntry>;
        };
        const byWeek = new Map<string, { weekStart: Date; products: Map<string, ProductBucket> }>();
        for (const inv of invoices) {
            if (inv.status !== 'paid') continue;
            const t = new Date(inv.startTime);
            const dayDate = getWorkingDay(t);
            const dayKey = getWorkingDayKey(t);
            const weekKey = getWeekKey(dayDate);
            const weekStart = getWeekStart(dayDate);
            const isOffsite = typeof inv.id === 'string' && (inv.id.startsWith('TKW') || inv.id.startsWith('GFT'));
            if (!byWeek.has(weekKey)) byWeek.set(weekKey, { weekStart, products: new Map() });
            const weekBucket = byWeek.get(weekKey)!;
            for (const item of (inv.items || [])) {
                let p = weekBucket.products.get(item.productId);
                if (!p) {
                    p = {
                        productName: item.productName,
                        category: productCategoryLookup.get(item.productId) || '',
                        totalInRoom: 0, totalTakeawayGift: 0, totalRevenue: 0,
                        days: new Map(),
                    };
                    weekBucket.products.set(item.productId, p);
                }
                let d = p.days.get(dayKey);
                if (!d) { d = { dayKey, dayDate, inRoom: 0, takeawayGift: 0, revenue: 0 }; p.days.set(dayKey, d); }
                const qty = item.quantity;
                const rev = Number(item.price || 0) * Number(qty || 0);
                if (isOffsite) { p.totalTakeawayGift += qty; d.takeawayGift += qty; }
                else { p.totalInRoom += qty; d.inRoom += qty; }
                p.totalRevenue += rev; d.revenue += rev;
            }
        }
        const rows: Array<{
            weekKey: string; weekStart: Date; weekLabel: string;
            productId: string; productName: string; category: string;
            totalInRoom: number; totalTakeawayGift: number; grandTotal: number; totalRevenue: number;
            daily: DailyEntry[];
        }> = [];
        for (const [weekKey, { weekStart, products }] of byWeek.entries()) {
            for (const [productId, p] of products.entries()) {
                const grandTotal = p.totalInRoom + p.totalTakeawayGift;
                if (grandTotal === 0) continue;
                const daily = [...p.days.values()].sort((a, b) => +a.dayDate - +b.dayDate);
                rows.push({
                    weekKey, weekStart, weekLabel: formatWeekLabel(weekStart),
                    productId, productName: p.productName, category: p.category,
                    totalInRoom: p.totalInRoom, totalTakeawayGift: p.totalTakeawayGift,
                    grandTotal, totalRevenue: p.totalRevenue, daily,
                });
            }
        }
        rows.sort((a, b) => (+b.weekStart - +a.weekStart) || (b.grandTotal - a.grandTotal));
        return rows;
    }, [invoices, productCategoryLookup]);

    const filteredWeeklySales = useMemo(
        () => weeklySalesRows.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase())),
        [weeklySalesRows, searchTerm]
    );

    /* ── Pagination ─── */
    const paginatedStats = useMemo(() => {
        const start = (statsPage - 1) * pageSize;
        return filteredStats.slice(start, start + pageSize);
    }, [filteredStats, statsPage, pageSize]);

    const statsTotalPages = Math.max(1, Math.ceil(filteredStats.length / pageSize));

    const logsTotalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

    /* ── Excel export ─── */
    const exportToExcel = async () => {
        const isHistory = activeTab === 'history';
        if ((isHistory ? filteredLogs.length : filteredStats.length) === 0) {
            toast.error('Không có dữ liệu để xuất');
            return;
        }
        try {
            const ExcelJS = (await import('exceljs')).default;
            const wb = new ExcelJS.Workbook();
            wb.creator = 'Quản Lý Bán Hàng';
            const C = {
                header: 'FF1E293B', title: 'FF059669', stripe: 'FFF1F5F9', border: 'FFE2E8F0',
                green: 'FF059669', orange: 'FFEA580C', blue: 'FF2563EB', rose: 'FFE11D48',
            };
            const thin = { style: 'thin' as const, color: { argb: C.border } };
            const allBorders = { top: thin, left: thin, bottom: thin, right: thin };
            const buildSheet = (
                name: string, title: string,
                columns: { header: string; width: number; align?: 'left' | 'center' | 'right' }[],
                dataRows: { value: any; color?: string; numFmt?: string }[][]
            ) => {
                const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }] });
                const nCols = columns.length;
                ws.mergeCells(1, 1, 1, nCols);
                const titleCell = ws.getCell(1, 1);
                titleCell.value = title;
                titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
                titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.title } };
                titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                ws.getRow(1).height = 26;
                ws.mergeCells(2, 1, 2, nCols);
                const subCell = ws.getCell(2, 1);
                subCell.value = `Xuất lúc: ${new Date().toLocaleString('vi-VN')}`;
                subCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
                subCell.alignment = { horizontal: 'left', indent: 1 };
                const headerRow = ws.getRow(3);
                columns.forEach((col, i) => {
                    const cell = headerRow.getCell(i + 1);
                    cell.value = col.header;
                    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.header } };
                    cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'center', wrapText: true };
                    cell.border = allBorders;
                    ws.getColumn(i + 1).width = col.width;
                });
                headerRow.height = 30;
                dataRows.forEach((row, rIdx) => {
                    const r = ws.getRow(4 + rIdx);
                    row.forEach((cellData, cIdx) => {
                        const cell = r.getCell(cIdx + 1);
                        cell.value = cellData.value;
                        cell.border = allBorders;
                        cell.alignment = { vertical: 'middle', horizontal: columns[cIdx].align ?? 'center' };
                        if (cellData.numFmt) cell.numFmt = cellData.numFmt;
                        cell.font = { size: 11, color: { argb: cellData.color ?? 'FF1E293B' }, bold: !!cellData.color };
                        if (rIdx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.stripe } };
                    });
                });
            };
            if (isHistory) {
                buildSheet('Lịch sử nhập kho', 'LỊCH SỬ NHẬP / XUẤT KHO',
                    [
                        { header: 'Thời gian', width: 22, align: 'left' },
                        { header: 'Sản phẩm', width: 28, align: 'left' },
                        { header: 'Biến động', width: 14 },
                        { header: 'Ghi chú', width: 36, align: 'left' },
                        { header: 'Trạng thái', width: 16 },
                    ],
                    filteredLogs.map(l => [
                        { value: new Date(l.createdAt).toLocaleString('vi-VN') },
                        { value: l.productName },
                        { value: l.quantity, color: l.quantity >= 0 ? C.green : C.rose },
                        { value: l.note ?? '—' },
                        { value: l.quantity >= 0 ? 'Nhập thêm' : 'Xuất / Hư', color: l.quantity >= 0 ? C.green : C.rose },
                    ])
                );
            } else {
                buildSheet('Tồn kho & bán hàng', 'TỔNG QUAN TỒN KHO & BÁN HÀNG',
                    [
                        { header: 'Sản phẩm', width: 28, align: 'left' },
                        { header: 'Loại', width: 14 },
                        { header: 'SL tổng (tạo + nhập)', width: 18 },
                        { header: 'Bán trong phòng', width: 16 },
                        { header: 'Xuất khác (tặng/mang về/hư)', width: 20 },
                        { header: 'Doanh thu', width: 18, align: 'right' },
                        { header: 'Còn lại', width: 12 },
                    ],
                    filteredStats.map(s => [
                        { value: s.productName },
                        { value: CAT_LABELS[s.category] ?? s.category },
                        { value: s.totalCreated, color: C.blue },
                        { value: s.inRoom, color: C.green },
                        { value: s.otherOutput, color: C.orange },
                        { value: s.computedRevenue, numFmt: '#,##0"đ"' },
                        { value: s.remaining },
                    ])
                );
            }
            const monthly = monthlyStock.length > 0 ? monthlyStock : await computeMonthlyStock();
            if (monthly.length > 0) {
                const monthRows: { value: any; color?: string }[][] = [];
                for (const g of monthly) {
                    for (const r of g.rows) {
                        monthRows.push([
                            { value: g.label, color: C.blue },
                            { value: r.productName },
                            { value: r.opening },
                            { value: r.restock, color: C.green },
                            { value: r.opening + r.restock, color: C.blue },
                            { value: r.sold },
                            { value: r.exported, color: C.orange },
                            { value: r.closing, color: C.green },
                        ]);
                    }
                }
                buildSheet('Sổ kho theo tháng', 'SỔ KHO THEO THÁNG (tồn đầu = dư tháng trước + nhập)',
                    [
                        { header: 'Tháng', width: 14, align: 'left' },
                        { header: 'Sản phẩm', width: 26, align: 'left' },
                        { header: 'Tồn đầu', width: 12 },
                        { header: '+ Nhập', width: 12 },
                        { header: '= Tổng có', width: 12 },
                        { header: '− Bán', width: 12 },
                        { header: '− Xuất khác', width: 14 },
                        { header: 'Tồn cuối', width: 12 },
                    ],
                    monthRows
                );
            }
            if (weeklySalesRows.length > 0) {
                buildSheet('Sản lượng bán theo tuần', 'SẢN LƯỢNG BÁN THEO TUẦN (hóa đơn đã thanh toán)',
                    [
                        { header: 'Tuần', width: 24, align: 'left' },
                        { header: 'Sản phẩm', width: 26, align: 'left' },
                        { header: 'Loại', width: 14 },
                        { header: 'Bán trong phòng', width: 16 },
                        { header: 'Mang về / Tặng', width: 16 },
                        { header: 'Tổng', width: 12 },
                        { header: 'Doanh thu', width: 18, align: 'right' },
                    ],
                    weeklySalesRows.map(r => [
                        { value: r.weekLabel },
                        { value: r.productName },
                        { value: CAT_LABELS[r.category] ?? r.category },
                        { value: r.totalInRoom, color: C.green },
                        { value: r.totalTakeawayGift, color: C.orange },
                        { value: r.grandTotal, color: C.blue },
                        { value: r.totalRevenue, numFmt: '#,##0"đ"' },
                    ])
                );
            }
            const buf = await wb.xlsx.writeBuffer();
            const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bao-cao-kho-${activeTab}-${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Xuất file Excel thành công!');
        } catch (err) {
            console.error('Export Excel error:', err);
            toast.error('Lỗi khi xuất file Excel');
        }
    };

    /* ── CSV export ─── */
    const exportToCSV = () => {
        const isHistory = activeTab === 'history';
        const source = isHistory ? logs : stats;
        if (source.length === 0) { toast.error('Không có dữ liệu để xuất'); return; }
        const headers = isHistory
            ? ['Ngày nhập', 'Sản phẩm', 'Biến động', 'Ghi chú', 'Trạng thái']
            : ['Sản phẩm', 'Loại', 'Số lượng tổng (tạo + nhập)', 'Bán trong phòng', 'Xuất khác', 'Doanh thu', 'Số lượng còn lại'];
        const rows = isHistory
            ? logs.map(l => [new Date(l.createdAt).toLocaleString('vi-VN'), l.productName, l.quantity > 0 ? `+${l.quantity}` : String(l.quantity), l.note ?? '', l.quantity >= 0 ? 'Nhập thêm' : 'Xuất/Hư hỏng'])
            : augmentedStats.map(s => [s.productName, CAT_LABELS[s.category] ?? s.category, s.totalCreated, s.inRoom, s.otherOutput, s.computedRevenue, s.remaining]);
        const csv = '\ufeff' + [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bao-cao-kho-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Xuất file thành công!');
    };

    /* ── Pagination renderer ─── */
    const renderPagination = (page: number, totalPages: number, setPage: (p: number) => void, total: number) => {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
            }
        }
        return (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Hiển thị</span>
                    <span className="font-semibold text-gray-700">{pageSize}</span>
                    <span>kết quả mỗi trang</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                    >
                        ‹
                    </button>
                    {pages.map((p, i) =>
                        p === '...' ? (
                            <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">…</span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => setPage(p as number)}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors
                                    ${page === p ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                {p}
                            </button>
                        )
                    )}
                    <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                    >
                        ›
                    </button>
                </div>
            </div>
        );
    };

    /* ─────────────────────────────────────────────────────────── */
    /*  RENDER                                                     */
    /* ─────────────────────────────────────────────────────────── */

    return (
        <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>

            {/* ── Header ── */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-4">
                        {/* Back Button */}
                        <Link href="/dashboard/admin">
                            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-emerald-600 gap-1.5">
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Quay lại</span>
                            </Button>
                        </Link>
                        <div className="w-px h-6 bg-gray-200" />
                        {/* Tabs */}
                        <div className="flex items-center gap-0">
                            <button
                                onClick={() => { setActiveTab('sales'); setSearchTerm(''); setLogDirection('all'); }}
                                className={`px-5 h-14 text-[13px] font-semibold border-b-2 transition-all ${activeTab === 'sales'
                                    ? 'border-emerald-500 text-emerald-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Tổng quan tồn kho &amp; bán hàng
                            </button>
                            <button
                                onClick={() => { setActiveTab('history'); setSearchTerm(''); setLogDirection('all'); }}
                                className={`px-5 h-14 text-[13px] font-semibold border-b-2 transition-all ${activeTab === 'history'
                                    ? 'border-emerald-500 text-emerald-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Lịch sử nhập hàng
                            </button>
                        </div>
                    </div>

                    {/* Right controls */}
                    <div className="flex items-center gap-3">
                        {/* Date range picker */}
                        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 h-9 bg-white text-xs text-gray-600">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setStatsPage(1); setLogsPage(1); }}
                                className="border-none outline-none bg-transparent text-xs w-28"
                            />
                            <span className="text-gray-300">–</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setStatsPage(1); setLogsPage(1); }}
                                className="border-none outline-none bg-transparent text-xs w-28"
                            />
                        </div>

                        {/* Period tabs */}
                        <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                            <span>Chu kỳ:</span>
                            {PERIOD_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setReportType(opt.id)}
                                    className={`px-3 h-8 rounded-lg transition-colors ${reportType === opt.id
                                        ? 'bg-gray-100 text-gray-900 font-bold'
                                        : 'hover:bg-gray-50 text-gray-500'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Stores (nếu nhiều hơn 1) */}
                        {stores.length > 1 && (
                            <select
                                value={selectedStoreId}
                                onChange={e => setSelectedStoreId(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 h-9 text-xs text-gray-700 bg-white outline-none"
                            >
                                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        )}

                        <Button
                            onClick={exportToExcel}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg h-9 px-4 gap-2"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Xuất Excel
                        </Button>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════ */}
            {/* TAB: TỔNG QUAN TỒN KHO & BÁN HÀNG                 */}
            {/* ═══════════════════════════════════════════════════ */}
            {activeTab === 'sales' && (
                <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">

                    {/* KPI row */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* Bán chạy nhất */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Bán chạy nhất</p>
                                <p className="text-[15px] font-extrabold text-gray-900 truncate">{bestSellers[0]?.productName || '---'}</p>
                                <p className="text-xs text-blue-500 font-semibold">Số lượng: {bestSellers[0]?.salesMetric?.toLocaleString('vi-VN') ?? 0}</p>
                            </div>
                        </div>

                        {/* Bán chậm nhất */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                                <TrendingDown className="w-5 h-5 text-red-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Bán chậm nhất</p>
                                <p className="text-[15px] font-extrabold text-gray-900 truncate">{slowMoving[0]?.productName || '---'}</p>
                                <p className="text-xs text-red-400 font-semibold">Số lượng: {slowMoving[0]?.salesMetric?.toLocaleString('vi-VN') ?? 0}</p>
                            </div>
                        </div>

                        {/* Cảnh báo kho */}
                        <div
                            className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 cursor-pointer hover:border-amber-300 transition-colors"
                            onClick={() => setIsWarningModalOpen(true)}
                        >
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Cảnh báo kho</p>
                                <p className="text-[15px] font-extrabold text-gray-900">{lowStockProducts.length} mặt hàng</p>
                                <p className="text-xs text-amber-500 font-semibold">Tồn kho dưới 5 đơn vị</p>
                            </div>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg h-8 px-3 gap-1.5 ml-auto flex-shrink-0">
                                <Download className="w-3 h-3" />
                                Xuất Excel
                            </Button>
                        </div>
                    </div>

                    {/* Charts row */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* Top 5 bar chart */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <h2 className="text-[13px] font-bold text-gray-800 flex items-center gap-2 mb-4">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                Top 5 sản phẩm bán chạy
                            </h2>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={bestSellers} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="productName"
                                            type="category"
                                            axisLine={false}
                                            tickLine={false}
                                            width={90}
                                            tick={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
                                            tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v}
                                        />
                                        <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f9fafb' }} />
                                        <Bar dataKey="salesMetric" fill="#10b981" radius={[0, 4, 4, 0]} barSize={18}
                                            label={{ position: 'right', fontSize: 11, fontWeight: 700, fill: '#374151', formatter: (v: number) => v.toLocaleString('vi-VN') }}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Donut chart */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <h2 className="text-[13px] font-bold text-gray-800 flex items-center gap-2 mb-4">
                                <Package className="w-4 h-4 text-blue-500" />
                                Tiêu thụ theo danh mục
                            </h2>
                            <div className="h-[200px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={categoryData} innerRadius={55} outerRadius={78} paddingAngle={3} dataKey="value">
                                            {categoryData.map((_, i) => (
                                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomPieTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center label */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[11px] text-gray-400 font-medium">Tổng</span>
                                    <span className="text-lg font-extrabold text-gray-900">
                                        {categoryData.reduce((a, b) => a + b.value, 0).toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-[10px] text-gray-400">sản phẩm</span>
                                </div>
                            </div>
                            {/* Legend */}
                            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                                {categoryData.map((d, i) => {
                                    const total = categoryData.reduce((a, b) => a + b.value, 0);
                                    const pct = total ? ((d.value / total) * 100).toFixed(1) : '0.0';
                                    return (
                                        <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                            <span className="text-gray-600 truncate">{d.name}</span>
                                            <span className="ml-auto font-bold text-gray-700">{d.value.toLocaleString('vi-VN')} ({pct}%)</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Line chart sản lượng theo tuần */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-[13px] font-bold text-gray-800 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    Sản lượng bán theo tuần
                                </h2>
                                <select className="text-[11px] text-gray-500 border border-gray-200 rounded-lg px-2 h-7 outline-none">
                                    <option>Tuần trong tháng</option>
                                </select>
                            </div>
                            {(() => {
                                // Tổng theo tuần
                                const byWeekTotal = new Map<string, { label: string; total: number; start: Date }>();
                                for (const row of weeklySalesRows) {
                                    const cur = byWeekTotal.get(row.weekKey);
                                    if (!cur) byWeekTotal.set(row.weekKey, { label: `Tuần ${row.weekLabel.slice(0, 5)}`, total: row.grandTotal, start: row.weekStart });
                                    else cur.total += row.grandTotal;
                                }
                                const lineData = [...byWeekTotal.values()]
                                    .sort((a, b) => +a.start - +b.start)
                                    .map((v, i) => ({ name: `Tuần ${i + 1}`, total: v.total }))
                                    .slice(-6);
                                return (
                                    <div className="h-[200px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomLineTooltip />} />
                                                <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Detail sales table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                            <h2 className="text-[13px] font-bold text-gray-800">Chi tiết sản lượng bán hàng</h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <Input
                                    placeholder="Tìm sản phẩm..."
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setStatsPage(1); }}
                                    className="pl-9 h-9 text-xs bg-gray-50 border-gray-200 rounded-lg w-52"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        {[
                                            { label: 'SẢN PHẨM', align: 'text-left' },
                                            { label: 'LOẠI', align: 'text-left' },
                                            { label: 'SỐ LƯỢNG TỔNG (TẠO + NHẬP)', align: 'text-center' },
                                            { label: 'BÁN TRONG PHÒNG', align: 'text-center' },
                                            { label: 'XUẤT KHÁC (TẶNG + MANG VỀ + HƯ HỎNG)', align: 'text-center' },
                                            { label: 'DOANH THU', align: 'text-right' },
                                            { label: 'SỐ LƯỢNG CÒN LẠI', align: 'text-center' },
                                        ].map(h => (
                                            <th key={h.label} className={`px-4 py-3 text-[10px] font-bold text-gray-400 tracking-wider ${h.align}`}>
                                                {h.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {isLoading ? (
                                        <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm italic">Đang tải dữ liệu...</td></tr>
                                    ) : paginatedStats.length === 0 ? (
                                        <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm italic">Không có dữ liệu thống kê cho giai đoạn này</td></tr>
                                    ) : paginatedStats.map(item => (
                                        <tr key={item.productId} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-4 py-3 text-[13px] font-bold text-gray-900">{item.productName}</td>
                                            <td className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase">{CAT_LABELS[item.category] ?? item.category}</td>
                                            <td className="px-4 py-3 text-[13px] text-center font-bold text-blue-600">{item.totalCreated.toLocaleString('vi-VN')}</td>
                                            <td className="px-4 py-3 text-[13px] text-center font-bold text-emerald-600">{item.inRoom.toLocaleString('vi-VN')}</td>
                                            <td className="px-4 py-3 text-[13px] text-center font-bold text-orange-500">{item.otherOutput.toLocaleString('vi-VN')}</td>
                                            <td className="px-4 py-3 text-[13px] text-right font-semibold text-gray-700 whitespace-nowrap">{item.computedRevenue.toLocaleString('vi-VN')}đ</td>
                                            <td className="px-4 py-3 text-center"><StockBadge stock={item.remaining} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {renderPagination(statsPage, statsTotalPages, setStatsPage, filteredStats.length)}
                    </div>

                    {/* ── Sổ kho theo tháng ── */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <h2 className="text-[13px] font-bold text-gray-800 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    Sổ kho theo tháng
                                </h2>
                                <p className="text-[11px] text-gray-400 mt-0.5">Tồn đầu = tồn cuối tháng trước + nhập trong tháng</p>
                            </div>
                            <Button
                                onClick={loadMonthlyStock}
                                disabled={loadingMonthly}
                                className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-2"
                            >
                                {loadingMonthly ? (
                                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang tính...</>
                                ) : monthlyStock.length ? (
                                    <><RefreshCw className="w-3.5 h-3.5" /> Làm mới</>
                                ) : 'Xem tồn kho theo tháng'}
                            </Button>
                        </div>
                        <div className="p-5 space-y-4">
                            {monthlyStock.length === 0 ? (
                                <p className="text-center text-gray-400 text-sm italic py-6">
                                    Bấm "Xem tồn kho theo tháng" để tính tồn kho từng tháng trong khoảng thời gian đang chọn.
                                </p>
                            ) : monthlyStock.map(group => {
                                const rows = group.rows.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase()));
                                if (rows.length === 0) return null;
                                return (
                                    <div key={group.key} className="border border-gray-100 rounded-xl overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2.5 text-[12px] font-bold text-gray-700 flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                            {group.label}
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-white border-b border-gray-100">
                                                    <tr>
                                                        {[
                                                            { label: 'SẢN PHẨM', align: 'text-left' },
                                                            { label: 'TỒN ĐẦU (DƯ THÁNG TRƯỚC)', align: 'text-center' },
                                                            { label: '+ NHẬP TRONG THÁNG', align: 'text-center' },
                                                            { label: '= TỔNG CÓ', align: 'text-center' },
                                                            { label: '− BÁN', align: 'text-center' },
                                                            { label: '− XUẤT KHÁC', align: 'text-center' },
                                                            { label: 'TỒN CUỐI', align: 'text-center' },
                                                        ].map(h => (
                                                            <th key={h.label} className={`px-4 py-2.5 text-[10px] font-bold text-gray-400 ${h.align}`}>{h.label}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {rows.map(r => (
                                                        <tr key={r.productId} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-4 py-2.5 text-[13px] font-bold text-gray-900">{r.productName}</td>
                                                            <td className="px-4 py-2.5 text-[13px] text-center text-gray-500">{r.opening}</td>
                                                            <td className="px-4 py-2.5 text-[13px] text-center font-bold text-emerald-600">+{r.restock}</td>
                                                            <td className="px-4 py-2.5 text-[13px] text-center font-bold text-blue-600">{r.opening + r.restock}</td>
                                                            <td className="px-4 py-2.5 text-[13px] text-center text-gray-600">{r.sold}</td>
                                                            <td className="px-4 py-2.5 text-[13px] text-center text-orange-500">{r.exported}</td>
                                                            <td className="px-4 py-2.5 text-center"><StockBadge stock={r.closing} /></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Sản lượng bán theo ngày trong tháng (ma trận) ── */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-[13px] font-bold text-gray-800 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    Sản lượng bán theo ngày trong tháng
                                </h2>
                                <p className="text-[11px] text-gray-400 mt-0.5">Tổng sản lượng bán hàng ngày</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            {dailySalesMatrix.rows.length === 0 ? (
                                <p className="text-center text-gray-400 text-sm italic py-8">Chưa có hóa đơn đã thanh toán</p>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[120px]">SẢN PHẨM</th>
                                            {dailySalesMatrix.dayLabels.map(d => (
                                                <th key={d.key} className="px-2 py-3 text-center font-bold text-gray-400 min-w-[40px] whitespace-nowrap">
                                                    {d.label.split('/')[0]}
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-center font-bold text-gray-700 min-w-[60px]">TỔNG</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {dailySalesMatrix.rows.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase())).map(row => (
                                            <tr key={row.productId} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-2.5 font-bold text-gray-900 sticky left-0 bg-white z-10">{row.productName}</td>
                                                {dailySalesMatrix.dayLabels.map(d => {
                                                    const qty = row.days.get(d.key) || 0;
                                                    return (
                                                        <td key={d.key} className={`px-2 py-2.5 text-center font-semibold ${qty > 0 ? 'text-gray-700' : 'text-gray-200'}`}>
                                                            {qty > 0 ? qty : '—'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-2.5 text-center font-extrabold text-gray-900">{row.total}</td>
                                            </tr>
                                        ))}
                                        {/* TỔNG row */}
                                        <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                                            <td className="px-4 py-3 text-gray-700 font-extrabold sticky left-0 bg-gray-50 z-10">TỔNG</td>
                                            {dailySalesMatrix.dayLabels.map(d => {
                                                const qty = dailySalesMatrix.grandTotalByDay.get(d.key) || 0;
                                                return (
                                                    <td key={d.key} className={`px-2 py-3 text-center font-bold ${qty > 0 ? 'text-emerald-600' : 'text-gray-200'}`}>
                                                        {qty > 0 ? qty : '—'}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-3 text-center font-extrabold text-emerald-600">
                                                {dailySalesMatrix.rows.reduce((a, r) => a + r.total, 0).toLocaleString('vi-VN')}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </main>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* TAB: LỊCH SỬ NHẬP HÀNG                            */}
            {/* ═══════════════════════════════════════════════════ */}
            {activeTab === 'history' && (
                <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">

                    {/* Date filters (dưới header) */}
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Từ ngày</label>
                            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 h-9 bg-white text-xs text-gray-600 w-40">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setLogsPage(1); }} className="border-none outline-none bg-transparent text-xs flex-1" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Đến ngày</label>
                            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 h-9 bg-white text-xs text-gray-600 w-40">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setLogsPage(1); }} className="border-none outline-none bg-transparent text-xs flex-1" />
                            </div>
                        </div>
                    </div>

                    {/* History KPI cards */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <ArrowDown className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Tổng lượt nhập</p>
                                <p className="text-[22px] font-extrabold text-gray-900">{historyKpis.totalLogs}</p>
                                <p className="text-[11px] text-blue-500 font-semibold">biến động</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                <Package className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Tổng số lượng nhập</p>
                                <p className="text-[22px] font-extrabold text-gray-900">
                                    {historyKpis.totalIn > 0 ? '+' : ''}{historyKpis.totalIn.toLocaleString('vi-VN')}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                                <TrendingUp className="w-5 h-5 text-orange-500" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sản phẩm nhập nhiều nhất</p>
                                <p className="text-[15px] font-extrabold text-gray-900 truncate">{historyKpis.mostIn?.productName || '---'}</p>
                                <p className="text-[11px] text-orange-500 font-semibold">+{(historyKpis.mostIn?.totalRestocked || 0).toLocaleString('vi-VN')}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <TrendingDown className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sản phẩm nhập ít nhất</p>
                                <p className="text-[15px] font-extrabold text-gray-900 truncate">{historyKpis.leastIn?.productName || '---'}</p>
                                <p className="text-[11px] text-blue-400 font-semibold">+{(historyKpis.leastIn?.totalRestocked || 0).toLocaleString('vi-VN')}</p>
                            </div>
                        </div>
                    </div>

                    {/* History charts */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Bar chart nhập kho theo tháng */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <h2 className="text-[13px] font-bold text-gray-800 mb-4">Nhập kho theo tháng</h2>
                            <div className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={historyMonthlyChart} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomHistoryBarTooltip />} cursor={{ fill: '#f9fafb' }} />
                                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28}
                                            label={{ position: 'top', fontSize: 10, fontWeight: 700, fill: '#374151', formatter: (v: number) => v > 0 ? v.toLocaleString('vi-VN') : '' }}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Donut cơ cấu nhập theo danh mục */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <h2 className="text-[13px] font-bold text-gray-800 mb-4">Cơ cấu nhập theo danh mục</h2>
                            <div className="flex gap-4">
                                <div className="w-[180px] h-[180px] relative flex-shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={categoryData} innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                                                {categoryData.map((_, i) => (
                                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomPieTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-[10px] text-gray-400">Tổng</span>
                                        <span className="text-[18px] font-extrabold text-gray-900">
                                            {categoryData.reduce((a, b) => a + b.value, 0).toLocaleString('vi-VN')}
                                        </span>
                                        <span className="text-[10px] text-gray-400">sản phẩm</span>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col justify-center gap-2.5">
                                    {categoryData.map((d, i) => {
                                        const total = categoryData.reduce((a, b) => a + b.value, 0);
                                        const pct = total ? ((d.value / total) * 100).toFixed(1) : '0.0';
                                        return (
                                            <div key={d.name} className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                    <span className="text-[12px] text-gray-600 font-medium">{d.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[12px] font-bold text-gray-900">{d.value.toLocaleString('vi-VN')}</span>
                                                    <span className="text-[11px] text-gray-400 ml-1">({pct}%)</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* History detail table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                            <h2 className="text-[13px] font-bold text-gray-800">Chi tiết lịch sử nhập kho</h2>
                            <div className="flex items-center gap-3">
                                {/* Page size selector */}
                                <select
                                    value={pageSize}
                                    onChange={e => { setPageSize(Number(e.target.value)); setLogsPage(1); setStatsPage(1); }}
                                    className="h-9 text-xs bg-gray-50 border-gray-200 rounded-lg px-2 outline-none"
                                >
                                    {[10, 30, 50, 9999].map(size => (
                                        <option key={size} value={size}>{size === 9999 ? 'Tất cả' : `${size} / trang`}</option>
                                    ))}
                                </select>
                                {/* Group by selector */}
                                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 h-9 bg-white text-xs text-gray-600">
                                    <span>Nhóm theo tháng</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                {/* Filter direction */}
                                <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 h-9 bg-white text-xs text-gray-600 cursor-pointer"
                                    onClick={() => setLogDirection(logDirection === 'all' ? 'in' : logDirection === 'in' ? 'out' : 'all')}>
                                    <Filter className="w-3.5 h-3.5 text-gray-400" />
                                    <span>{logDirection === 'all' ? 'Tất cả' : logDirection === 'in' ? 'Nhập' : 'Xuất'}</span>
                                </div>
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                    <Input
                                        placeholder="Tìm sản phẩm..."
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setLogsPage(1); }}
                                        className="pl-9 h-9 text-xs bg-gray-50 border-gray-200 rounded-lg w-52"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        {[
                                            { label: 'THỜI GIAN', align: 'text-left' },
                                            { label: 'SẢN PHẨM', align: 'text-left' },
                                            { label: 'BIẾN ĐỘNG', align: 'text-left' },
                                            { label: 'GHI CHÚ', align: 'text-left' },
                                            { label: 'TRẠNG THÁI', align: 'text-right' },
                                        ].map(h => (
                                            <th key={h.label} className={`px-5 py-3 text-[10px] font-bold text-gray-400 tracking-wider ${h.align}`}>{h.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {isLoading ? (
                                        <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm italic">Đang tải dữ liệu...</td></tr>
                                    ) : logsByMonth.length === 0 ? (
                                        <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm italic">Chưa có lịch sử nhập kho cho kỳ này</td></tr>
                                    ) : logsByMonth.map(group => (
                                        <Fragment key={group.key}>
                                            {/* Group header */}
                                            <tr className="bg-blue-50/40">
                                                <td colSpan={5} className="px-5 py-2.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[12px] font-bold text-blue-700 flex items-center gap-2">
                                                            <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                                            {group.label}
                                                            <span className="text-[11px] font-normal text-gray-400">({group.items.length} biến động)</span>
                                                        </span>
                                                        <span className="text-[11px] font-bold text-emerald-600">
                                                            Tổng nhập: +{group.totalIn.toLocaleString('vi-VN')}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Show only paginated subset within current page */}
                                            {group.items
                                                .map(log => (
                                                <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                                                    <td className="px-5 py-3 text-[12px] text-gray-500 whitespace-nowrap">
                                                        {new Date(log.createdAt).toLocaleString('vi-VN')}
                                                    </td>
                                                    <td className="px-5 py-3 text-[13px] font-bold text-gray-900">{log.productName}</td>
                                                    <td className={`px-5 py-3 text-[13px] font-bold ${log.quantity >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                                                    </td>
                                                    <td className="px-5 py-3 text-[12px] text-gray-400">{log.note ?? '—'}</td>
                                                    <td className="px-5 py-3 text-right">
                                                        <StatusPill quantity={log.quantity} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {renderPagination(logsPage, logsTotalPages, setLogsPage, filteredLogs.length)}
                    </div>
                </main>
            )}

            {/* ── Low-stock warning modal ── */}
            <Dialog open={isWarningModalOpen} onOpenChange={setIsWarningModalOpen}>
                <DialogContent className="max-w-md rounded-2xl p-6 border border-gray-200 shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600 font-bold text-base">
                            <AlertTriangle className="w-5 h-5" />
                            Sản phẩm sắp hết hàng
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 text-[13px]">
                            Các mặt hàng có tồn kho từ 5 đơn vị trở xuống.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[50vh] overflow-y-auto mt-3 divide-y divide-gray-100">
                        {lowStockProducts.length === 0 ? (
                            <p className="py-8 text-center text-gray-400 italic text-[13px]">Hiện không có sản phẩm nào sắp hết</p>
                        ) : lowStockProducts.map(p => (
                            <div key={p.productId} className="py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-[13px] font-bold text-gray-900">{p.productName}</p>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">{CAT_LABELS[p.category] ?? p.category}</p>
                                </div>
                                <span className="bg-red-50 text-red-500 px-3 py-1 rounded-xl font-bold text-[13px]">
                                    Còn: {p.currentStock}
                                </span>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}