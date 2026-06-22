'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { useAuth } from '@/app/context';
import { Store } from '@/lib/db';
import { History, Search, Eye, ArrowLeft, Calendar, X, Download, Trash2, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

interface DisplayInvoice {
    id: string;
    totalPrice: number;
    createdAt: string | Date;
    roomNumber: string;
    status?: string;
    customerName?: string;
}

const INVOICE_ICON_COLORS = [
    { bg: 'bg-green-100', text: 'text-green-600' },
    { bg: 'bg-blue-100', text: 'text-blue-600' },
    { bg: 'bg-purple-100', text: 'text-purple-600' },
    { bg: 'bg-yellow-100', text: 'text-yellow-600' },
    { bg: 'bg-red-100', text: 'text-red-500' },
    { bg: 'bg-pink-100', text: 'text-pink-500' },
];

function getIconColor(id: string) {
    const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return INVOICE_ICON_COLORS[sum % INVOICE_ICON_COLORS.length];
}

function CustomerBadge({ name }: { name: string }) {
    if (!name || name === 'Khách lẻ') {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                Khách lẻ
            </span>
        );
    }
    if (name.startsWith('Khách tặng')) {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                {name}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            {name}
        </span>
    );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

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
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

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
        const matchSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

    const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
    const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleDeleteInvoice = async (id: string) => {
        const result = await Swal.fire({
            title: 'Chuyển vào thùng rác?',
            text: 'Hóa đơn sẽ được chuyển vào thùng rác. Bạn có thể khôi phục lại bất cứ lúc nào.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
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
                setInvoices(prev => prev.filter(inv => inv.id !== id));
                toast.success('Đã chuyển hóa đơn vào thùng rác', {
                    description: 'Vào Thùng rác để khôi phục nếu cần.',
                });
            } else {
                toast.error('Lỗi khi xóa hóa đơn');
            }
        } catch (error) {
            console.error('Lỗi khi xóa hóa đơn:', error);
            toast.error('Lỗi khi xóa hóa đơn');
        }
    };

    const handleDeleteAll = async () => {
        if (invoices.length === 0) return;
        const result = await Swal.fire({
            title: 'Chuyển tất cả vào thùng rác?',
            text: 'Tất cả hóa đơn sẽ được chuyển vào thùng rác. Bạn có thể khôi phục lại sau.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Chuyển tất cả',
            cancelButtonText: 'Hủy',
        });
        if (!result.isConfirmed) return;
        try {
            const response = await fetch('/api/invoices', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true, storeId: selectedStoreId }),
            });
            if (response.ok) {
                setInvoices([]);
                toast.success('Đã chuyển tất cả hóa đơn vào thùng rác');
            } else {
                toast.error('Lỗi khi xóa hóa đơn');
            }
        } catch (error) {
            console.error('Lỗi khi xóa hóa đơn:', error);
            toast.error('Lỗi kết nối máy chủ');
        }
    };

    const handleExportExcel = () => {
        if (filteredInvoices.length === 0) {
            toast.error('Không có dữ liệu để xuất');
            return;
        }
        const headers = ['Mã HD', 'Phòng', 'Khách hàng', 'Thời gian', 'Tổng tiền (VNĐ)'];
        const csvData = filteredInvoices.map(inv => [
            `#${inv.id.substring(0, 8).toUpperCase()}`,
            `Phòng ${inv.roomNumber}`,
            inv.customerName || 'Khách lẻ',
            new Date(inv.createdAt).toLocaleString('vi-VN'),
            Math.ceil(inv.totalPrice / 1000) * 1000
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

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    const rangeStart = filteredInvoices.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const rangeEnd = Math.min(currentPage * pageSize, filteredInvoices.length);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="sm" className="text-slate-600 hover:bg-slate-100">
                                <ArrowLeft className="w-4 h-4 mr-1.5" /> Quay lại
                            </Button>
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <History className="w-5 h-5 text-blue-600" /> Lịch sử hóa đơn
                            </h1>
                            <span className="text-xs text-slate-400 ml-7">Tra cứu và quản lý hóa đơn dễ dàng</span>
                        </div>
                    </div>
                    <Button
                        onClick={handleExportExcel}
                        className="bg-green-700 hover:bg-green-800 text-white font-semibold gap-2 rounded-lg shadow-sm"
                    >
                        <Download className="w-4 h-4" /> Xuất Excel
                    </Button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Filter Card */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        {/* Chi nhánh - admin only */}
                        <div className={user?.role !== 'admin' ? 'hidden' : ''}>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Chi nhánh</label>
                            <select
                                value={selectedStoreId}
                                onChange={(e) => { setSelectedStoreId(e.target.value); fetchInvoices(e.target.value); }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-10"
                            >
                                <option value="">Tất cả chi nhánh</option>
                                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        {/* Từ ngày */}
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Từ ngày</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                                    className="pl-9 bg-white border-slate-200 shadow-sm h-10 text-sm"
                                />
                            </div>
                        </div>

                        {/* Đến ngày */}
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Đến ngày</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                                    className="pl-9 bg-white border-slate-200 shadow-sm h-10 text-sm"
                                />
                            </div>
                        </div>

                        {/* Tìm kiếm */}
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Tìm kiếm</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <Input
                                        placeholder="Mã HD hoặc tên khách hàng..."
                                        value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                        className="pl-9 bg-white border-slate-200 shadow-sm h-10 text-sm"
                                    />
                                </div>
                                {(startDate || endDate || searchTerm) && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); setCurrentPage(1); }}
                                        className="text-slate-400 hover:text-rose-500 h-10 px-3 border border-slate-200 rounded-lg hover:bg-rose-50"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table header row */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                        <FileText className="w-4 h-4 text-blue-500" />
                        Danh sách hóa đơn
                    </div>
                    {invoices.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDeleteAll}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-amber-200 gap-1.5 text-xs font-medium rounded-lg"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Xóa tất cả
                        </Button>
                    )}
                </div>

                {/* Table */}
                <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
                    {isLoading ? (
                        <div className="p-16 text-center text-slate-400 text-sm">Đang tải dữ liệu...</div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="p-16 text-center text-slate-400 italic text-sm">Không tìm thấy hóa đơn nào</div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="w-12 px-4 py-3"></th>
                                            <th className="px-4 py-3 text-left">
                                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none">
                                                    Mã hóa đơn <ChevronsUpDown className="w-3 h-3 opacity-50" />
                                                </span>
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none">
                                                    Phòng <ChevronsUpDown className="w-3 h-3 opacity-50" />
                                                </span>
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none">
                                                    Thời gian <ChevronsUpDown className="w-3 h-3 opacity-50" />
                                                </span>
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none">
                                                    Tổng tiền <ChevronsUpDown className="w-3 h-3 opacity-50" />
                                                </span>
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none">
                                                    Khách hàng <ChevronsUpDown className="w-3 h-3 opacity-50" />
                                                </span>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {paginatedInvoices.map((inv) => {
                                            const color = getIconColor(inv.id);
                                            return (
                                                <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color.bg}`}>
                                                            <FileText className={`w-4 h-4 ${color.text}`} />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                                        #{inv.id.substring(0, 8).toUpperCase()}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                                                        Phòng {inv.roomNumber}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-500">
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center">
                                                                <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                                                            </span>
                                                            {new Date(inv.createdAt).toLocaleString('vi-VN')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-bold text-blue-600">
                                                        {inv.totalPrice === 0
                                                            ? '0đ'
                                                            : `${(Math.ceil(inv.totalPrice / 1000) * 1000).toLocaleString('vi-VN')}đ`}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <CustomerBadge name={inv.customerName || 'Khách lẻ'} />
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <Link href={`/dashboard/invoice/${inv.id}`}>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 gap-1 text-xs h-8 px-3 rounded-lg"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" /> Xem
                                                                </Button>
                                                            </Link>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 gap-1 text-xs h-8 px-3 rounded-lg"
                                                                onClick={() => handleDeleteInvoice(inv.id)}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" /> Xóa
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    Hiển thị
                                    <select
                                        value={pageSize}
                                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                        className="border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-700 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                                    >
                                        {PAGE_SIZE_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                    trên mỗi trang
                                </div>

                                <span className="text-sm text-slate-500">
                                    {rangeStart}-{rangeEnd} trên {filteredInvoices.length} hóa đơn
                                </span>

                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-8 h-8 p-0 border border-slate-200 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                        onClick={() => handlePageChange(1)}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronsLeft className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-8 h-8 p-0 border border-slate-200 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </Button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                        .reduce<(number | '...')[]>((acc, p, i, arr) => {
                                            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((p, i) =>
                                            p === '...' ? (
                                                <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-sm">…</span>
                                            ) : (
                                                <Button
                                                    key={p}
                                                    variant="ghost"
                                                    size="sm"
                                                    className={`w-8 h-8 p-0 border rounded-md text-sm font-medium ${
                                                        currentPage === p
                                                            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                                            : 'border-slate-200 text-slate-600 hover:text-slate-900'
                                                    }`}
                                                    onClick={() => handlePageChange(p as number)}
                                                >
                                                    {p}
                                                </Button>
                                            )
                                        )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-8 h-8 p-0 border border-slate-200 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-8 h-8 p-0 border border-slate-200 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                        onClick={() => handlePageChange(totalPages)}
                                        disabled={currentPage === totalPages}
                                    >
                                        <ChevronsRight className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}