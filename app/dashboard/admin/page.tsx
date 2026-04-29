'use client';

import { useAuth } from '@/app/context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEffect } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Store, DoorOpen, Users, Receipt, BarChart3, Settings, ChevronRight, ShoppingCart, Building2, LayoutGrid, UserCircle, LogOut, Boxes } from 'lucide-react';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

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
      title: 'Thống kê',
      href: '/dashboard/admin/statistics',
      icon: <BarChart3 className="w-5 h-5" />,
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
      title: 'Báo cáo doanh thu',
      href: '/dashboard/admin/reports',
      icon: <Receipt className="w-5 h-5" />,
      color: 'text-orange-600',
    },
    {
      title: 'Báo cáo kho hàng',
      href: '/dashboard/admin/inventory',
      icon: <Boxes className="w-5 h-5" />,
      color: 'text-teal-600',
    },
  ];

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
            <h1 className="text-xl font-bold text-slate-900">Quản Trị Hệ Thống</h1>
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
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Menu Quản Lý</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Quản lý chi nhánh',
                desc: 'Thiết lập thông tin và địa chỉ của các quán.',
                href: '/dashboard/admin/stores',
                icon: <Building2 className="w-6 h-6" />,
                color: 'text-blue-600',
                bg: 'bg-blue-50'
              },
              {
                title: 'Quản lý phòng',
                desc: 'Thêm, sửa, xóa và cấu hình phòng karaoke theo chi nhánh.',
                href: '/dashboard/admin/rooms',
                icon: <LayoutGrid className="w-6 h-6" />,
                color: 'text-green-600',
                bg: 'bg-green-50'
              },
              {
                title: 'Nhân sự hệ thống',
                desc: 'Quản lý tài khoản nhân viên và phân quyền truy cập.',
                href: '/dashboard/admin/staff',
                icon: <UserCircle className="w-6 h-6" />,
                color: 'text-indigo-600',
                bg: 'bg-indigo-50'
              },
              {
                title: 'Báo cáo doanh thu',
                desc: 'Xem biểu đồ thống kê doanh thu theo ngày, tháng, năm.',
                href: '/dashboard/admin/reports',
                icon: <Receipt className="w-6 h-6" />,
                color: 'text-purple-600',
                bg: 'bg-purple-50'
              },
              {
                title: 'Báo cáo kho hàng',
                desc: 'Xem biểu đồ thống kê kho hàng theo ngày, tháng, năm.',
                href: '/dashboard/admin/inventory',
                icon: <Boxes className="w-6 h-6" />,
                color: 'text-green-600',
                bg: 'bg-green-50'
              },
            ].map((item, idx) => (
              <Link key={idx} href={item.href}>
                <Card className="group bg-white border-none shadow-sm hover:shadow-md transition-all p-6 rounded-2xl ring-1 ring-slate-200 flex flex-col h-full justify-between">
                  <div>
                    <div className={`${item.bg} ${item.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="mt-8 flex items-center text-sm font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                    Truy cập ngay <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
