'use client';

import { useAuth } from '@/app/context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEffect } from 'react';
import Link from 'next/link';
import { Store, DoorOpen, Users, Receipt, BarChart3, Settings, ChevronRight, ShoppingCart, Building2, LayoutGrid, UserCircle, LogOut, Boxes, ShieldCheck } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/LogoNew.jpg"
              alt="Logo"
              className="w-10 h-10 rounded-xl object-cover shadow-sm"
            />
            <h1 className="text-[19px] font-extrabold text-slate-900 tracking-tight">Quản Trị Hệ Thống Quản Lý Bán Hàng</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-600 font-bold text-[14px]">{user?.name?.charAt(0)?.toUpperCase() ?? 'A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-900 font-bold text-[13px] leading-tight">{user?.name}</span>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-tight">Quản Trị Viên</span>
              </div>
            </div>
            <div className="w-px h-7 bg-slate-200" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-[13px] font-bold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Thoát
            </button>
          </div>
        </div>
      </div>

      {/* Hero / Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Hero section */}
        <div className="relative mb-8 overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Menu quản lý</p>
            <h2 className="text-[32px] font-extrabold text-slate-900 mb-2 tracking-tight">Trung tâm quản trị hệ thống</h2>
            <p className="text-slate-500 text-[15px] mb-4">Quản lý toàn bộ hệ thống một cách hiệu quả và tập trung.</p>
            <div className="w-14 h-1 rounded-full bg-gradient-to-r from-indigo-500 to-blue-400" />
          </div>

          {/* Decorative illustration */}
          <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 w-56 h-40 items-center justify-center opacity-90">
            <div className="relative w-full h-full">
              <div className="absolute right-6 top-2 w-28 h-28 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-200 blur-0" />
              <div className="absolute right-12 top-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg flex items-center justify-center">
                <ShieldCheck className="w-9 h-9 text-white" />
              </div>
              <div className="absolute right-0 bottom-4 w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-indigo-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Menu grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Quản lý chi nhánh',
              desc: 'Thiết lập thông tin và địa chỉ của các quán.',
              href: '/dashboard/admin/stores',
              icon: <Building2 className="w-7 h-7" />,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
              barColor: 'from-blue-400 to-blue-600',
              accent: 'text-blue-600',
            },
            {
              title: 'Quản lý phòng',
              desc: 'Thêm, sửa, xóa và cấu hình phòng theo chi nhánh.',
              href: '/dashboard/admin/rooms',
              icon: <LayoutGrid className="w-7 h-7" />,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
              barColor: 'from-emerald-400 to-emerald-600',
              accent: 'text-emerald-600',
            },
            {
              title: 'Nhân sự hệ thống',
              desc: 'Quản lý tài khoản nhân viên và phân quyền truy cập.',
              href: '/dashboard/admin/staff',
              icon: <UserCircle className="w-7 h-7" />,
              color: 'text-violet-600',
              bg: 'bg-violet-50',
              barColor: 'from-violet-400 to-violet-600',
              accent: 'text-violet-600',
            },
            {
              title: 'Báo cáo doanh thu',
              desc: 'Xem biểu đồ thống kê doanh thu theo ngày, tháng, năm.',
              href: '/dashboard/admin/reports',
              icon: <Receipt className="w-7 h-7" />,
              color: 'text-purple-600',
              bg: 'bg-purple-50',
              barColor: 'from-purple-400 to-purple-600',
              accent: 'text-purple-600',
            },
            {
              title: 'Báo cáo kho hàng',
              desc: 'Xem biểu đồ thống kê kho hàng theo ngày, tháng, năm.',
              href: '/dashboard/admin/inventory',
              icon: <Boxes className="w-7 h-7" />,
              color: 'text-sky-600',
              bg: 'bg-sky-50',
              barColor: 'from-sky-400 to-sky-600',
              accent: 'text-sky-600',
            },
          ].map((item, idx) => (
            <Link key={idx} href={item.href}>
              <Card className="group relative bg-white border-none shadow-sm hover:shadow-lg p-6 rounded-2xl ring-1 ring-slate-100 flex flex-col h-full justify-between overflow-hidden transition-all duration-300">

                {/* Decorative dot pattern */}
                <div className="absolute top-5 right-5 grid grid-cols-4 gap-1 opacity-40 pointer-events-none">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span key={i} className="w-1 h-1 rounded-full bg-slate-300" />
                  ))}
                </div>

                <div>
                  <div className={`${item.bg} ${item.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    {item.icon}
                  </div>
                  <h3 className="text-[17px] font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-500 text-[13px] leading-relaxed">{item.desc}</p>
                </div>

                <div className={`mt-8 flex items-center text-[13px] font-bold ${item.accent} group-hover:translate-x-1 transition-transform`}>
                  Truy cập ngay <ChevronRight className="w-4 h-4 ml-1" />
                </div>

                {/* Bottom gradient accent bar */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${item.barColor} rounded-b-2xl`} />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}