'use client';

import { useState, useEffect, useMemo } from 'react';
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
    PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    TrendingUp, TrendingDown, ArrowLeft, Calendar, AlertTriangle,
    Search, Boxes, Download, History, Package
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
    totalDecrement: number; // Đổi tên từ totalQuantity
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
    const diff = day === 0 ? -6 : 1 - day; // Monday = start
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

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

const PERIOD_OPTIONS = [
    { id: 'monthly', label: 'Tháng' },
    { id: 'yearly', label: 'Năm' },
] as const;

type PeriodType = typeof PERIOD_OPTIONS[number]['id'];

/* ─── Sub-components ─────────────────────────────────────────── */

function KpiCard({
    icon,
    iconBg,
    label,
    value,
    sub,
    subColor,
    onClick,
}: {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value: string;
    sub: string;
    subColor: string;
    onClick?: () => void;
}) {
    return (
        <div
            onClick={onClick}
            className={`
                bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 border border-slate-200
                flex items-center gap-4 transition-all duration-200 group
                hover:shadow-lg hover:border-slate-300
                ${onClick ? 'cursor-pointer' : ''}
            `}
        >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} group-hover:scale-110 transition-transform duration-200`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <h3 className="text-lg font-extrabold text-slate-900 truncate">{value}</h3>
                <p className={`text-xs font-semibold mt-0.5 ${subColor}`}>{sub}</p>
            </div>
        </div>
    );
}

function StockBadge({ stock }: { stock: number }) {
    return (
        <span className={`
            inline-block px-3 py-1 rounded-full text-[11px] font-bold
            ${stock > 5 ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600'}
        `}>
            {stock}
        </span>
    );
}

function StatusPill({ quantity }: { quantity: number }) {
    return quantity >= 0 ? (
        <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wide">
            Nhập thêm
        </span>
    ) : (
        <span className="inline-block px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold uppercase tracking-wide">
            Xuất / Hư
        </span>
    );
}

/* ─── Custom Recharts Tooltip ─────────────────────────────────── */

const CustomBarTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-4 py-2 text-sm font-semibold text-slate-700">
            Đã bán: <span className="text-emerald-600">{payload[0].value}</span>
        </div>
    );
};

const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-4 py-2 text-sm font-semibold text-slate-700">
            {payload[0].name}: <span className="text-indigo-600">{payload[0].value}</span>
        </div>
    );
};

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
    const [expandedWeeklyKeys, setExpandedWeeklyKeys] = useState<Record<string, boolean>>({});

    /* ── Fetch stores on mount ─── */
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const res = await fetch('/api/admin/stores');
                let data = await res.json();

                // Chỉ hiển thị chi nhánh được gán cho Admin
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

    /* ── Fetch invoices (cho bảng sản lượng theo ngày) ─── */
    useEffect(() => {
        if (!selectedStoreId) return;
        fetch(`/api/invoices?storeId=${selectedStoreId}`, { cache: 'no-store' })
            .then(r => r.ok ? r.json() : [])
            .then(data => setInvoices(Array.isArray(data) ? data : []))
            .catch(() => setInvoices([]));
    }, [selectedStoreId]);

    /* ── Fetch lifetime stats (cho cột "Số lượng tổng" lifetime) ─── */
    useEffect(() => {
        if (!selectedStoreId) return;
        // startDate=1970-01-01 → API tính từ đầu → trả về lifetime tạo + nhập
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

    /* ── Derived data ─── */

    const productCategoryLookup = useMemo(() => {
        const m = new Map<string, string>();
        for (const s of stats) m.set(s.productId, s.category);
        return m;
    }, [stats]);

    /* ── Tính kỳ hiệu lực giống hệt API: ưu tiên date input, fallback theo reportType ─── */
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

    /* ── Bán theo sản phẩm trong KỲ (tách inRoom vs offsite từ invoices) ─── */
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

    /* ── Lookup tổng tạo + nhập LIFETIME (theo productId) ─── */
    const lifetimeTotalCreatedLookup = useMemo(() => {
        const m = new Map<string, number>();
        for (const s of lifetimeStats) {
            m.set(s.productId, s.openingStock + s.totalRestocked);
        }
        return m;
    }, [lifetimeStats]);

    /* ── Stats bổ sung các cột tính sẵn ─── */
    const augmentedStats = useMemo(() => {
        return stats.map(s => {
            const sales = salesByProduct.get(s.productId) || { inRoom: 0, offsite: 0, revenue: 0 };
            // Tổng tạo + nhập: lifetime (cộng dồn từ đầu, không phụ thuộc kỳ)
            // Fallback về period nếu lifetime chưa kịp load.
            const totalCreated = lifetimeTotalCreatedLookup.get(s.productId) ?? (s.openingStock + s.totalRestocked);
            const inRoom = sales.inRoom;
            // Xuất khác trong kỳ = tặng + mang về (offsite từ HĐ TKW/GFT) + hư hỏng (inventoryLog) trong kỳ
            const otherOutput = sales.offsite + s.totalExported;
            // Còn lại = Tổng (tạo + nhập) - bán trong phòng - xuất khác
            const remaining = totalCreated - inRoom - otherOutput;
            // "Bán chạy nhất" = bán trong phòng + mang về/tặng (KHÔNG cộng hư hỏng)
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

    // Ẩn (KHÔNG xóa) các log hoàn kho do hủy phòng — dữ liệu vẫn còn trong DB để kiểm tra sau.
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

    /* ── Sản lượng theo TUẦN × sản phẩm, mỗi dòng có daily breakdown ─── */
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
        // weekKey -> { weekStart, products: productId -> ProductBucket }
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
                        totalInRoom: 0,
                        totalTakeawayGift: 0,
                        totalRevenue: 0,
                        days: new Map(),
                    };
                    weekBucket.products.set(item.productId, p);
                }
                let d = p.days.get(dayKey);
                if (!d) {
                    d = { dayKey, dayDate, inRoom: 0, takeawayGift: 0, revenue: 0 };
                    p.days.set(dayKey, d);
                }
                const qty = item.quantity;
                const rev = Number(item.price || 0) * Number(qty || 0);
                if (isOffsite) {
                    p.totalTakeawayGift += qty;
                    d.takeawayGift += qty;
                } else {
                    p.totalInRoom += qty;
                    d.inRoom += qty;
                }
                p.totalRevenue += rev;
                d.revenue += rev;
            }
        }

        const rows: Array<{
            weekKey: string;
            weekStart: Date;
            weekLabel: string;
            productId: string;
            productName: string;
            category: string;
            totalInRoom: number;
            totalTakeawayGift: number;
            grandTotal: number;
            totalRevenue: number;
            daily: DailyEntry[];
        }> = [];
        for (const [weekKey, { weekStart, products }] of byWeek.entries()) {
            for (const [productId, p] of products.entries()) {
                const grandTotal = p.totalInRoom + p.totalTakeawayGift;
                if (grandTotal === 0) continue;
                const daily = [...p.days.values()].sort((a, b) => +a.dayDate - +b.dayDate);
                rows.push({
                    weekKey,
                    weekStart,
                    weekLabel: formatWeekLabel(weekStart),
                    productId,
                    productName: p.productName,
                    category: p.category,
                    totalInRoom: p.totalInRoom,
                    totalTakeawayGift: p.totalTakeawayGift,
                    grandTotal,
                    totalRevenue: p.totalRevenue,
                    daily,
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

    /* ── CSV export ─── */
    const exportToCSV = () => {
        const isHistory = activeTab === 'history';
        const source = isHistory ? logs : stats;
        if (source.length === 0) { toast.error('Không có dữ liệu để xuất'); return; }

        const headers = isHistory
            ? ['Ngày nhập', 'Sản phẩm', 'Biến động', 'Ghi chú', 'Trạng thái']
            : ['Sản phẩm', 'Loại', 'Số lượng tổng (tạo + nhập)', 'Bán trong phòng', 'Xuất khác (tặng + mang về + hư hỏng)', 'Doanh thu', 'Số lượng còn lại'];

        const rows = isHistory
            ? logs.map(l => [
                new Date(l.createdAt).toLocaleString('vi-VN'),
                l.productName,
                l.quantity > 0 ? `+${l.quantity}` : String(l.quantity),
                l.note ?? '',
                l.quantity >= 0 ? 'Nhập thêm' : 'Xuất/Hư hỏng',
            ])
            : augmentedStats.map(s => [
                s.productName,
                CAT_LABELS[s.category] ?? s.category,
                s.totalCreated,
                s.inRoom,
                s.otherOutput,
                s.computedRevenue,
                s.remaining,
            ]);

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

    /* ─────────────────────────────────────────────────────────── */
    /*  RENDER                                                     */
    /* ─────────────────────────────────────────────────────────── */

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>

            {/* ── Top bar ── */}
            <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 sticky top-0 z-40 h-14 flex items-center justify-between px-7 shadow-lg border-b border-slate-700">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/admin">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-white hover:bg-white/10 rounded-lg gap-2 text-xs font-semibold transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Quay lại
                        </Button>
                    </Link>
                    <h1 className="text-white text-[15px] font-bold tracking-tight flex items-center gap-2">
                        <Boxes className="w-5 h-5 text-emerald-400" />
                        Báo cáo <span className="text-emerald-400">Kho hàng</span>
                    </h1>
                </div>

                <Button
                    onClick={exportToCSV}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg h-9 px-4 gap-2 transition-all shadow-md hover:shadow-lg"
                >
                    <Download className="w-3.5 h-3.5" />
                    Xuất báo cáo
                </Button>
            </header>

            {/* ── Filter bar ── */}
            <div className="bg-white border-b border-slate-200 px-7 py-4 flex flex-wrap items-center gap-5 shadow-sm">
                {/* Stores */}
                {stores.length > 1 && (
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chi nhánh</span>
                        <div className="flex gap-2 flex-wrap">
                            {stores.map(store => (
                                <button
                                    key={store.id}
                                    onClick={() => setSelectedStoreId(store.id)}
                                    className={`
                                        px-4 py-1.5 rounded-lg text-[12px] font-semibold border transition-all
                                        ${selectedStoreId === store.id
                                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-emerald-700 shadow-md'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}
                                    `}
                                >
                                    {store.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Date range */}
                <div className="flex items-end gap-3">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Từ ngày</span>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-lg w-40"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đến ngày</span>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-lg w-40"
                            />
                        </div>
                    </div>
                </div>

                {/* Period tabs */}
                <div className="ml-auto flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chu kỳ</span>
                    <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                        {PERIOD_OPTIONS.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setReportType(opt.id)}
                                className={`
                                    px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all
                                    ${reportType === opt.id
                                        ? 'bg-white text-emerald-600 shadow-sm border border-emerald-200'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}
                                `}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Main content ── */}
            <main className="max-w-[1200px] mx-auto px-7 py-6 space-y-5">

                {/* Tab bar */}
                <div className="flex items-center gap-2">
                    {[
                        { id: 'sales', label: 'Tổng quan tồn kho & bán hàng', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                        { id: 'history', label: 'Lịch sử nhập hàng thêm', icon: <History className="w-3.5 h-3.5" /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); setLogDirection('all'); }}
                            className={`
                                flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold
                                border transition-all
                                ${activeTab === tab.id
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
                            `}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KpiCard
                        iconBg="bg-blue-50"
                        icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
                        label="Bán chạy nhất"
                        value={bestSellers[0]?.productName || '---'}
                        sub={`Số lượng: ${bestSellers[0]?.salesMetric ?? 0}`}
                        subColor="text-blue-500"
                    />
                    <KpiCard
                        iconBg="bg-rose-50"
                        icon={<TrendingDown className="w-5 h-5 text-rose-500" />}
                        label="Bán chậm nhất"
                        value={slowMoving[0]?.productName || '---'}
                        sub={`Số lượng: ${slowMoving[0]?.salesMetric ?? 0}`}
                        subColor="text-rose-500"
                    />
                    <KpiCard
                        iconBg="bg-amber-50"
                        icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
                        label="Cảnh báo kho"
                        value={`${lowStockProducts.length} mặt hàng`}
                        sub="Tồn kho dưới 5 đơn vị"
                        subColor="text-amber-500"
                        onClick={() => setIsWarningModalOpen(true)}
                    />
                </div>

                {/* Charts — only on sales tab */}
                {activeTab === 'sales' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Best sellers bar */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-2 mb-5">
                                <TrendingUp className="w-4 h-4 text-emerald-600" />
                                Top 5 sản phẩm bán chạy
                            </h2>
                            <div className="h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={bestSellers} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="productName"
                                            type="category"
                                            axisLine={false}
                                            tickLine={false}
                                            width={110}
                                            tick={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
                                            tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v}
                                        /> {/* Đã bỏ vertical={false} vì là mặc định cho biểu đồ dọc */}
                                        <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f9fafb' }} />
                                        <Bar dataKey="salesMetric" fill="#10b981" radius={[0, 6, 6, 0]} barSize={22} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Category donut */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-2 mb-5">
                                <Package className="w-4 h-4 text-indigo-500" />
                                Tiêu thụ theo danh mục
                            </h2>
                            <div className="h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categoryData}
                                            innerRadius={55}
                                            outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {categoryData.map((_, i) => (
                                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomPieTooltip />} />
                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            formatter={(value) => (
                                                <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{value}</span>
                                            )}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detail table */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* Table header */}
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                        <h2 className="text-[13px] font-bold text-slate-800">
                            {activeTab === 'sales' ? 'Chi tiết sản lượng bán hàng' : 'Chi tiết các đợt nhập kho'}
                        </h2>
                        <div className="flex items-center gap-2">
                            {activeTab !== 'sales' && (
                                <div className="flex items-center bg-slate-50 rounded-lg p-0.5">
                                    {([
                                        { id: 'all', label: 'Tất cả' },
                                        { id: 'in', label: 'Nhập' },
                                        { id: 'out', label: 'Xuất' },
                                    ] as const).map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setLogDirection(opt.id)}
                                            className={`px-3 h-8 text-xs font-bold rounded-md transition-colors
                                                ${logDirection === opt.id
                                                    ? opt.id === 'in'
                                                        ? 'bg-emerald-500 text-white'
                                                        : opt.id === 'out'
                                                            ? 'bg-rose-500 text-white'
                                                            : 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input
                                    placeholder="Tìm sản phẩm..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 h-9 text-xs bg-slate-50 border-none rounded-lg w-52"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table body */}
                    <div className="overflow-x-auto">
                        {activeTab === 'sales' ? (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        {([
                                            { label: 'Sản phẩm', align: 'text-left' },
                                            { label: 'Loại', align: 'text-left' },
                                            { label: 'Số lượng tổng (tạo + nhập)', align: 'text-center' },
                                            { label: 'Bán trong phòng', align: 'text-center' },
                                            { label: 'Xuất khác (tặng + mang về + hư hỏng)', align: 'text-center' },
                                            { label: 'Doanh thu', align: 'text-right' },
                                            { label: 'Số lượng còn lại', align: 'text-center' },
                                        ] as const).map(h => (
                                            <th
                                                key={h.label}
                                                className={`px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider ${h.align}`}
                                            >
                                                {h.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm italic">
                                                Đang tải dữ liệu...
                                            </td>
                                        </tr>
                                    ) : filteredStats.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm italic">
                                                Không có dữ liệu thống kê cho giai đoạn này
                                            </td>
                                        </tr>
                                    ) : filteredStats.map(item => (
                                        <tr key={item.productId} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3 text-[13px] font-bold text-slate-900">{item.productName}</td>
                                            <td className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                {CAT_LABELS[item.category] ?? item.category}
                                            </td>
                                            <td className="px-5 py-3 text-[13px] text-center font-bold text-blue-600">{item.totalCreated}</td>
                                            <td className="px-5 py-3 text-[13px] text-center font-bold text-emerald-600">{item.inRoom}</td>
                                            <td className="px-5 py-3 text-[13px] text-center font-bold text-orange-500">{item.otherOutput}</td>
                                            <td className="px-5 py-3 text-[13px] text-right font-semibold text-slate-700 whitespace-nowrap">
                                                {item.computedRevenue.toLocaleString('vi-VN')}đ
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <StockBadge stock={item.remaining} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        {['Thời gian nhập', 'Sản phẩm', 'Biến động', 'Ghi chú lý do', 'Trạng thái'].map((h, i) => (
                                            <th
                                                key={h}
                                                className={`px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider
                                                    ${i === 2 || i === 4 ? 'text-center' : 'text-left'}`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm italic">
                                                Đang tải dữ liệu...
                                            </td>
                                        </tr>
                                    ) : filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm italic">
                                                Chưa có lịch sử nhập kho cho kỳ này
                                            </td>
                                        </tr>
                                    ) : filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3 text-[12px] text-slate-500">
                                                {new Date(log.createdAt).toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-5 py-3 text-[13px] font-bold text-slate-900">{log.productName}</td>
                                            <td className={`px-5 py-3 text-[13px] text-center font-bold
                                                ${log.quantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                                            </td>
                                            <td className="px-5 py-3 text-[12px] text-slate-500 italic">{log.note ?? '—'}</td>
                                            <td className="px-5 py-3 text-center">
                                                <StatusPill quantity={log.quantity} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ── Sản lượng bán theo tuần — chỉ ở tab Bán hàng ── */}
                {activeTab === 'sales' && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                            <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-500" />
                                Sản lượng bán theo tuần
                                <span className="ml-1 text-[11px] font-normal text-slate-400">(hóa đơn đã thanh toán — bấm Xem chi tiết để xem từng ngày)</span>
                            </h2>
                            <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                                {filteredWeeklySales.length} dòng
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        {([
                                            { label: 'Tuần', align: 'text-left' },
                                            { label: 'Sản phẩm', align: 'text-left' },
                                            { label: 'Loại', align: 'text-left' },
                                            { label: 'Bán phòng', align: 'text-center' },
                                            { label: 'Mang về', align: 'text-center' },
                                            { label: 'Tổng', align: 'text-center' },
                                            { label: 'Doanh thu', align: 'text-right' },
                                            { label: '', align: 'text-right' },
                                        ] as const).map((h, i) => (
                                            <th
                                                key={`${h.label}-${i}`}
                                                className={`px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider ${h.align}`}
                                            >
                                                {h.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredWeeklySales.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-5 py-10 text-center text-slate-400 text-sm italic">
                                                Chưa có hóa đơn đã thanh toán
                                            </td>
                                        </tr>
                                    ) : filteredWeeklySales.flatMap(row => {
                                        const expandKey = `${row.weekKey}-${row.productId}`;
                                        const expanded = !!expandedWeeklyKeys[expandKey];
                                        const out: React.ReactElement[] = [];
                                        out.push(
                                            <tr key={`main-${expandKey}`} className={`transition-colors ${expanded ? 'bg-blue-50/60' : 'hover:bg-slate-50/60'}`}>
                                                <td className="px-5 py-3 text-[12px] font-semibold text-slate-700 whitespace-nowrap">
                                                    {row.weekLabel}
                                                </td>
                                                <td className="px-5 py-3 text-[13px] font-bold text-slate-900">{row.productName}</td>
                                                <td className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    {CAT_LABELS[row.category] ?? row.category}
                                                </td>
                                                <td className="px-5 py-3 text-[13px] text-center font-bold text-emerald-600">{row.totalInRoom}</td>
                                                <td className="px-5 py-3 text-[13px] text-center font-bold text-orange-500">{row.totalTakeawayGift}</td>
                                                <td className="px-5 py-3 text-[13px] text-center font-extrabold text-slate-900">{row.grandTotal}</td>
                                                <td className="px-5 py-3 text-[13px] text-right font-semibold text-slate-700 whitespace-nowrap">
                                                    {row.totalRevenue.toLocaleString('vi-VN')}đ
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <button
                                                        onClick={() => setExpandedWeeklyKeys(prev => ({ ...prev, [expandKey]: !prev[expandKey] }))}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${expanded
                                                            ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                                                            : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100'
                                                            }`}
                                                    >
                                                        {expanded ? 'Thu gọn' : 'Xem chi tiết'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                        if (expanded) {
                                            row.daily.forEach(d => {
                                                out.push(
                                                    <tr key={`day-${expandKey}-${d.dayKey}`} className="bg-slate-50/40">
                                                        <td className="px-5 py-2 pl-12 text-[11px] text-slate-500 whitespace-nowrap">
                                                            ↳ {formatDayWithWeekday(d.dayDate)}
                                                        </td>
                                                        <td className="px-5 py-2 text-[11px] text-slate-400" colSpan={2}></td>
                                                        <td className="px-5 py-2 text-[12px] text-center font-semibold text-emerald-600">{d.inRoom}</td>
                                                        <td className="px-5 py-2 text-[12px] text-center font-semibold text-orange-500">{d.takeawayGift}</td>
                                                        <td className="px-5 py-2 text-[12px] text-center font-bold text-slate-700">{d.inRoom + d.takeawayGift}</td>
                                                        <td className="px-5 py-2 text-[12px] text-right text-slate-600 whitespace-nowrap">
                                                            {d.revenue.toLocaleString('vi-VN')}đ
                                                        </td>
                                                        <td></td>
                                                    </tr>
                                                );
                                            });
                                        }
                                        return out;
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* ── Low-stock warning modal ── */}
            <Dialog open={isWarningModalOpen} onOpenChange={setIsWarningModalOpen}>
                <DialogContent className="max-w-md rounded-3xl p-7 border border-slate-200 shadow-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600 font-extrabold text-base">
                            <AlertTriangle className="w-5 h-5" />
                            Sản phẩm sắp hết hàng
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 text-[13px] font-medium">
                            Các mặt hàng có tồn kho từ 5 đơn vị trở xuống.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[50vh] overflow-y-auto -mr-1 pr-1 mt-2 divide-y divide-slate-100">
                        {lowStockProducts.length === 0 ? (
                            <p className="py-10 text-center text-slate-400 italic text-[13px]">
                                Hiện không có sản phẩm nào sắp hết
                            </p>
                        ) : lowStockProducts.map(p => (
                            <div key={p.productId} className="py-3.5 flex items-center justify-between group hover:bg-slate-50 px-1 rounded transition-colors">
                                <div>
                                    <p className="text-[13px] font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                                        {p.productName}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                        {CAT_LABELS[p.category] ?? p.category}
                                    </p>
                                </div>
                                <span className="bg-rose-50 text-rose-600 px-3.5 py-1.5 rounded-xl font-bold text-[13px] ring-1 ring-rose-100">
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