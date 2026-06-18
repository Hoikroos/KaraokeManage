'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/context';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Invoice, Store } from '@/lib/db';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import {
    AreaChart, Area, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
    TrendingUp, Receipt, MonitorPlay, Trash2,
    Calendar, Search, Download, X, ArrowLeft,
    CheckCircle, ChevronDown, ChevronUp, Info,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────── */

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/* ─── Constants ──────────────────────────────────────────────── */

const PERIOD_OPTIONS: { id: PeriodType; label: string }[] = [
    { id: 'daily', label: 'Ngày' },
    { id: 'weekly', label: 'Tuần' },
    { id: 'monthly', label: 'Tháng' },
    { id: 'quarterly', label: 'Quý' },
    { id: 'yearly', label: 'Năm' },
];

function getGroupKey(date: Date, period: PeriodType): string {
    const d = getWorkingDay(date);
    if (period === 'daily') return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    if (period === 'weekly') {
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil((Math.floor((d.getTime() - oneJan.getTime()) / 864e5) + oneJan.getDay() + 1) / 7);
        return `Tuần ${week}`;
    }
    if (period === 'monthly') return `T${d.getMonth() + 1}`;
    if (period === 'quarterly') return `Q${Math.floor(d.getMonth() / 3) + 1}`;
    return `${d.getFullYear()}`;
}

function fmtVND(n: number) {
    const rounded = Math.ceil(n / 1000) * 1000;
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(rounded);
}

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

function formatWeekday(d: Date): string {
    const w = d.toLocaleDateString('vi-VN', { weekday: 'long' });
    return w.charAt(0).toUpperCase() + w.slice(1);
}

/* ─── Sub-components ─────────────────────────────────────────── */

function KpiCard({
    icon, iconBg, label, value, valueColor, sub, sparkColor,
}: {
    icon: React.ReactNode; iconBg: string;
    label: string; value: string; valueColor?: string; sub: string; sparkColor: string;
}) {
    return (
        <div className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-3 hover:shadow-md transition-all duration-200 relative overflow-hidden">
            {/* subtle bg sparkline */}
            <div className="absolute right-0 bottom-0 w-28 h-12 opacity-60 pointer-events-none">
                <svg viewBox="0 0 96 40" fill="none" className="w-full h-full">
                    <polyline points="0,35 16,28 32,30 48,18 64,22 80,10 96,15" stroke={sparkColor} strokeWidth="2" fill="none" />
                </svg>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1 relative z-10">
                <p className="text-[11px] font-medium text-slate-400 mb-0.5 flex items-center gap-1">
                    {label}
                    <Info className="w-3 h-3 text-slate-300" />
                </p>
                <p className={`text-[20px] font-extrabold leading-tight truncate ${valueColor ?? 'text-slate-900'}`}>{value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    return status === 'paid' ? (
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
            Đã thanh toán
        </span>
    ) : (
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 text-[10px] font-bold">
            Chờ
        </span>
    );
}

const RevenueTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-[12px]">
            <p className="font-bold text-slate-700 mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.name === 'total' ? '#3b82f6' : '#f59e0b' }} className="font-semibold">
                    {p.name === 'total'
                        ? `Doanh thu: ${fmtVND(p.value)}đ`
                        : `Lượt thuê: ${p.value}`}
                </p>
            ))}
        </div>
    );
};

/* ─── Main Page ──────────────────────────────────────────────── */

export default function ReportsPage() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [reportType, setReportType] = useState<PeriodType>('daily');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

    /* ── Fetch ─── */
    useEffect(() => {
        const init = async () => {
            try {
                const res = await fetch('/api/admin/stores');
                let data: Store[] = await res.json();
                if (user?.storeId && user.storeId !== 'all') {
                    data = data.filter((s: Store) => s.id === user.storeId);
                }
                setStores(data);
                const initialStoreId = (user?.storeId && user.storeId !== 'all') ? user.storeId : (data[0]?.id || '');
                if (initialStoreId) {
                    setSelectedStoreId(initialStoreId);
                    await fetchInvoices(initialStoreId);
                }
            } catch {
                toast.error('Không thể tải dữ liệu');
            } finally {
                setIsLoading(false);
            }
        };
        if (user) init();
    }, [user]);

    const fetchInvoices = useCallback(async (storeId: string) => {
        if (!storeId) return;
        try {
            const res = await fetch(`/api/invoices?storeId=${storeId}&includeDeleted=true`, { cache: 'no-store' });
            const data = await res.json();
            setInvoices(data);
        } catch {
            toast.error('Lỗi tải hóa đơn');
        }
    }, []);

    const handleStoreChange = (storeId: string) => {
        setSelectedStoreId(storeId);
        fetchInvoices(storeId);
    };

    /* ── Delete ─── */
    const handleDeleteInvoice = async (id: string) => {
        const result = await Swal.fire({
            title: 'Xóa hóa đơn?',
            text: 'Hành động này không thể hoàn tác.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy',
        });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch('/api/invoices', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, permanent: true }),
            });
            if (res.ok) {
                setInvoices(prev => prev.filter(inv => inv.id !== id));
                toast.success('Đã xóa hóa đơn');
            } else {
                toast.error('Lỗi khi xóa hóa đơn');
            }
        } catch {
            toast.error('Lỗi kết nối');
        }
    };

    const handleDeleteAll = async () => {
        if (!invoices.length) return;
        const result = await Swal.fire({
            title: 'Xóa vĩnh viễn tất cả?',
            text: 'Toàn bộ hóa đơn của chi nhánh này sẽ bị xóa và KHÔNG thể khôi phục.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Xóa vĩnh viễn',
            cancelButtonText: 'Hủy',
        });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch('/api/invoices', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true, storeId: selectedStoreId, permanent: true }),
            });
            if (res.ok) {
                setInvoices([]);
                toast.success('Đã xóa toàn bộ hóa đơn');
            } else {
                toast.error('Lỗi khi xóa');
            }
        } catch {
            toast.error('Lỗi kết nối');
        }
    };

    /* ── Derived ─── */
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const id = (inv.id ?? '').toLowerCase();
            if (searchTerm && !id.includes(searchTerm.toLowerCase())) return false;
            const d = new Date(inv.startTime);
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                if (d < s) return false;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                if (d > e) return false;
            }
            return true;
        });
    }, [invoices, searchTerm, startDate, endDate]);

    const chartData = useMemo(() => {
        const groups: Record<string, { total: number; count: number }> = {};
        filteredInvoices.forEach(inv => {
            if (inv.status !== 'paid') return;
            const key = getGroupKey(new Date(inv.startTime), reportType);
            if (!groups[key]) groups[key] = { total: 0, count: 0 };
            groups[key].total += inv.totalPrice;
            if (!inv.id.startsWith('TKW') && !inv.id.startsWith('GFT')) {
                groups[key].count += 1;
            }
        });
        return Object.entries(groups).map(([name, data]) => ({ name, ...data }));
    }, [filteredInvoices, reportType]);

    const totalRevenue = useMemo(() =>
        filteredInvoices.reduce((s, inv) => s + inv.totalPrice, 0), [filteredInvoices]);

    const paidInvoices = useMemo(() =>
        filteredInvoices.filter(inv => inv.status === 'paid'), [filteredInvoices]);

    const paidRevenue = useMemo(() =>
        paidInvoices.reduce((s, inv) => s + inv.totalPrice, 0), [paidInvoices]);

    const roomHireInvoices = useMemo(() =>
        paidInvoices.filter(inv => !inv.id.startsWith('TKW') && !inv.id.startsWith('GFT')),
        [paidInvoices]);

    const groupedByDay = useMemo(() => {
        const groups: Record<string, { date: Date; invoices: Invoice[] }> = {};
        for (const inv of filteredInvoices) {
            const start = new Date(inv.startTime);
            const key = getWorkingDayKey(start);
            if (!groups[key]) groups[key] = { date: getWorkingDay(start), invoices: [] };
            groups[key].invoices.push(inv);
        }
        return Object.entries(groups)
            .map(([key, g]) => {
                const sorted = [...g.invoices].sort(
                    (a, b) => +new Date(b.startTime) - +new Date(a.startTime),
                );
                const paidInvs = sorted.filter(i => i.status === 'paid');
                return {
                    key,
                    date: g.date,
                    dateLabel: formatDayShort(g.date),
                    weekday: formatWeekday(g.date),
                    invoices: sorted,
                    paidCount: paidInvs.length,
                    paidTotal: paidInvs.reduce((s, i) => s + i.totalPrice, 0),
                };
            })
            .sort((a, b) => +b.date - +a.date);
    }, [filteredInvoices]);

    const expandAllDays = () => {
        setExpandedDays(Object.fromEntries(groupedByDay.map(g => [g.key, true])));
    };
    const collapseAllDays = () => setExpandedDays({});

    const selectedStore = stores.find(s => s.id === selectedStoreId);
    const hasActiveFilters = !!(startDate || endDate || searchTerm);

    /* ── Sidebar stats ── */
    const pendingRevenue = useMemo(() =>
        filteredInvoices.filter(inv => inv.status !== 'paid').reduce((s, inv) => s + inv.totalPrice, 0),
        [filteredInvoices]);

    const paidPct = totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0;

    const avgInvoicesPerDay = useMemo(() => {
        if (!groupedByDay.length) return 0;
        return (filteredInvoices.length / groupedByDay.length).toFixed(2);
    }, [filteredInvoices, groupedByDay]);

    const avgRevenuePerDay = useMemo(() => {
        if (!groupedByDay.length) return 0;
        return Math.round(paidRevenue / groupedByDay.length);
    }, [paidRevenue, groupedByDay]);

    const bestDay = useMemo(() => {
        if (!groupedByDay.length) return null;
        return groupedByDay.reduce((best, g) => g.paidTotal > best.paidTotal ? g : best, groupedByDay[0]);
    }, [groupedByDay]);

    const worstDay = useMemo(() => {
        if (!groupedByDay.length) return null;
        return groupedByDay.reduce((worst, g) => g.paidTotal < worst.paidTotal ? g : worst, groupedByDay[0]);
    }, [groupedByDay]);

    const pieData = [
        { name: 'Đã thanh toán', value: paidRevenue, color: '#22c55e' },
        { name: 'Chưa thanh toán', value: pendingRevenue, color: '#f59e0b' },
    ];

    /* ── Export ─── */
    const exportToCSV = () => {
        if (!filteredInvoices.length) { toast.error('Không có dữ liệu để xuất'); return; }
        const headers = ['Mã HD', 'Phòng', 'Thời gian', 'Tổng tiền (VNĐ)', 'Trạng thái'];
        const rows = filteredInvoices.map(inv => [
            `#${inv.id.slice(0, 8).toUpperCase()}`,
            `Phòng ${(inv as any).roomNumber ?? ''}`,
            new Date(inv.startTime).toLocaleString('vi-VN'),
            Math.ceil(inv.totalPrice / 1000) * 1000,
            inv.status === 'paid' ? 'Đã thanh toán' : 'Chờ',
        ]);
        const csv = '\ufeff' + [headers, ...rows].map(r => r.join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        a.download = `hoa-don-${selectedStoreId}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        toast.success('Xuất file thành công!');
    };

    /* ─────────────────────────────────────────────────────────── */
    /*  RENDER                                                     */
    /* ─────────────────────────────────────────────────────────── */

    return (
        <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>

            {/* ── Top bar ── */}
            <header className="bg-white sticky top-0 z-40 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/admin">
                        <button className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-[13px] font-semibold transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Quay lại
                        </button>
                    </Link>
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    <h1 className="text-slate-900 text-[22px] font-extrabold tracking-tight flex items-center gap-2">
                        Báo cáo <span className="text-blue-600">Hóa đơn</span>
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    {invoices.length > 0 && (
                        <button
                            onClick={handleDeleteAll}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-red-500 text-[13px] font-semibold hover:bg-red-50 hover:border-red-200 transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                            Xóa tất cả
                        </button>
                    )}
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-[13px] font-semibold hover:bg-slate-50 transition-all"
                    >
                        <Download className="w-4 h-4" /> Xuất Excel
                    </button>
                </div>
            </header>

            {/* ── Filter bar ── */}
            <div className="px-6 pt-5 pb-3 flex flex-wrap items-end gap-3">
                {/* Stores */}
                {stores.length > 1 && (
                    <div className="flex gap-1.5 flex-wrap">
                        {stores.map(store => (
                            <button
                                key={store.id}
                                onClick={() => handleStoreChange(store.id)}
                                className={`px-3.5 py-2.5 rounded-xl text-[13px] font-semibold border transition-all
                                    ${selectedStoreId === store.id
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                            >
                                {store.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* From date */}
                <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-slate-500">Từ ngày</span>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <Input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="pl-8 h-10 text-[13px] bg-white border-slate-200 rounded-xl w-40 focus:border-blue-400"
                        />
                    </div>
                </div>

                {/* To date */}
                <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-slate-500">Đến ngày</span>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <Input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="pl-8 h-10 text-[13px] bg-white border-slate-200 rounded-xl w-40 focus:border-blue-400"
                        />
                    </div>
                </div>

                {/* Search */}
                <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-slate-500">Tìm kiếm hóa đơn</span>
                    <div className="relative">
                        <Input
                            placeholder="Nhập mã hóa đơn, khách hàng..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pr-9 h-10 text-[13px] bg-white border-slate-200 rounded-xl w-64 focus:border-blue-400"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {hasActiveFilters && (
                    <button
                        onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); }}
                        className="h-10 px-3 rounded-xl border border-red-200 bg-white text-red-400 hover:bg-red-50 transition-colors flex items-center"
                        title="Xóa bộ lọc"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Period tabs — pushed to right */}
                <div className="ml-auto flex bg-white rounded-xl p-1 gap-0.5 border border-slate-200">
                    {PERIOD_OPTIONS.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setReportType(opt.id)}
                            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all
                                ${reportType === opt.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main content ── */}
            <main className="px-6 pb-6 space-y-5">

                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                        iconBg="bg-blue-50"
                        icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
                        label="Tổng doanh thu"
                        value={`${fmtVND(totalRevenue)}đ`}
                        sub="↑ 12.5% so với kỳ trước"
                        sparkColor="#bfdbfe"
                    />
                    <KpiCard
                        iconBg="bg-emerald-50"
                        icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
                        label="Đã thanh toán"
                        value={`${fmtVND(paidRevenue)}đ`}
                        sub={`${paidPct ? Math.round((paidRevenue / (totalRevenue || 1)) * 100) : 0}% tổng doanh thu`}
                        sparkColor="#bbf7d0"
                    />
                    <KpiCard
                        iconBg="bg-orange-50"
                        icon={<MonitorPlay className="w-5 h-5 text-orange-500" />}
                        label="Lượt thuê phòng"
                        value={String(roomHireInvoices.length)}
                        sub="↑ 18 lượt so với kỳ trước"
                        sparkColor="#fed7aa"
                    />
                    <KpiCard
                        iconBg="bg-violet-50"
                        icon={<Receipt className="w-5 h-5 text-violet-500" />}
                        label="Tổng hóa đơn"
                        value={String(filteredInvoices.length)}
                        sub="Trong kỳ lọc"
                        sparkColor="#ddd6fe"
                    />
                </div>

                <div className="flex gap-5 items-start flex-col lg:flex-row">

                    {/* ── LEFT COLUMN ── */}
                    <div className="flex-1 min-w-0 space-y-5 w-full">

                        {/* Revenue chart */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                <h2 className="text-[14px] font-bold text-slate-800 flex items-center gap-1.5">
                                    Điều độ doanh thu
                                    <Info className="w-3.5 h-3.5 text-slate-300" />
                                </h2>
                                <div className="flex items-center gap-4 text-[12px] text-slate-500">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                                        Doanh thu (đ)
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                                        Lượt thuê
                                    </span>
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-[12px]">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {chartData.length} {reportType === 'daily' ? 'ngày' : 'kỳ'}
                                    </span>
                                </div>
                            </div>
                            <div className="h-[300px] relative">
                                <span className="absolute -top-1 left-0 text-[10px] text-blue-500 font-medium">Doanh thu (đ)</span>
                                <span className="absolute -top-1 right-0 text-[10px] text-amber-500 font-medium">Lượt thuê</span>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Be Vietnam Pro' }}
                                            dy={8}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                                            tickFormatter={v => `${Math.round(v / 1_000_000)}M`}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#f59e0b' }}
                                            tickFormatter={v => `${v}`}
                                        />
                                        <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                                        <Area
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="total"
                                            stroke="#3b82f6"
                                            strokeWidth={2.5}
                                            fill="url(#revenueFill)"
                                            dot={{ r: 3, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="count"
                                            stroke="#f59e0b"
                                            strokeWidth={2.5}
                                            dot={{ r: 3, fill: '#fff', stroke: '#f59e0b', strokeWidth: 2 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Invoice list grouped by working day */}
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-[14px] font-bold text-slate-800">
                                        Danh sách hóa đơn theo ngày
                                        {selectedStore ? ` — ${selectedStore.name}` : ''}
                                    </h2>
                                    <span className="text-[12px] text-slate-400 font-medium">
                                        {groupedByDay.length} ngày · {filteredInvoices.length} hóa đơn
                                    </span>
                                </div>
                                {groupedByDay.length > 0 && (
                                    <div className="flex items-center gap-3">
                                        <button onClick={expandAllDays} className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                                            Mới nhất
                                        </button>
                                        <button onClick={collapseAllDays} className="text-[12px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                                            Thu gọn
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isLoading ? (
                                <div className="py-12 text-center text-slate-400 text-[13px] italic">Đang tải...</div>
                            ) : groupedByDay.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 text-[13px] italic">Chưa có hóa đơn nào</div>
                            ) : (
                                <div className="px-5 py-2">
                                    {groupedByDay.map((group, gi) => {
                                        const expanded = !!expandedDays[group.key];
                                        const toggle = () => setExpandedDays(prev => ({ ...prev, [group.key]: !prev[group.key] }));
                                        const isLast = gi === groupedByDay.length - 1;
                                        return (
                                            <div key={group.key} className="flex gap-4">
                                                {/* Timeline rail */}
                                                <div className="flex flex-col items-center flex-shrink-0 pt-4">
                                                    <span className={`w-3.5 h-3.5 rounded-full border-2 ${gi === 0 ? 'border-blue-600 bg-white' : 'border-slate-300 bg-white'}`} />
                                                    {!isLast && <span className="w-px flex-1 bg-slate-200 mt-1" />}
                                                </div>

                                                {/* Day row */}
                                                <div className="flex-1 min-w-0 pb-4">
                                                    <div className="py-3.5 flex items-center justify-between gap-3 flex-wrap">
                                                        <div className="min-w-0">
                                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                                <span className="text-[14px] font-bold text-slate-800">{group.dateLabel}</span>
                                                            </div>
                                                            <div className="text-[12px] text-slate-400 mt-0.5">{group.weekday}</div>
                                                            <div className="text-[12px] text-slate-500 mt-1">
                                                                <span className="font-semibold text-slate-700">{group.invoices.length}</span> hóa đơn
                                                                <span className="mx-1.5 text-slate-300">·</span>
                                                                <span className="font-semibold text-emerald-600">{group.paidCount}</span>
                                                                <span className="text-emerald-600"> đã thanh toán</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-[16px] font-extrabold text-emerald-600">{fmtVND(group.paidTotal)}đ</div>
                                                            <button
                                                                onClick={toggle}
                                                                className="px-4 py-2 rounded-xl text-[12px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1"
                                                            >
                                                                {expanded ? 'Thu gọn' : 'Xem chi tiết'}
                                                                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {expanded && (
                                                        <div className="overflow-x-auto border border-slate-100 rounded-xl mb-2">
                                                            <table className="w-full" style={{ tableLayout: 'fixed' }}>
                                                                <colgroup>
                                                                    <col style={{ width: '100px' }} />
                                                                    <col style={{ width: '110px' }} />
                                                                    <col style={{ width: '165px' }} />
                                                                    <col style={{ width: '145px' }} />
                                                                    <col style={{ width: '120px' }} />
                                                                    <col style={{ width: '130px' }} />
                                                                </colgroup>
                                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                                    <tr>
                                                                        {['Mã HD', 'Phòng', 'Thời gian', 'Tổng tiền', 'Trạng thái', 'Thao tác'].map(h => (
                                                                            <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                                {h}
                                                                            </th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {group.invoices.map((invoice, idx) => (
                                                                        <tr key={invoice.id} className={`transition-colors ${idx % 2 === 0 ? 'hover:bg-blue-50/30' : 'bg-slate-50/40 hover:bg-blue-50/30'}`}>
                                                                            <td className="px-4 py-3 font-mono text-[11px] font-semibold text-slate-500">
                                                                                #{invoice.id.slice(0, 6).toUpperCase()}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-[13px] font-bold text-slate-900">
                                                                                Phòng {(invoice as any).roomNumber}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-[11px] text-slate-500">
                                                                                {new Date(invoice.startTime).toLocaleString('vi-VN')}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-[13px] font-bold text-slate-900">
                                                                                {fmtVND(invoice.totalPrice)}đ
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <StatusBadge status={invoice.status} />
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Link href={`/dashboard/invoice/${invoice.id}`}>
                                                                                        <button className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-blue-600 text-[11px] font-semibold hover:bg-blue-50 hover:border-blue-200 transition-all">
                                                                                            Chi tiết
                                                                                        </button>
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => handleDeleteInvoice(invoice.id)}
                                                                                        className="p-1.5 rounded-lg border border-red-100 bg-white text-red-400 hover:bg-red-50 hover:border-red-200 transition-all"
                                                                                    >
                                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT SIDEBAR ── */}
                    <div className="w-full lg:w-[280px] flex-shrink-0 space-y-4">

                        {/* Cơ cấu thanh toán */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <h3 className="text-[14px] font-bold text-slate-800 mb-4">Cơ cấu thanh toán</h3>

                            <div className="flex items-center gap-4">
                                {/* Donut chart */}
                                <div className="relative flex items-center justify-center flex-shrink-0">
                                    <PieChart width={120} height={120}>
                                        <Pie
                                            data={pieData}
                                            cx={60}
                                            cy={60}
                                            innerRadius={40}
                                            outerRadius={56}
                                            startAngle={90}
                                            endAngle={-270}
                                            dataKey="value"
                                            strokeWidth={0}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={index} fill={entry.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-[22px] font-extrabold text-slate-800">{paidPct}%</span>
                                        <span className="text-[10px] text-slate-400 font-medium text-center leading-tight">Đã thanh<br />toán</span>
                                    </div>
                                </div>

                                <div className="space-y-3 min-w-0 flex-1">
                                    <div>
                                        <div className="flex items-center gap-1.5 text-[12px] text-slate-600 mb-0.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                            Đã thanh toán
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[12px] font-bold text-slate-800">{fmtVND(paidRevenue)}đ</span>
                                            <span className="text-[12px] font-bold text-slate-800">{paidPct}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5 text-[12px] text-slate-600 mb-0.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                                            Còn thiếu
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[12px] font-bold text-slate-800">{fmtVND(pendingRevenue)}đ</span>
                                            <span className="text-[12px] font-bold text-slate-800">{100 - paidPct}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Thông tin nhanh */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <h3 className="text-[14px] font-bold text-slate-800 mb-4">Thông tin nhanh</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                        <Receipt className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <div className="flex-1 flex items-center justify-between min-w-0">
                                        <span className="text-[12px] text-slate-500">Hóa đơn trung bình / ngày</span>
                                        <span className="text-[14px] font-extrabold text-slate-800 ml-2">{avgInvoicesPerDay}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div className="flex-1 flex items-center justify-between min-w-0">
                                        <span className="text-[12px] text-slate-500">Doanh thu trung bình / ngày</span>
                                        <span className="text-[13px] font-extrabold text-slate-800 ml-2">{fmtVND(avgRevenuePerDay)}đ</span>
                                    </div>
                                </div>
                                {bestDay && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                                            <Calendar className="w-4 h-4 text-violet-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] text-slate-500">Ngày doanh thu cao nhất</div>
                                            <div className="flex items-center justify-between mt-0.5">
                                                <span className="text-[12px] font-semibold text-slate-700">{bestDay.dateLabel}</span>
                                                <span className="text-[13px] font-extrabold text-blue-600">{fmtVND(bestDay.paidTotal)}đ</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {worstDay && worstDay.key !== bestDay?.key && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                                            <Calendar className="w-4 h-4 text-red-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] text-slate-500">Ngày doanh thu thấp nhất</div>
                                            <div className="flex items-center justify-between mt-0.5">
                                                <span className="text-[12px] font-semibold text-slate-700">{worstDay.dateLabel}</span>
                                                <span className="text-[13px] font-extrabold text-orange-500">{fmtVND(worstDay.paidTotal)}đ</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}