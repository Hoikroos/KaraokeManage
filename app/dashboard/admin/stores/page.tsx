'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Store } from '@/lib/db';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { Building2, MapPin, Phone, Plus, Edit2, Trash2, DoorOpen } from 'lucide-react';

export default function StoresPage() {
  const { user } = useAuth();
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
  });

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/admin/stores');
      let data = await response.json();

      // Nếu admin được gán chi nhánh, chỉ hiển thị chi nhánh đó
      if (user?.storeId && user.storeId !== 'all') {
        data = data.filter((s: Store) => s.id === user.storeId);
      }

      setStores(data);
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const method = editingStore ? 'PUT' : 'POST';

      const body = editingStore
        ? { id: editingStore.id, ...formData }
        : formData;

      const response = await fetch('/api/admin/stores', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();

        if (editingStore) {
          setStores(stores.map(s => (s.id === data.id ? data : s)));
          toast.success('Cập nhật quán thành công');
        } else {
          setStores([...stores, data]);
          toast.success('Thêm quán thành công');
        }

        setEditingStore(null);
        setFormData({ name: '', address: '', phone: '' });
        setShowForm(false);
      } else {
        toast.error('Lỗi khi lưu thông tin quán');
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi lưu thông tin quán');
    }
  };

  // ── Xóa chi nhánh ──────────────────────────────────────────────────────────
  const handleDelete = async (store: Store) => {
    const result = await Swal.fire({
      title: 'Xóa chi nhánh?',
      text: `Bạn có chắc muốn xóa "${store.name}"? Thao tác này không thể hoàn tác.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch('/api/admin/stores', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: store.id }),
      });

      if (res.ok) {
        setStores(stores.filter(s => s.id !== store.id));
        toast.success('Đã xóa chi nhánh');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Lỗi khi xóa');
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

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
            <h1 className="text-xl font-bold text-slate-900">Hệ thống chi nhánh</h1>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 gap-2 shadow-sm"
          >
            {showForm ? 'Hủy bỏ' : <><Plus className="w-4 h-4" /> Thêm quán</>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Form */}
        {showForm && (
          <Card className="bg-white border-none shadow-md p-6 mb-8 rounded-xl ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              {editingStore ? 'Cập nhật thông tin chi nhánh' : 'Đăng ký chi nhánh mới'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tên quán</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Tên quán karaoke"
                    required
                    className="bg-slate-50 border-slate-200 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Số điện thoại</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Số điện thoại"
                    required
                    className="bg-slate-50 border-slate-200 focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Địa chỉ</label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Địa chỉ"
                  required
                  className="bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 font-bold h-12"
              >
                {editingStore ? 'Cập nhật ngay' : 'Thêm chi nhánh mới'}
              </Button>
            </form>
          </Card>
        )}

        {/* Stores List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
            <p>Đang tải danh sách chi nhánh...</p>
          </div>
        ) : stores.length === 0 ? (
          <Card className="bg-white border-dashed border-2 border-slate-200 p-12 text-center">
            <p className="text-slate-600">Chưa có quán nào</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stores.map((store) => (
              <Card key={store.id} className="bg-white border-none shadow-sm hover:shadow-md transition-all p-6 rounded-xl ring-1 ring-slate-200 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => {
                        setEditingStore(store);
                        setFormData({ name: store.name, address: store.address, phone: store.phone });
                        setShowForm(true);
                      }}
                      className="text-slate-400 hover:text-blue-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {(!user?.storeId || user?.storeId === 'all') && (
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => handleDelete(store)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">{store.name}</h3>
                <div className="space-y-3 text-slate-600 text-sm mb-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" /> {store.address}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" /> {store.phone}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/admin/rooms?storeId=${store.id}`} className="flex-1">
                    <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white gap-2">
                      <DoorOpen className="w-4 h-4" /> Quản lý phòng
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}