'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/context';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Swal from 'sweetalert2';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Store } from '@/lib/db';
import { toast } from 'sonner';
import { User as UserIcon, Mail, Store as StoreIcon, Shield, Plus, Edit2, Trash2, ChevronLeft, Users, ShieldCheck, Search } from 'lucide-react';

// Định nghĩa interface trùng khớp với API trả về để xóa lỗi đỏ
interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string | null;
  createdAt: string | Date;
}

export default function StaffPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    storeId: 'all',
    role: 'user',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const storesRes = await fetch('/api/admin/stores');
      let storesData = await storesRes.json();

      const usersRes = await fetch('/api/admin/user');
      let usersData = await usersRes.json();

      // Lọc dữ liệu theo chi nhánh cho Branch Admin
      if (user?.storeId && user.storeId !== 'all') {
        storesData = storesData.filter((s: Store) => s.id === user.storeId);
        usersData = usersData.filter((u: StaffUser) => u.storeId === user.storeId);
      }

      setStores(storesData);
      setUsers(usersData);

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setIsLoading(false);
    }
  };

  const handleEdit = (user: StaffUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Để trống khi bắt đầu chỉnh sửa
      storeId: user.storeId || 'all',
      role: user.role,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(editingUser ? '/api/admin/user' : '/api/admin/user', {
        method: editingUser ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser ? { ...formData, id: editingUser.id } : formData),
      });

      if (res.ok) {
        toast.success(editingUser ? 'Cập nhật tài khoản thành công' : 'Tạo tài khoản thành công');
        setIsDialogOpen(false);
        setEditingUser(null);
        setFormData({ name: '', email: '', password: '', storeId: 'all', role: 'user' });
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Lỗi khi xử lý tài khoản');
      }
    } catch (error) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Xóa tài khoản?',
      text: 'Bạn có chắc chắn muốn xóa tài khoản này?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Xóa ngay',
      cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/admin/user?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Đã xóa tài khoản');
        fetchData();
      } else {
        toast.error('Lỗi khi xóa tài khoản');
      }
    } catch (error) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adminCount = users.filter(u => u.role === 'admin').length;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin">
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600 rounded-full w-10 h-10 p-0">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Quản lý nhân sự</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hệ thống & Phân quyền</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setEditingUser(null);
              setFormData({ name: '', email: '', password: '', storeId: 'all', role: 'user' });
              setIsDialogOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 font-bold shadow-lg shadow-blue-100 transition-all active:scale-95 gap-2"
          >
            <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Thêm nhân sự</span>
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-5 border-none shadow-sm bg-white flex items-center gap-4 ring-1 ring-slate-200 rounded-2xl">
            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><Users className="w-6 h-6" /></div>
            <div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Tổng nhân sự</p>
              <h2 className="text-2xl font-black text-slate-900">{users.length}</h2>
            </div>
          </Card>
          <Card className="p-5 border-none shadow-sm bg-white flex items-center gap-4 ring-1 ring-slate-200 rounded-2xl">
            <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600"><ShieldCheck className="w-6 h-6" /></div>
            <div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Quản trị viên</p>
              <h2 className="text-2xl font-black text-indigo-600">{adminCount}</h2>
            </div>
          </Card>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            <Input
              placeholder="Tìm nhân viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full bg-white border-none shadow-sm ring-1 ring-slate-200 rounded-2xl pl-12 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredUsers.map((staff) => {
              const store = stores.find(s => String(s.id) === String(staff.storeId));
              const initials = staff.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

              return (
                <Card key={staff.id} className="bg-white border-none shadow-sm p-5 rounded-2xl ring-1 ring-slate-200 group hover:ring-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg ${staff.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 leading-tight mb-1">{staff.name}</h3>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                            <Mail className="w-3.5 h-3.5" /> {staff.email}
                          </div>
                          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                            <StoreIcon className="w-3.5 h-3.5" /> {store?.name || (staff.role === 'admin' ? 'Toàn hệ thống' : 'Chưa gán')}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${staff.role === 'admin' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
                        }`}>
                        {staff.role === 'admin' ? 'Admin' : 'Nhân viên'}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={() => handleEdit(staff)}
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => handleDelete(staff.id)} variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Staff Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-[2rem] p-8 border-none shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight">{editingUser ? 'Cập nhật nhân sự' : 'Đăng ký nhân sự'}</DialogTitle>
            <DialogDescription className="font-bold text-slate-400">{editingUser ? 'Chỉnh sửa thông tin tài khoản nhân viên.' : 'Tạo tài khoản mới cho nhân viên hoặc quản trị viên.'}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Họ và tên</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  required
                  className="bg-slate-50 border-slate-100 h-12 rounded-xl focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Email đăng nhập</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  required
                  className="bg-slate-50 border-slate-100 h-12 rounded-xl focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Mật khẩu</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? "Để trống nếu không muốn đổi" : "••••••••"}
                  required={!editingUser}
                  className="bg-slate-50 border-slate-100 h-12 rounded-xl focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Quyền hạn</label>
                  <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
                    <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Nhân viên</SelectItem>
                      <SelectItem value="admin">Quản trị</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Chi nhánh</label>
                  <Select value={formData.storeId} onValueChange={(val) => setFormData({ ...formData, storeId: val })}>
                    <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl">
                      <SelectValue placeholder="Chọn quán" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toàn hệ thống</SelectItem>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="flex-1 h-12 rounded-xl font-bold text-slate-500">Hủy bỏ</Button>
              <Button type="submit" className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-100">{editingUser ? 'Lưu thay đổi' : 'Xác nhận tạo'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
