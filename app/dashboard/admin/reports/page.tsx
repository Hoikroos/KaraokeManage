'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { Invoice, Store } from '@/lib/db';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { TrendingUp, Receipt, LayoutDashboard, Filter, MonitorPlay, Trash2, Calendar, Search, Download, X } from 'lucide-react';

export default function ReportsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch stores
      const storesRes = await fetch('/api/admin/stores');
      const storesData = await storesRes.json();
      setStores(storesData);
      if (storesData.length > 0) {
        setSelectedStoreId(storesData[0].id);
        fetchInvoices(storesData[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvoices = useCallback(async (storeId: string) => {
    if (!storeId) return;
    try {
      const response = await fetch(`/api/invoices?storeId=${storeId}`);
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  }, []);

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    fetchInvoices(storeId);
  };

  const handleDeleteInvoice = async (id: string) => {
    const result = await Swal.fire({
      title: 'Xóa hóa đơn?',
      text: 'Bạn chắc chắn muốn xóa hóa đơn này? Hành động này không thể hoàn tác.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    try {
      // Thay đổi cách gửi ID từ query string sang Request Body để đồng bộ với các API khác trong dự án
      const response = await fetch('/api/invoices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, permanent: true }),
      });

      if (response.ok) {
        setInvoices(invoices.filter((inv) => inv.id !== id));
        toast.success('Xóa hóa đơn thành công');
      } else {
        toast.error('Lỗi khi xóa hóa đơn');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Lỗi khi xóa hóa đơn');
    }
  };

  const handleDeleteAll = async () => {
    if (invoices.length === 0) return;

    const result = await Swal.fire({
      title: 'Xóa vĩnh viễn tất cả?',
      text: 'Toàn bộ hóa đơn của chi nhánh này sẽ bị xóa vĩnh viễn và KHÔNG thể khôi phục. Bạn chắc chắn muốn thực hiện?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Đồng ý xóa vĩnh viễn',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    try {
      const response = await fetch('/api/invoices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          all: true, 
          storeId: selectedStoreId,
          permanent: true
        }),
      });

      if (response.ok) {
        setInvoices([]);
        toast.success('Đã xóa vĩnh viễn toàn bộ hóa đơn');
      } else {
        toast.error('Lỗi khi xóa hóa đơn');
      }
    } catch (error) {
      console.error('Error deleting all invoices:', error);
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  // Logic lọc hóa đơn
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Lọc theo mã hóa đơn
      const invId = (inv.id || (inv as any).Id || '').toLowerCase();
      const matchSearch = invId.includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      // Lọc theo khoảng ngày
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
    });
  }, [invoices, searchTerm, startDate, endDate]);

  const exportToExcel = () => {
    if (filteredInvoices.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    const headers = ['Mã HD', 'Phòng', 'Thời gian', 'Tổng tiền (VNĐ)', 'Trạng thái'];
    const csvData = filteredInvoices.map(inv => [
      `#${inv.id.substring(0, 8).toUpperCase()}`,
      `Phòng ${(inv as any).roomNumber || ''}`,
      new Date(inv.createdAt).toLocaleString('vi-VN'),
      inv.totalPrice,
      inv.status === 'paid' ? 'Đã thanh toán' : 'Chờ'
    ]);

    const csvContent = [headers.join(','), ...csvData.map(e => e.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bao-cao-doanh-thu-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Xử lý dữ liệu biểu đồ
  const chartData = useMemo(() => {
    const groups: { [key: string]: { total: number; count: number } } = {};

    filteredInvoices.forEach(inv => {
      if (inv.status !== 'paid') return;

      const date = new Date(inv.createdAt);
      let key = '';

      if (reportType === 'daily') {
        key = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      } else if (reportType === 'weekly') {
        const oneJan = new Date(date.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
        key = `Tuần ${weekNum}`;
      } else if (reportType === 'monthly') {
        key = `Tháng ${date.getMonth() + 1}`;
      } else if (reportType === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `Quý ${quarter}`;
      } else if (reportType === 'yearly') {
        key = `Năm ${date.getFullYear()}`;
      }

      if (!groups[key]) {
        groups[key] = { total: 0, count: 0 };
      }
      groups[key].total += inv.totalPrice;
      groups[key].count += 1;
    });

    return Object.entries(groups).map(([name, data]) => ({ name, total: data.total, count: data.count }));
  }, [filteredInvoices, reportType]);

  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.totalPrice, 0);
  const paidRevenue = filteredInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.totalPrice, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-blue-600">
                ← Quay lại
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-slate-900">Hóa đơn & Thống kê</h1>
          </div>
          <div className="flex items-center gap-2">
            {invoices.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteAll}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-100 gap-2 font-bold"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Xóa tất cả</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Store Selection */}
        <div className="mb-8">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
            <Filter className="w-3 h-3" /> Chọn chi nhánh
            </div>
          </h2>
          <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            {stores.map((store) => (
              <button
                key={store.id}
                onClick={() => handleStoreChange(store.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedStoreId === store.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {store.name}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 items-end">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Từ ngày</label>
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Đến ngày</label>
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
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Tìm kiếm ID</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Mã hóa đơn..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={exportToExcel}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-2"
            >
              <Download className="w-4 h-4" /> Xuất Excel
            </Button>
            {(startDate || endDate || searchTerm) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSearchTerm('');
                }}
                className="h-11 px-3 text-slate-400 hover:text-rose-500 rounded-xl"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Statistics */}
        {selectedStore && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 border-none shadow-sm bg-white flex items-center gap-4">
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase">Tổng doanh thu</p>
                <h3 className="text-2xl font-black text-slate-900">{totalRevenue.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</h3>
              </div>
            </Card>

            <Card className="p-6 border-none shadow-sm bg-white flex items-center gap-4">
              <div className="bg-green-50 p-4 rounded-2xl text-green-600">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase">Đã thanh toán</p>
                <h3 className="text-2xl font-black text-green-600">{paidRevenue.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</h3>
              </div>
            </Card>

            <Card className="p-6 border-none shadow-sm bg-white flex items-center gap-4">
              <div className="bg-orange-50 p-4 rounded-2xl text-orange-600">
                <MonitorPlay className="w-6 h-6" />
              </div>
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase">Lượt thuê (Phòng bán)</p>
                <h3 className="text-2xl font-black text-slate-900">{filteredInvoices.filter(i => i.status === 'paid').length}</h3>
              </div>
            </Card>

            <Card className="p-6 border-none shadow-sm bg-white flex items-center gap-4">
              <div className="bg-purple-50 p-4 rounded-2xl text-purple-600">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase">Tổng hóa đơn</p>
                <h3 className="text-2xl font-black text-slate-900">{filteredInvoices.length}</h3>
              </div>
            </Card>
          </div>
        )}

        {/* Revenue Charts */}
        <Card className="bg-white border-none shadow-sm p-6 mb-8 rounded-2xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800">Biểu đồ doanh thu</h2>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'daily', label: 'Ngày' },
                { id: 'weekly', label: 'Tuần' },
                { id: 'monthly', label: 'Tháng' },
                { id: 'quarterly', label: 'Quý' },
                { id: 'yearly', label: 'Năm' }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => setReportType(type.id as any)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${reportType === type.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000000).toLocaleString()} Triệu`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#f59e0b', fontSize: 12 }}
                  tickFormatter={(value) => `${value} lượt`}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'total') return [new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value) + ' VNĐ', 'Doanh thu'];
                    if (name === 'count') return [value + ' lượt', 'Số lượt thuê'];
                    return [value, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                <Line yAxisId="right" type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Invoices Table */}
        <Card className="bg-white border-none shadow-sm overflow-hidden rounded-2xl">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              Danh sách hóa đơn - {selectedStore?.name}
            </h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400">Đang tải...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400">Chưa có hóa đơn nào</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Phòng
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Thời gian
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Tổng tiền
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-slate-700">
                        #{invoice.id.substring(0, 6)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">
                        Phòng {(invoice as any).roomNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {new Date(invoice.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {invoice.totalPrice.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} VNĐ
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${invoice.status === 'paid'
                            ? 'bg-green-50 text-green-600'
                            : 'bg-orange-50 text-orange-600'
                            }`}
                        >
                          {invoice.status === 'paid' ? 'Đã thanh toán' : 'Chờ'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <Link href={`/dashboard/invoice/${invoice.id}`}>
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50 font-bold text-xs">Chi tiết</Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:bg-rose-50 transition-colors"
                          onClick={() => handleDeleteInvoice(invoice.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
