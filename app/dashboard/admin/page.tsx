'use client';

import { useAuth } from '@/app/context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { LayoutDashboard, LogOut, Receipt, TrendingUp, MonitorPlay, Building2, LayoutGrid, UserCircle, Boxes, BarChart3 } from 'lucide-react';
import { Invoice, Store } from '@/lib/db';
import { toast } from 'sonner';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const PERIOD_OPTIONS: { id: PeriodType; label: string }[] = [
  { id: 'daily', label: 'Ngày' },
  { id: 'weekly', label: 'Tuần' },
  { id: 'monthly', label: 'Tháng' },
  { id: 'quarterly', label: 'Quý' },
  { id: 'yearly', label: 'Năm' },
];

function getGroupKey(date: Date, period: PeriodType): string {
  if (period === 'daily') return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  if (period === 'weekly') {
    const oneJan = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil((Math.floor((date.getTime() - oneJan.getTime()) / 864e5) + oneJan.getDay() + 1) / 7);
    return `Tuần ${week}`;
  }
  if (period === 'monthly') return `T${date.getMonth() + 1}`;
  if (period === 'quarterly') return `Q${Math.floor(date.getMonth() / 3) + 1}`;
  return `${date.getFullYear()}`;
}

function fmtVND(n: number) {
  const rounded = Math.ceil(n / 1000) * 1000;
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(rounded);
}

function KpiCard({
  icon, iconBg, label, value, valueColor, sub,
}: {
  icon: React.ReactNode; iconBg: string;
  label: string; value: string; valueColor?: string; sub: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow duration-150">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-[17px] font-extrabold leading-tight truncate ${valueColor ?? 'text-slate-900'}`}>{value}</p>
        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{sub}</p>
      </div>
    </div>
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

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<PeriodType>('daily');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const menuItems = [
    {
      title: 'Báo cáo doanh thu',
      href: '/dashboard/admin',
      icon: <Receipt className="w-5 h-5" />,
      color: 'text-blue-600',
    },
    {
      title: 'Quản lý chi nhánh',
      href: '/dashboard/admin/stores',
      icon: <Building2 className="w-5 h-5" />,
      color: 'text-green-600',
    },
    {
      title: 'Quản lý phòng',
      href: '/dashboard/admin/rooms',
      icon: <LayoutGrid className="w-5 h-5" />,
      color: 'text-indigo-600',
    },
    {
      title: 'Nhân sự hệ thống',
      href: '/dashboard/admin/staff',
      icon: <UserCircle className="w-5 h-5" />,
      color: 'text-purple-600',
    },
    {
      title: 'Báo cáo kho hàng',
      href: '/dashboard/admin/inventory',
      icon: <Boxes className="w-5 h-5" />,
      color: 'text-teal-600',
    },
  ];

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

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => inv.status === 'paid');
  }, [invoices]);

  const chartData = useMemo(() => {
    const grouped: { [key: string]: { total: number; count: number } } = {};

    filteredInvoices.forEach(inv => {
      const date = new Date(inv.createdAt);
      const key = getGroupKey(date, reportType);
      if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
      grouped[key].total += inv.total;
      grouped[key].count += 1;
    });

    return Object.entries(grouped)
      .map(([key, value]) => ({ name: key, total: value.total, count: value.count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredInvoices, reportType]);

  const totalRevenue = useMemo(() => filteredInvoices.reduce((sum, inv) => sum + inv.total, 0), [filteredInvoices]);
  const totalInvoices = filteredInvoices.length;
  const avgRevenue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Admin Panel</h1>
          </div>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item, idx) => (
              <li key={idx}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <span className={item.color}>{item.icon}</span>
                  <span className="font-medium">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900">Báo cáo doanh thu</h1>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-slate-900 font-bold text-sm">{user?.name}</span>
                <span className="text-blue-600 text-[10px] font-black uppercase tracking-widest">Administrator</span>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:bg-rose-50 gap-2"
              >
                <LogOut className="w-4 h-4" />
                Thoát
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Store Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Chọn chi nhánh</label>
            <select
              value={selectedStoreId}
              onChange={(e) => handleStoreChange(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <KpiCard
              icon={<Receipt className="w-5 h-5 text-white" />}
              iconBg="bg-blue-500"
              label="Tổng doanh thu"
              value={`${fmtVND(totalRevenue)}đ`}
              sub="Từ hóa đơn đã thanh toán"
            />
            <KpiCard
              icon={<MonitorPlay className="w-5 h-5 text-white" />}
              iconBg="bg-green-500"
              label="Tổng lượt thuê"
              value={totalInvoices.toString()}
              sub="Số hóa đơn đã thanh toán"
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-white" />}
              iconBg="bg-purple-500"
              label="Doanh thu trung bình"
              value={`${fmtVND(avgRevenue)}đ`}
              sub="Trung bình mỗi hóa đơn"
            />
          </div>

          {/* Chart */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Biểu đồ doanh thu</h3>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as PeriodType)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {PERIOD_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip content={<RevenueTooltip />} />
                  <Bar yAxisId="left" dataKey="total" fill="#3b82f6" name="total" />
                  <Line yAxisId="right" type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} name="count" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
