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
    Search, Boxes, Download, History, Package, X
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ─────────────────────────────────────────────────── */

interface ProductStat {
    productId: string;
    productName: string;
    category: string;
    openingStock: number;
    totalRestocked: number;
    totalQuantity: number;
    totalRevenue: number;
    currentStock: number;
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

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

const PERIOD_OPTIONS = [
    { id: 'daily', label: 'Ngày' },
    { id: 'weekly', label: 'Tuần' },
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
                bg-white rounded-2xl p-5 border border-slate-100
                flex items-center gap-4 transition-shadow duration-150
                hover:shadow-md
                ${onClick ? 'cursor-pointer' : ''}
            `}
        >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                {icon}
            </div>
            <div className="min-w-0">
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
    const [reportType, setReportType] = useState<PeriodType>('daily');
    const [stats, setStats] = useState<ProductStat[]>([]);
    const [logs, setLogs] = useState<InventoryLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'sales' | 'history'>('sales');

    /* ── Fetch stores on mount ─── */
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const res = await fetch('/api/admin/stores');
                let data = await res.json();

                // Lọc chi nhánh cho Branch Admin
                if (user?.storeId && user.storeId !== 'all') {
                    data = data.filter((s: Store) => s.id === user.storeId);
                }

                setStores(data);
                const initialStoreId = user?.storeId && user.storeId !== 'all' ? user.storeId : (data[0]?.id || '');
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

    const bestSellers = useMemo(
        () => [...stats].sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5),
        [stats]
    );

    const slowMoving = useMemo(
        () => [...stats].sort((a, b) => a.totalQuantity - b.totalQuantity).slice(0, 5),
        [stats]
    );

    const lowStockProducts = useMemo(
        () => stats.filter(s => s.currentStock <= 5),
        [stats]
    );

    const categoryData = useMemo(() => {
        const groups: Record<string, number> = {};
        stats.forEach(s => {
            groups[s.category] = (groups[s.category] || 0) + s.totalQuantity;
        });
        return Object.entries(groups).map(([key, value]) => ({
            name: CAT_LABELS[key] ?? 'Khác',
            value,
        }));
    }, [stats]);

    const filteredStats = useMemo(
        () => stats.filter(s => s.productName.toLowerCase().includes(searchTerm.toLowerCase())),
        [stats, searchTerm]
    );

    const filteredLogs = useMemo(
        () => logs.filter(l => l.productName.toLowerCase().includes(searchTerm.toLowerCase())),
        [logs, searchTerm]
    );

    /* ── CSV export ─── */
    const exportToCSV = () => {
        const isHistory = activeTab === 'history';
        const source = isHistory ? logs : stats;
        if (source.length === 0) { toast.error('Không có dữ liệu để xuất'); return; }

        const headers = isHistory
            ? ['Ngày nhập', 'Sản phẩm', 'Biến động', 'Ghi chú', 'Trạng thái']
            : ['Sản phẩm', 'Loại', 'Tồn đầu', 'Đã nhập', 'Đã bán', 'Doanh thu', 'Tồn hiện tại'];

        const rows = isHistory
            ? logs.map(l => [
                new Date(l.createdAt).toLocaleString('vi-VN'),
                l.productName,
                l.quantity > 0 ? `+${l.quantity}` : String(l.quantity),
                l.note ?? '',
                l.quantity >= 0 ? 'Nhập thêm' : 'Xuất/Hư hỏng',
            ])
            : stats.map(s => [
                s.productName,
                CAT_LABELS[s.category] ?? s.category,
                s.openingStock,
                s.totalRestocked,
                s.totalQuantity,
                s.totalRevenue,
                s.currentStock,
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
        <div className="min-h-screen bg-[#f0f2f5]" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>

            {/* ── Top bar ── */}
            <header className="bg-[#0f1117] sticky top-0 z-40 h-14 flex items-center justify-between px-7 shadow-md">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/admin">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-white hover:bg-white/10 rounded-lg gap-1.5 text-xs font-semibold"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Quay lại
                        </Button>
                    </Link>
                    <h1 className="text-white text-[15px] font-bold tracking-tight flex items-center gap-2">
                        <Boxes className="w-[18px] h-[18px] text-emerald-400" />
                        Báo cáo <span className="text-emerald-400">Kho hàng</span>
                    </h1>
                </div>

                <Button
                    onClick={exportToCSV}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg h-9 px-4 gap-2"
                >
                    <Download className="w-3.5 h-3.5" />
                    Xuất báo cáo
                </Button>
            </header>

            {/* ── Filter bar ── */}
            <div className="bg-white border-b border-slate-200 px-7 py-3 flex flex-wrap items-center gap-5">
                {/* Stores */}
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
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}
                                `}
                            >
                                {store.name}
                            </button>
                        ))}
                    </div>
                </div>

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
                    <div className="flex bg-slate-100 rounded-lg p-1 gap-0.5">
                        {PERIOD_OPTIONS.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setReportType(opt.id)}
                                className={`
                                    px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all
                                    ${reportType === opt.id
                                        ? 'bg-white text-emerald-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'}
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
                            onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }}
                            className={`
                                flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold
                                border transition-all
                                ${activeTab === tab.id
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}
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
                        value={bestSellers[0]?.productName ?? '---'}
                        sub={`Số lượng: ${bestSellers[0]?.totalQuantity ?? 0}`}
                        subColor="text-blue-500"
                    />
                    <KpiCard
                        iconBg="bg-rose-50"
                        icon={<TrendingDown className="w-5 h-5 text-rose-500" />}
                        label="Bán chậm nhất"
                        value={slowMoving[0]?.productName ?? '---'}
                        sub={`Số lượng: ${slowMoving[0]?.totalQuantity ?? 0}`}
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
                        <div className="bg-white rounded-2xl border border-slate-100 p-5">
                            <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-2 mb-5">
                                <TrendingUp className="w-4 h-4 text-emerald-600" />
                                Top 5 sản phẩm bán chạy
                            </h2>
                            <div className="h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={bestSellers} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f3f4f6" />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="productName"
                                            type="category"
                                            axisLine={false}
                                            tickLine={false}
                                            width={110}
                                            tick={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
                                            tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v}
                                        />
                                        <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f9fafb' }} />
                                        <Bar dataKey="totalQuantity" fill="#10b981" radius={[0, 6, 6, 0]} barSize={22} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Category donut */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-5">
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
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    {/* Table header */}
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                        <h2 className="text-[13px] font-bold text-slate-800">
                            {activeTab === 'sales' ? 'Chi tiết sản lượng bán hàng' : 'Chi tiết các đợt nhập kho'}
                        </h2>
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

                    {/* Table body */}
                    <div className="overflow-x-auto">
                        {activeTab === 'sales' ? (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        {['Sản phẩm', 'Loại', 'Tồn đầu', `Nhập (${reportType})`, `Đã bán (${reportType})`, 'Doanh thu', 'Tồn hiện tại'].map((h, i) => (
                                            <th
                                                key={h}
                                                className={`px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider
                                                    ${i >= 2 && i <= 4 ? 'text-center' : i === 5 ? 'text-right' : i === 6 ? 'text-center' : 'text-left'}`}
                                            >
                                                {h}
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
                                            <td className="px-5 py-3 text-[13px] text-center font-semibold text-slate-600">{item.openingStock}</td>
                                            <td className="px-5 py-3 text-[13px] text-center font-bold text-blue-600">+{item.totalRestocked}</td>
                                            <td className="px-5 py-3 text-[13px] text-center font-bold text-emerald-600">{item.totalQuantity}</td>
                                            <td className="px-5 py-3 text-[13px] text-right font-semibold text-slate-700">
                                                {item.totalRevenue.toLocaleString('vi-VN')}đ
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <StockBadge stock={item.currentStock} />
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
            </main>

            {/* ── Low-stock warning modal ── */}
            <Dialog open={isWarningModalOpen} onOpenChange={setIsWarningModalOpen}>
                <DialogContent className="max-w-md rounded-3xl p-7">
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
                            <div key={p.productId} className="py-3.5 flex items-center justify-between group">
                                <div>
                                    <p className="text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
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