'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { useAuth } from '@/app/context';
import { Store } from '@/lib/db';
import {
    History, Search, Eye, ArrowLeft, Calendar,
    X, BarChart3, Download, Trash2, Receipt,
    DoorOpen, Clock, Coins, UserCircle, User,
    Hash, BuildingStorefront,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

interface DisplayInvoice {
    id: string;
    totalPrice: number;
    createdAt: string | Date;
    roomNumber: string;
    status?: string;
    customerName?: string;
}

export default function InvoiceHistoryPage() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<DisplayInvoice[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        if (user !== undefined) fetchInitialData();
    }, [user]);

    const fetchInitialData = async () => {
        try {
            const storesRes = await fetch('/api/admin/stores');
            let storesData = (await storesRes.json()) || [];
            if (user?.storeId && user?.storeId !== 'all') {
                storesData = storesData.filter((s: Store) => s.id === user.storeId);
            }
            setStores(storesData);
            const initialStoreId = user?.storeId || (storesData.length > 0 ? storesData[0].id : '');
            setSelectedStoreId(initialStoreId);
            await fetchInvoices(initialStoreId);
        } catch (error) {
            console.error('Lỗi tải dữ liệu:', error);
            await fetchInvoices('');
        }
    };

    const fetchInvoices = async (storeId: string) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (storeId && storeId !== 'all') params.append('storeId', storeId);
            params.append('t', Date.now().toString());
            const res = await fetch(`/api/invoices?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json();
            const rawInvoices = Array.isArray(data) ? data : (data?.invoices || data?.data || []);
            const normalized: DisplayInvoice[] = rawInvoices.map((inv: any) => ({
                ...inv,
                id: String(inv.id || inv.Id || ''),
                totalPrice: Number(inv.totalPrice || inv.TotalPrice || 0),
                createdAt: inv.createdAt || inv.CreatedAt,
                roomNumber: inv.roomNumber || inv.RoomSession?.Room?.RoomNumber || inv.RoomSession?.Room?.roomNumber || '',
                customerName: inv.customerName || inv.CustomerName || 'Khách lẻ',
            }));
            setInvoices(normalized);
        } catch (error) {
            console.error('Lỗi tải hóa đơn:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredInvoices = useMemo(() => invoices.filter(inv => {
        const matchSearch =
            inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (inv.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchSearch) return false;
        if (startDate || endDate) {
            const invDate = new Date(inv.createdAt);
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (invDate < start) return false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (invDate > end) return false;
            }
        }
        return true;
    }), [invoices, searchTerm, startDate, endDate]);

    const chartData = useMemo(() => {
        const groups: { [key: string]: { count: number; dateObj: Date } } = {};
        filteredInvoices.forEach(inv => {
            if (!inv.createdAt) return;
            const date = new Date(inv.createdAt);
            if (isNaN(date.getTime())) return;
            const key = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            if (!groups[key]) {
                groups[key] = { count: 0, dateObj: new Date(date.getFullYear(), date.getMonth(), date.getDate()) };
            }
            groups[key].count += 1;
        });
        return Object.entries(groups)
            .map(([name, data]) => ({ name, count: data.count, dateObj: data.dateObj }))
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    }, [filteredInvoices]);

    const customerStats = useMemo(() => {
        const groups: { [key: string]: number } = {};
        filteredInvoices.forEach(inv => {
            if (inv.id.startsWith('GFT') || inv.id.startsWith('TKW')) return;
            const name = inv.customerName?.trim() || 'Khách lẻ';
            groups[name] = (groups[name] || 0) + 1;
        });
        return Object.entries(groups)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [filteredInvoices]);

    const totalLe = customerStats.find(c => c.name === 'Khách lẻ')?.count || 0;
    const totalNamed = customerStats.filter(c => c.name !== 'Khách lẻ').reduce((sum, c) => sum + c.count, 0);
    const namedCustomers = customerStats.filter(c => c.name !== 'Khách lẻ');

    const handleDeleteInvoice = async (id: string) => {
        const result = await Swal.fire({
            title: 'Chuyển vào thùng rác?',
            text: 'Hóa đơn sẽ được chuyển vào thùng rác. Bạn có thể khôi phục lại sau.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Chuyển vào thùng rác',
            cancelButtonText: 'Hủy',
        });
        if (!result.isConfirmed) return;
        try {
            const response = await fetch('/api/invoices', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (response.ok) {
                setInvoices(invoices.filter((inv) => inv.id !== id));
                toast.success('Đã chuyển hóa đơn vào thùng rác');
            } else {
                toast.error('Lỗi khi xóa hóa đơn');
            }
        } catch (error) {
            console.error('Lỗi khi xóa hóa đơn:', error);
            toast.error('Lỗi khi xóa hóa đơn');
        }
    };

    const handleExportExcel = () => {
        if (filteredInvoices.length === 0) { toast.error('Không có dữ liệu để xuất'); return; }
        const headers = ['Mã HD', 'Phòng', 'Khách hàng', 'Thời gian', 'Tổng tiền (VNĐ)'];
        const csvData = filteredInvoices.map(inv => [
            `#${inv.id.substring(0, 8).toUpperCase()}`,
            `Phòng ${inv.roomNumber}`,
            inv.customerName || 'Khách lẻ',
            new Date(inv.createdAt).toLocaleString('vi-VN'),
            Math.ceil(inv.totalPrice / 1000) * 1000,
        ]);
        const csvContent = [headers.join(','), ...csvData.map(e => e.join(','))].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `lich-su-hoa-don-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ── Topbar ── */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
                    <Link href="/dashboard">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 gap-1.5 rounded-lg"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Quay lại
                        </Button>
                    </Link>
                    <div className="h-5 w-px bg-slate-200" />
                    <h1 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                        <History className="w-4 h-4 text-blue-500" />
                        Lịch sử hóa đơn
                    </h1>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

                {/* ── Bộ lọc ── */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">

                        {/* Chi nhánh */}
                        <div className={`w-full ${(user?.role !== 'admin' || (user?.storeId && user.storeId !== 'all')) ? 'hidden' : ''}`}>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                <BuildingStorefront className="w-3.5 h-3.5" /> Chi nhánh
                            </label>
                            <select
                                value={selectedStoreId}
                                onChange={(e) => { setSelectedStoreId(e.target.value); fetchInvoices(e.target.value); }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                            >
                                <option value="">Tất cả chi nhánh</option>
                                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        {/* Từ ngày */}
                        <div className="w-full">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                <Calendar className="w-3.5 h-3.5" /> Từ ngày
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="pl-9 bg-slate-50 border-slate-200 rounded-xl h-10 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Đến ngày */}
                        <div className="w-full">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                <Calendar className="w-3.5 h-3.5" /> Đến ngày
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="pl-9 bg-slate-50 border-slate-200 rounded-xl h-10 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Tìm kiếm */}
                        <div className="w-full">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                <Search className="w-3.5 h-3.5" /> Tìm kiếm
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                                <Input
                                    placeholder="Mã HD hoặc tên khách..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-slate-50 border-slate-200 rounded-xl h-10 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Nút xuất + xóa lọc */}
                        <div className="flex items-end gap-2">
                            <Button
                                onClick={handleExportExcel}
                                className="flex-1 h-10 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl gap-2 shadow-sm transition"
                            >
                                <Download className="w-4 h-4" /> Xuất Excel
                            </Button>
                            {(startDate || endDate || searchTerm) && (
                                <Button
                                    variant="ghost"
                                    onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); }}
                                    className="h-10 px-3 border border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Biểu đồ ── */}
                {isMounted && chartData.length > 0 && (
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-5">
                            <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-blue-500" />
                            </span>
                            Lượt khách theo ngày
                        </h2>
                        <div style={{ width: '100%', height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barSize={28}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 13 }}
                                    />
                                    <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Số lượt khách" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ── Bảng hóa đơn ── */}
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
                            <Receipt className="w-8 h-8 animate-pulse text-slate-300" />
                            <span className="text-sm">Đang tải dữ liệu...</span>
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
                            <Receipt className="w-8 h-8 text-slate-200" />
                            <span className="text-sm">Không tìm thấy hóa đơn nào</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-5 py-3.5 text-left">
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                                <Hash className="w-3.5 h-3.5" /> Mã HD
                                            </span>
                                        </th>
                                        <th className="px-5 py-3.5 text-left">
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                                <DoorOpen className="w-3.5 h-3.5" /> Phòng
                                            </span>
                                        </th>
                                        <th className="px-5 py-3.5 text-left">
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                                <Clock className="w-3.5 h-3.5" /> Thời gian
                                            </span>
                                        </th>
                                        <th className="px-5 py-3.5 text-left">
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                                <Coins className="w-3.5 h-3.5" /> Tổng tiền
                                            </span>
                                        </th>
                                        <th className="px-5 py-3.5 text-left">
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                                <User className="w-3.5 h-3.5" /> Khách hàng
                                            </span>
                                        </th>
                                        <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                            Thao tác
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.map((inv) => (
                                        <tr
                                            key={inv.id}
                                            className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                                        >
                                            {/* Mã HD */}
                                            <td className="px-5 py-3.5">
                                                <span className="flex items-center gap-1.5 font-mono text-xs font-medium text-slate-500">
                                                    <Receipt className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
                                                    #{inv.id.substring(0, 8).toUpperCase()}
                                                </span>
                                            </td>

                                            {/* Phòng */}
                                            <td className="px-5 py-3.5">
                                                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                                    <DoorOpen className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                    Phòng {inv.roomNumber}
                                                </span>
                                            </td>

                                            {/* Thời gian */}
                                            <td className="px-5 py-3.5">
                                                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                                                    <Clock className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                                                    {new Date(inv.createdAt).toLocaleString('vi-VN')}
                                                </span>
                                            </td>

                                            {/* Tổng tiền */}
                                            <td className="px-5 py-3.5">
                                                <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                                                    <Coins className="w-3.5 h-3.5 flex-shrink-0" />
                                                    {(Math.ceil(inv.totalPrice / 1000) * 1000).toLocaleString('vi-VN')}đ
                                                </span>
                                            </td>

                                            {/* Khách hàng */}
                                            <td className="px-5 py-3.5">
                                                {inv.customerName === 'Khách lẻ' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                                        <User className="w-3 h-3" />
                                                        {inv.customerName}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                                                        <UserCircle className="w-3 h-3" />
                                                        {inv.customerName}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Thao tác */}
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <Link href={`/dashboard/invoice/${inv.id}`}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-3 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg gap-1.5 transition"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" /> Xem
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-3 text-xs text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-lg gap-1.5 transition"
                                                        onClick={() => handleDeleteInvoice(inv.id)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Xóa
                                                    </Button>
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
        </div>
    );
}