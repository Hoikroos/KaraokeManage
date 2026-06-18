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
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
    TrendingUp, Receipt, MonitorPlay, Trash2,
    Calendar, Search, Download, X, ArrowLeft,
    CheckCircle, ChevronDown, ChevronUp,
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
    icon, iconBg, label, value, valueColor, sub,
}: {
    icon: React.ReactNode; iconBg: string;
    label: string; value: string; valueColor?: string; sub: string;
}) {
    return (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all duration-200 group relative overflow-hidden">
            {/* subtle bg sparkline placeholder */}
            <div className="absolute right-0 bottom-0 w-24 h-10 opacity-10 pointer-events-none">
                <svg viewBox="0 0 96 40" fill="none" className="w-full h-full">
                    <polyline points="0,35 16,28 32,30 48,18 64,22 80,10 96,15" stroke="currentColor" strokeWidth="2" fill="none" className="text-blue-400" />
                </svg>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-slate-400 mb-1">{label}</p>
                <p className={`text-[17px] font-extrabold leading-tight truncate ${valueColor ?? 'text-slate-900'}`}>{value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
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
                <p key={p.name} style={{ color: p.color }} className="font-semibold">
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
        { name: 'Chưa thanh toán', value: pendingRevenue, color: '#e2e8f0' },
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
            <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 shadow-sm border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/admin">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 gap-1.5 text-[13px] font-semibold rounded-lg transition-all px-2"
                        >
                            <ArrowLeft className="w-4 h-4" /> Quay lại
                        </Button>
                    </Link>
                    <div className="w-px h-5 bg-slate-200" />
                    <h1 className="text-slate-900 text-[15px] font-bold tracking-tight flex items-center gap-2">
                        Báo cáo <span className="text-blue-600">Hóa đơn</span>
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    {invoices.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDeleteAll}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-200 text-[12px] font-semibold gap-1.5 rounded-lg transition-all h-8 px-3"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Xóa tất cả
                        </Button>
                    )}
                    <Button
                        size="sm"
                        onClick={exportToCSV}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold gap-1.5 rounded-lg transition-all h-8 px-4"
                    >
                        <Download className="w-3.5 h-3.5" /> Xuất Excel
                    </Button>
                </div>
            </header>

            {/* ── Filter bar ── */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3">
                {/* Stores */}
                {stores.length > 1 && (
                    <div className="flex gap-1.5 flex-wrap">
                        {stores.map(store => (
                            <button
                                key={store.id}
                                onClick={() => handleStoreChange(store.id)}
                                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all
                                    ${selectedStoreId === store.id
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                            >
                                {store.name}
                            </button>
                        ))}
                        <div className="w-px h-8 bg-slate-200 self-center mx-1" />
                    </div>
                )}

                {/* From date */}
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Từ ngày</span>
                    <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <Input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="pl-8 h-8 text-[12px] bg-slate-50 border-slate-200 rounded-lg w-36 focus:bg-white focus:border-blue-400"
                        />
                    </div>
                </div>

                {/* To date */}
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Đến ngày</span>
                    <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <Input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="pl-8 h-8 text-[12px] bg-slate-50 border-slate-200 rounded-lg w-36 focus:bg-white focus:border-blue-400"
                        />
                    </div>
                </div>

                {/* Search */}
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tìm kiếm</span>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Mã hóa đơn..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-8 h-8 text-[12px] bg-slate-50 border-slate-200 rounded-lg w-40 focus:bg-white focus:border-blue-400"
                        />
                    </div>
                </div>

                {hasActiveFilters && (
                    <button
                        onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); }}
                        className="self-end p-1.5 rounded-lg border border-red-200 bg-white text-red-400 hover:bg-red-50 transition-colors"
                        title="Xóa bộ lọc"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Period tabs — pushed to right */}
                <div className="flex flex-col gap-0.5 ml-auto">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Chu kỳ biểu đồ</span>
                    <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                        {PERIOD_OPTIONS.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setReportType(opt.id)}
                                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all
                                    ${reportType === opt.id
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Main content: 2-column layout ── */}
            <main className="max-w-[1400px] mx-auto px-6 py-5 flex gap-5 items-start">

                {/* ── LEFT COLUMN ── */}
                <div className="flex-1 min-w-0 space-y-5">

                    {/* KPI cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KpiCard
                            iconBg="bg-blue-50"
                            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
                            label="Tổng doanh thu"
                            value={`${fmtVND(totalRevenue)}đ`}
                            sub="Tất cả hóa đơn"
                        />
                        <KpiCard
                            iconBg="bg-emerald-50"
                            icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
                            label="Đã thanh toán"
                            value={`${fmtVND(paidRevenue)}đ`}
                            valueColor="text-emerald-600"
                            sub="Doanh thu thực"
                        />
                        <KpiCard
                            iconBg="bg-orange-50"
                            icon={<MonitorPlay className="w-5 h-5 text-orange-500" />}
                            label="Lượt thuê phòng"
                            value={String(roomHireInvoices.length)}
                            sub="Đã thanh toán"
                        />
                        <KpiCard
                            iconBg="bg-violet-50"
                            icon={<Receipt className="w-5 h-5 text-violet-500" />}
                            label="Tổng hóa đơn"
                            value={String(filteredInvoices.length)}
                            sub="Trong kỳ lọc"
                        />
                    </div>

                    {/* Revenue chart */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                                Biểu đồ doanh thu
                            </h2>
                            <div className="flex items-center gap-4 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
                                    Doanh thu
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                                    Lượt thuê
                                </span>
                            </div>
                        </div>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                                    <Tooltip content={<RevenueTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar yAxisId="left" dataKey="total" fill="#3b82f6" radius={[5, 5, 0, 0]} barSize={32} />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="count"
                                        stroke="#f59e0b"
                                        strokeWidth={2.5}
                                        dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Invoice list grouped by working day */}
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <h2 className="text-[13px] font-bold text-slate-800">
                                    Danh sách hóa đơn theo ngày
                                    {selectedStore ? ` — ${selectedStore.name}` : ''}
                                </h2>
                                <span className="bg-slate-100 text-slate-500 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                    {groupedByDay.length} ngày · {filteredInvoices.length} HĐ
                                </span>
                            </div>
                            {groupedByDay.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <button onClick={expandAllDays} className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                                        Mở tất cả
                                    </button>
                                    <button onClick={collapseAllDays} className="text-[12px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                                        Thu gọn
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-2 bg-amber-50/70 border-b border-amber-100 text-[11px] text-amber-700">
                            Một &quot;ngày làm việc&quot; tính từ <span className="font-bold">06:00 sáng</span> đến <span className="font-bold">05:59 sáng hôm sau</span> <span className="italic">(rạng sáng vẫn thuộc ca tối hôm trước)</span>.
                        </div>

                        {isLoading ? (
                            <div className="py-12 text-center text-slate-400 text-[13px] italic">Đang tải...</div>
                        ) : groupedByDay.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-[13px] italic">Chưa có hóa đơn nào</div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {groupedByDay.map(group => {
                                    const expanded = !!expandedDays[group.key];
                                    const toggle = () => setExpandedDays(prev => ({ ...prev, [group.key]: !prev[group.key] }));
                                    return (
                                        <div key={group.key}>
                                            <div className={`px-5 py-3 flex items-center justify-between gap-3 flex-wrap transition-colors ${expanded ? 'bg-blue-50/40' : 'bg-white hover:bg-slate-50/70'}`}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <button
                                                        onClick={toggle}
                                                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${expanded
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                    >
                                                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <div className="min-w-0">
                                                        <div className="flex items-baseline gap-2 flex-wrap">
                                                            <span className="text-[13px] font-bold text-slate-800">Ngày {group.dateLabel}</span>
                                                            <span className="text-[11px] text-slate-400">{group.weekday}</span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                                            <span className="font-semibold text-slate-700">{group.invoices.length}</span> hóa đơn
                                                            <span className="mx-1 text-slate-300">·</span>
                                                            <span className="font-semibold text-emerald-600">{group.paidCount}</span>
                                                            <span className="text-emerald-600"> đã thanh toán</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-[14px] font-extrabold text-emerald-600">{fmtVND(group.paidTotal)}đ</div>
                                                    <button
                                                        onClick={toggle}
                                                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all border ${expanded
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                                                    >
                                                        {expanded ? 'Thu gọn' : 'Xem thêm'}
                                                    </button>
                                                </div>
                                            </div>
                                            {expanded && (
                                                <div className="overflow-x-auto border-t border-slate-100">
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
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT SIDEBAR ── */}
                <div className="w-[260px] flex-shrink-0 space-y-4">

                    {/* Cơ cấu thanh toán */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <h3 className="text-[12px] font-bold text-slate-700 mb-4">Cơ cấu thanh toán</h3>

                        {/* Donut chart */}
                        <div className="relative flex items-center justify-center mb-4">
                            <PieChart width={140} height={140}>
                                <Pie
                                    data={pieData}
                                    cx={65}
                                    cy={65}
                                    innerRadius={46}
                                    outerRadius={65}
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
                                <span className="text-[20px] font-extrabold text-slate-800">{paidPct}%</span>
                                <span className="text-[10px] text-slate-400 font-medium">đã thanh toán</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="flex items-center gap-1.5 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                    Đã thanh toán
                                </span>
                                <span className="font-bold text-slate-800">{paidPct}%</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="flex items-center gap-1.5 text-slate-500">
                                    <span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />
                                    Chưa thanh toán
                                </span>
                                <span className="font-bold text-slate-500">{100 - paidPct}%</span>
                            </div>
                            <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Đã TT</span>
                                    <span className="font-semibold text-emerald-600">{fmtVND(paidRevenue)}đ</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Chưa TT</span>
                                    <span className="font-semibold text-slate-500">{fmtVND(pendingRevenue)}đ</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Thông tin nhanh */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <h3 className="text-[12px] font-bold text-slate-700 mb-3">Thông tin nhanh</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-500">Hóa đơn trung bình / ngày</span>
                                <span className="text-[13px] font-extrabold text-slate-800">{avgInvoicesPerDay}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-500">Doanh thu trung bình / ngày</span>
                                <span className="text-[12px] font-extrabold text-slate-800">{fmtVND(avgRevenuePerDay)}đ</span>
                            </div>
                            {bestDay && (
                                <div className="pt-2 border-t border-slate-100">
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ngày doanh thu cao nhất</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-600">{bestDay.dateLabel}</span>
                                        <span className="text-[12px] font-extrabold text-blue-600">{fmtVND(bestDay.paidTotal)}đ</span>
                                    </div>
                                </div>
                            )}
                            {worstDay && worstDay.key !== bestDay?.key && (
                                <div>
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ngày doanh thu thấp nhất</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-600">{worstDay.dateLabel}</span>
                                        <span className="text-[12px] font-extrabold text-orange-500">{fmtVND(worstDay.paidTotal)}đ</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}