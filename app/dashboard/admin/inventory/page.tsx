'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
    Package, TrendingUp, TrendingDown, ArrowLeft, Calendar, X,
    AlertTriangle, Search, Boxes, Download, History
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function InventoryStatsPage() {
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
    const [stats, setStats] = useState<ProductStat[]>([]);
    const [logs, setLogs] = useState<InventoryLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'sales' | 'history'>('sales');

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const res = await fetch('/api/admin/stores');
                const data = await res.json();
                setStores(data);
                if (data.length > 0) {
                    setSelectedStoreId(data[0].id);
                }
            } catch (error) {
                console.error('Error fetching stores:', error);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedStoreId) {
            fetchInventoryStats();
        }
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
                const statsData = Array.isArray(data.stats) ? data.stats : [];
                setStats(statsData);
                setLogs(Array.isArray(data.logs) ? data.logs : []);
            } else {
                setStats([]);
                setLogs([]);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
            toast.error('Lỗi khi tải dữ liệu thống kê kho');
        } finally {
            setIsLoading(false);
        }
    };

    const bestSellers = useMemo(() =>
        [...stats].sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5),
        [stats]);

    const slowMoving = useMemo(() =>
        [...stats].sort((a, b) => a.totalQuantity - b.totalQuantity).slice(0, 5),
        [stats]);

    const lowStockProducts = useMemo(() =>
        stats.filter(s => s.currentStock <= 5), [stats]);

    const categoryData = useMemo(() => {
        const groups: { [key: string]: number } = {};
        stats.forEach(s => {
            groups[s.category] = (groups[s.category] || 0) + s.totalQuantity;
        });
        return Object.entries(groups).map(([name, value]) => ({
            name: name === 'food' ? 'Đồ ăn'
                : name === 'drink' ? 'Đồ uống'
                    : name === 'dry' ? 'Đồ khô'
                        : name === 'fruit' ? 'Trái cây'
                            : 'Khác',
            value
        }));
    }, [stats]);

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

    const exportToExcel = () => {
        const isHistory = activeTab === 'history';
        const dataToExport = isHistory ? logs : stats;
        if (dataToExport.length === 0) {
            toast.error('Không có dữ liệu để xuất');
            return;
        }

        const headers = isHistory
            ? ['Ngày nhập', 'Sản phẩm', 'Số lượng nhập thêm']
            : ['Sản phẩm', 'Loại', 'Tồn đầu', 'Đã nhập', 'Đã bán', 'Doanh thu', 'Tồn kho hiện tại'];

        const csvData = isHistory
            ? logs.map(l => [new Date(l.createdAt).toLocaleString('vi-VN'), l.productName, l.quantity])
            : stats.map(s => [s.productName, s.category, s.openingStock, s.totalRestocked, s.totalQuantity, s.totalRevenue, s.currentStock]);

        const csvContent = [headers.join(','), ...csvData.map(e => e.join(','))].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `bao-cao-kho-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`);
        link.click();
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/admin">
                            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-emerald-600 font-bold">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
                            </Button>
                        </Link>
                        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                            <Boxes className="w-6 h-6 text-emerald-600" /> Báo cáo Kho hàng
                        </h1>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8 items-end">
                    <div className="md:col-span-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Chi nhánh</label>
                        <div className="flex flex-wrap gap-2">
                            {stores.map(store => (
                                <button
                                    key={store.id}
                                    onClick={() => setSelectedStoreId(store.id)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedStoreId === store.id ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {store.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-5 grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Từ ngày</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="pl-10 h-11 bg-white border-slate-200 rounded-xl"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Đến ngày</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="pl-10 h-11 bg-white border-slate-200 rounded-xl"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3 flex bg-white p-1 rounded-xl border border-slate-200 h-11">
                        {[
                            { id: 'daily', label: 'Ngày' },
                            { id: 'weekly', label: 'Tuần' },
                            { id: 'monthly', label: 'Tháng' },
                            { id: 'yearly', label: 'Năm' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setReportType(type.id as any)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${reportType === type.id ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 mb-6">
                    <button
                        onClick={() => setActiveTab('sales')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'sales' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                    >
                        <TrendingUp className="w-4 h-4" /> Tổng quan tồn kho & bán hàng
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                    >
                        <History className="w-4 h-4" /> Lịch sử nhập hàng thêm
                    </button>
                    <div className="flex-1" />
                    <Button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-bold h-12 px-6 gap-2">
                        <Download className="w-4 h-4" /> Xuất File báo cáo
                    </Button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="p-6 border-none shadow-sm bg-white flex items-center gap-4 rounded-2xl ring-1 ring-slate-200">
                        <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Bán chạy nhất</p>
                            <h3 className="text-lg font-black text-slate-900 truncate max-w-[150px]">{bestSellers[0]?.productName || '---'}</h3>
                            <p className="text-xs text-blue-600 font-bold">Số lượng: {bestSellers[0]?.totalQuantity || 0}</p>
                        </div>
                    </Card>

                    <Card className="p-6 border-none shadow-sm bg-white flex items-center gap-4 rounded-2xl ring-1 ring-slate-200">
                        <div className="bg-rose-50 p-4 rounded-2xl text-rose-600">
                            <TrendingDown className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Bán chậm nhất</p>
                            <h3 className="text-lg font-black text-slate-900 truncate max-w-[150px]">{slowMoving[0]?.productName || '---'}</h3>
                            <p className="text-xs text-rose-600 font-bold">Số lượng: {slowMoving[0]?.totalQuantity || 0}</p>
                        </div>
                    </Card>

                    <Card
                        onClick={() => setIsWarningModalOpen(true)}
                        className="p-6 border-none shadow-sm bg-white flex items-center gap-4 rounded-2xl ring-1 ring-slate-200 cursor-pointer hover:bg-amber-50/50 transition-all active:scale-95 shadow-amber-100/20"
                    >
                        <div className="bg-amber-50 p-4 rounded-2xl text-amber-600">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Cảnh báo kho</p>
                            <h3 className="text-lg font-black text-slate-900">{lowStockProducts.length} mặt hàng</h3>
                            <p className="text-xs text-amber-600 font-bold">Tồn kho dưới 5 đơn vị</p>
                        </div>
                    </Card>
                </div>

                {activeTab === 'sales' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {/* Chart Bán chạy */}
                        <Card className="p-6 border-none shadow-sm bg-white rounded-2xl ring-1 ring-slate-200">
                            <div className="flex items-center gap-2 mb-6">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                                <h2 className="text-lg font-bold text-slate-800">Top 5 sản phẩm bán chạy</h2>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={bestSellers} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="productName" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="totalQuantity" fill="#10b981" radius={[0, 4, 4, 0]} barSize={25} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Chart Tỉ lệ theo loại */}
                        <Card className="p-6 border-none shadow-sm bg-white rounded-2xl ring-1 ring-slate-200">
                            <div className="flex items-center gap-2 mb-6">
                                <Package className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-lg font-bold text-slate-800">Tiêu thụ theo danh mục</h2>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categoryData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {categoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                ) : null}

                {/* Detailed Table */}
                <Card className="bg-white border-none shadow-sm overflow-hidden rounded-2xl ring-1 ring-slate-200">
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h2 className="text-lg font-bold text-slate-800">{activeTab === 'sales' ? 'Chi tiết sản lượng bán hàng' : 'Chi tiết các đợt nhập kho'}</h2>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Tìm sản phẩm..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-10 rounded-xl bg-slate-50 border-none"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        {activeTab === 'sales' ? (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Sản phẩm</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Loại</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Tồn đầu</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Nhập ({reportType})</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Đã bán ({reportType})</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">Doanh thu</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Tồn hiện tại</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stats.filter(s => s.productName.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                                        <tr key={item.productId} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.productName}</td>
                                            <td className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black">{item.category}</td>
                                            <td className="px-6 py-4 text-sm text-center font-bold text-slate-600">{item.openingStock}</td>
                                            <td className="px-6 py-4 text-sm text-center font-black text-blue-600">+{item.totalRestocked}</td>
                                            <td className="px-6 py-4 text-sm text-center font-black text-emerald-600">{item.totalQuantity}</td>
                                            <td className="px-6 py-4 text-sm text-right font-bold text-slate-700">{item.totalRevenue.toLocaleString()}đ</td>
                                            <td className="px-6 py-4 text-sm text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${item.currentStock > 5 ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    {item.currentStock}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {stats.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Không có dữ liệu thống kê cho giai đoạn này</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Thời gian nhập</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Sản phẩm</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Biến động</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Ghi chú lý do</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {logs.filter(l => l.productName.toLowerCase().includes(searchTerm.toLowerCase())).map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-500">{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{log.productName}</td>
                                            <td className={`px-6 py-4 text-sm text-center font-black ${log.quantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 italic">{log.note || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-center font-bold uppercase text-[10px]">
                                                {log.quantity >= 0 ? <span className="text-emerald-600">Nhập thêm</span> : <span className="text-rose-600">Xuất/Hư hỏng</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Chưa có lịch sử nhập kho cho kỳ này</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Card>
            </div>

            {/* Modal hiển thị danh sách sản phẩm sắp hết */}
            <Dialog open={isWarningModalOpen} onOpenChange={setIsWarningModalOpen}>
                <DialogContent className="max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600 font-black uppercase tracking-tight">
                            <AlertTriangle className="w-6 h-6" />
                            Sản phẩm sắp hết hàng
                        </DialogTitle>
                        <DialogDescription className="font-bold text-slate-500">
                            Các mặt hàng có số lượng tồn kho từ 5 đơn vị trở xuống.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[50vh] overflow-y-auto pr-2 divide-y divide-slate-100">
                        {lowStockProducts.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 italic">Hiện không có sản phẩm nào sắp hết</div>
                        ) : (
                            lowStockProducts.map((p) => (
                                <div key={p.productId} className="py-4 flex justify-between items-center group">
                                    <div>
                                        <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{p.productName}</div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.category}</div>
                                    </div>
                                    <div className="bg-rose-50 text-rose-600 px-4 py-1.5 rounded-xl font-black text-sm ring-1 ring-rose-100">
                                        Còn: {p.currentStock}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}