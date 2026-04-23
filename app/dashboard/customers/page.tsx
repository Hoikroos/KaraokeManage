'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useAuth } from '@/app/context';
import { Store } from '@/lib/db';
import { Search, ArrowLeft, Calendar, BarChart3, Users, Wallet, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DisplayInvoice {
    id: string;
    totalPrice: number;
    createdAt: string | Date;
    customerName?: string;
}

export default function CustomersPage() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<DisplayInvoice[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportType, setReportType] = useState<'custom' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('custom');
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => { setIsMounted(true); }, []);
    useEffect(() => { if (user !== undefined) fetchInitialData(); }, [user]);

    const fetchInitialData = async () => {
        try {
            const storesRes = await fetch('/api/admin/stores');
            let storesData = (await storesRes.json()) || [];
            if (user?.role !== 'admin' && user?.storeId) {
                storesData = storesData.filter((s: Store) => s.id === user.storeId);
            }
            setStores(storesData);
            const initialStoreId = user?.storeId || (storesData.length > 0 ? storesData[0].id : '');
            setSelectedStoreId(initialStoreId);
            await fetchInvoices(initialStoreId);
        } catch (error) { console.error(error); await fetchInvoices(''); }
    };

    const fetchInvoices = async (storeId: string) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (storeId && storeId !== 'all') params.append('storeId', storeId);
            params.append('t', Date.now().toString()); // Tránh lấy dữ liệu cũ từ cache
            const res = await fetch(`/api/invoices?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json();
            const rawInvoices = Array.isArray(data) ? data : (data?.invoices || data?.data || []);
            setInvoices(rawInvoices.map((inv: any) => ({
                id: String(inv.id || inv.Id || ''),
                totalPrice: Number(inv.totalPrice || inv.TotalPrice || 0),
                createdAt: inv.createdAt || inv.CreatedAt,
                customerName: inv.customerName || inv.CustomerName || 'Khách lẻ',
            })));
        } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };

    // Tự động cập nhật ngày khi chọn bộ lọc nhanh
    useEffect(() => {
        const now = new Date();
        const formatDate = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        if (reportType === 'daily') {
            setStartDate(formatDate(now));
            setEndDate(formatDate(now));
        } else if (reportType === 'weekly') {
            const first = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1);
            const firstDay = new Date(now.setDate(first));
            setStartDate(formatDate(firstDay));
            setEndDate(formatDate(new Date()));
        } else if (reportType === 'monthly') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            setStartDate(formatDate(firstDay));
            setEndDate(formatDate(new Date()));
        } else if (reportType === 'yearly') {
            setStartDate(`${now.getFullYear()}-01-01`);
            setEndDate(formatDate(new Date()));
        }
    }, [reportType]);

    const filteredInvoices = useMemo(() => invoices.filter(inv => {
        const matchSearch = (inv.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchSearch) return false;
        if (startDate || endDate) {
            const invDate = new Date(inv.createdAt);
            if (startDate && invDate < new Date(startDate)) return false;
            if (endDate && invDate > new Date(new Date(endDate).setHours(23, 59, 59))) return false;
        }
        return true;
    }), [invoices, searchTerm, startDate, endDate]);

    const customerStats = useMemo(() => {
        const groups: { [key: string]: { count: number; total: number } } = {};
        filteredInvoices.forEach(inv => {
            const name = inv.customerName?.trim() || 'Khách lẻ';
            if (!groups[name]) groups[name] = { count: 0, total: 0 };
            groups[name].count += 1;
            groups[name].total += inv.totalPrice;
        });
        return Object.entries(groups).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total);
    }, [filteredInvoices]);

    // Top khách hàng theo lượt đến
    const topVisitors = useMemo(() => {
        return [...customerStats].sort((a, b) => b.count - a.count).slice(0, 10);
    }, [customerStats]);

    const totalSpendingAll = filteredInvoices.reduce((sum, inv) => sum + inv.totalPrice, 0);
    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    if (!isMounted || isLoading) return <div className="p-12 text-center text-slate-400">Đang tải phân tích...</div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/invoice"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" /> Quay lại hóa đơn</Button></Link>
                        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> Khách Hàng</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8 items-end">
                    <div className={`md:col-span-3 ${user?.role !== 'admin' ? 'hidden' : ''}`}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Chi nhánh</label>
                        <select value={selectedStoreId} onChange={(e) => { setSelectedStoreId(e.target.value); fetchInvoices(e.target.value); }} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-3 flex bg-white p-1 rounded-xl border border-slate-200 h-10">
                        {[
                            { id: 'daily', label: 'Ngày' },
                            { id: 'weekly', label: 'Tuần' },
                            { id: 'monthly', label: 'Tháng' },
                            { id: 'yearly', label: 'Năm' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setReportType(type.id as any)}
                                className={`flex-1 rounded-lg text-xs font-bold transition-all ${reportType === type.id ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                    <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Từ ngày</label><Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setReportType('custom'); }} /></div>
                    <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Đến ngày</label><Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setReportType('custom'); }} /></div>
                    <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Tìm khách</label><Input placeholder="Tên khách hàng..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 p-6 border-none shadow-sm rounded-2xl">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-600" /> Top chi tiêu</h2>
                        <div style={{ width: '100%', height: 400 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={customerStats.slice(0, 10)} layout="vertical" margin={{ left: 40, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} width={120} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none' }} formatter={(v: any) => [v.toLocaleString('vi-VN') + 'đ', 'Chi tiêu']} />
                                    <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={25}>
                                        {customerStats.slice(0, 10).map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card className="p-6 border-none shadow-sm rounded-2xl">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-600" /> Tổng hợp</h2>
                        <div className="space-y-4">
                            <div className="bg-indigo-50 rounded-2xl p-4 flex justify-between items-center">
                                <p className="text-xs font-bold text-indigo-600 uppercase">Doanh thu lọc</p>
                                <p className="text-xl font-black text-indigo-700">{totalSpendingAll.toLocaleString('vi-VN')}đ</p>
                            </div>
                            <div className="bg-emerald-50 rounded-2xl p-4 flex justify-between items-center">
                                <p className="text-xs font-bold text-emerald-600 uppercase">Tổng lượt khách</p>
                                <p className="text-xl font-black text-emerald-700">{filteredInvoices.length}</p>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center">
                                <p className="text-xs font-bold text-slate-400 uppercase">Khách định danh</p>
                                <p className="text-xl font-black text-slate-600">{customerStats.filter(c => c.name !== 'Khách lẻ').length}</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="lg:col-span-2 p-6 border-none shadow-sm rounded-2xl">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">Xếp hạng chi tiết</h2>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {customerStats.filter(c => c.name !== 'Khách lẻ').map((c, i) => {
                                const percent = totalSpendingAll > 0 ? Math.round((c.total / totalSpendingAll) * 100) : 0;
                                return (
                                    <div key={c.name} className="group p-3 hover:bg-slate-50 rounded-xl transition-all">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-black text-slate-300 w-4">{i + 1}.</span>
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                                                    {c.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{c.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-black text-indigo-600">{c.total.toLocaleString('vi-VN')}đ</div>
                                                <div className="text-[10px] font-bold text-emerald-500 uppercase">{c.count} lượt đến</div>
                                            </div>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden ml-11">
                                            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
