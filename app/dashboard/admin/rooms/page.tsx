'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Room, Store } from '@/lib/db';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import {
  Plus, Edit2, Trash2, Users, Banknote, Building, LayoutGrid,
  Search, MoreVertical, ChevronLeft, ChevronRight, CheckCircle2,
  Wrench, Boxes, X, SlidersHorizontal,
} from 'lucide-react';

export default function RoomsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const storeId = searchParams.get('storeId');
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    roomNumber: '',
    capacity: 4,
    pricePerHour: 100000,
  });

  /* ── Các state này CHỈ phục vụ hiển thị (tìm kiếm / lọc / phân trang),
        không đụng tới logic thêm - sửa - xóa - fetch dữ liệu ── */
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    if (user) fetchData();
  }, [storeId, user]);

  const fetchData = async () => {
    try {
      // Fetch stores
      const storesRes = await fetch('/api/admin/stores');
      let storesData = await storesRes.json();

      // Lọc chi nhánh cho Admin chi nhánh
      if (user?.storeId && user.storeId !== 'all') {
        storesData = storesData.filter((s: Store) => s.id === user.storeId);
      }

      setStores(storesData);

      // Set selected store
      const targetStoreId = storeId || (user?.storeId && user.storeId !== 'all' ? user.storeId : (storesData.length > 0 ? storesData[0].id : ''));

      const store = storesData.find((s: Store) => s.id === targetStoreId);
      if (store) {
        setSelectedStore(store);
        await fetchRooms(store.id);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRooms = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/rooms?storeId=${id}`);
      const data = await response.json();
      setRooms(data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const handleStoreChange = (store: Store) => {
    setSelectedStore(store);
    setRooms([]);
    setPage(1);
    fetchRooms(store.id);
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) return;

    console.log('Form data:', formData);
    console.log('Selected store:', selectedStore);

    try {
      const response = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: selectedStore.id,
          ...formData,
        }),
      });

      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (response.ok) {
        const newRoom = responseData;
        setRooms([...rooms, newRoom]);
        setFormData({ roomNumber: '', capacity: 4, pricePerHour: 100000 });
        setShowForm(false);
        toast.success('Thêm phòng thành công');
      } else {
        toast.error('Lỗi khi thêm phòng: ' + (responseData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding room:', error);
      toast.error('Lỗi khi thêm phòng');
    }
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    try {
      const response = await fetch('/api/admin/rooms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRoom.id,
          ...formData,
          status: editingRoom.status,
        }),
      });

      if (response.ok) {
        const updatedRoom = await response.json();
        setRooms(rooms.map((r) => (r.id === editingRoom.id ? updatedRoom : r)));
        setFormData({ roomNumber: '', capacity: 4, pricePerHour: 100000 });
        setEditingRoom(null);
        setShowForm(false);
        toast.success('Cập nhật phòng thành công');
      } else {
        toast.error('Lỗi khi cập nhật phòng');
      }
    } catch (error) {
      console.error('Error updating room:', error);
      toast.error('Lỗi khi cập nhật phòng');
    }
  };

  const handleEdit = (room: any) => {
    setEditingRoom(room);
    setFormData({
      roomNumber: room.roomNumber,
      capacity: room.capacity,
      pricePerHour: room.pricePerHour,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Xóa phòng?',
      text: 'Bạn chắc chắn muốn xóa phòng này? Hành động này không thể hoàn tác.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await fetch('/api/admin/rooms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      setRooms(rooms.filter((r) => r.id !== id));
      toast.success('Xóa phòng thành công');
    } catch (error) {
      console.error('Error deleting room:', error);
      toast.error('Lỗi khi xóa phòng');
    }
  };

  /* ── Đóng / mở panel thêm-sửa phòng (chỉ là gói lại đoạn code đang có
        sẵn trong onClick cũ, hành vi giữ nguyên y hệt, để dùng được ở
        cả nút "+ Thêm phòng" và nút "X" đóng panel) ── */
  const handleToggleForm = () => {
    setShowForm(!showForm);
    if (showForm) {
      setEditingRoom(null);
      setFormData({ roomNumber: '', capacity: 4, pricePerHour: 100000 });
    }
  };

  /* ── Tính toán CHỈ phục vụ hiển thị: thống kê / lọc / phân trang ── */
  const totalRoomsCount = rooms.length;
  const emptyCount = rooms.filter((r) => r.status === 'empty').length;
  const maintenanceCount = rooms.filter((r: any) => r.status === 'maintenance').length;
  const inUseCount = totalRoomsCount - emptyCount - maintenanceCount;

  const getStatusMeta = (status: string) => {
    if (status === 'empty') return { bar: 'bg-emerald-400', pill: 'bg-emerald-50 text-emerald-600', label: 'Trống' };
    if (status === 'maintenance') return { bar: 'bg-orange-400', pill: 'bg-orange-50 text-orange-600', label: 'Bảo trì' };
    return { bar: 'bg-blue-400', pill: 'bg-blue-50 text-blue-600', label: 'Đang sử dụng' };
  };

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch = r.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (r as any).status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / pageSize));
  const paginatedRooms = filteredRooms.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin">
              <Button variant="ghost" size="sm" className="text-slate-600">
                ← Quay lại
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Title + Add button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Thiết lập phòng</h1>
            <p className="text-sm text-slate-500 mt-0.5">Quản lý và cấu hình các phòng trong nhà hàng</p>
          </div>
          {selectedStore && (
            <Button
              onClick={handleToggleForm}
              className="bg-blue-600 hover:bg-blue-700 gap-2 h-11 px-5 font-bold"
            >
              <Plus className="w-4 h-4" /> Thêm phòng
            </Button>
          )}
        </div>

        {/* Store Selection */}
        {stores.length > 1 && (
          <div className="mb-8">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Chọn chi nhánh</h2>
            <div className="flex flex-wrap gap-3">
              {stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => handleStoreChange(store)}
                  className={`px-6 py-3 rounded-xl border-2 transition-all text-sm font-bold flex items-center gap-2 ${selectedStore?.id === store.id
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                >
                  <Building className="w-4 h-4" /> {store.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedStore && (
          <>
            {/* Filter bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 mb-6 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  placeholder="Tìm kiếm phòng theo tên, mã..."
                  className="pl-10 h-10 bg-slate-50 border-slate-200 text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 outline-none"
              >
                <option value="all">Trạng thái: Tất cả</option>
                <option value="empty">Trống</option>
                <option value="in-use">Đang sử dụng</option>
                <option value="maintenance">Bảo trì</option>
              </select>
              <select
                disabled
                defaultValue="all"
                title="Chưa có dữ liệu loại phòng"
                className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400 outline-none cursor-not-allowed"
              >
                <option value="all">Loại phòng: Tất cả</option>
              </select>
              <button
                onClick={resetFilters}
                className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" /> Bộ lọc
              </button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-none ring-1 ring-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Boxes className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng phòng</p>
                  <p className="text-xl font-extrabold text-slate-900">{totalRoomsCount}</p>
                </div>
              </Card>
              <Card className="border-none ring-1 ring-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trống</p>
                  <p className="text-xl font-extrabold text-emerald-600">{emptyCount}</p>
                </div>
              </Card>
              <Card className="border-none ring-1 ring-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đang sử dụng</p>
                  <p className="text-xl font-extrabold text-blue-600">{inUseCount}</p>
                </div>
              </Card>
              <Card className="border-none ring-1 ring-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bảo trì</p>
                  <p className="text-xl font-extrabold text-orange-600">{maintenanceCount}</p>
                </div>
              </Card>
            </div>

            {/* Rooms Grid */}
            {filteredRooms.length === 0 ? (
              <Card className="bg-white border-dashed border-2 border-slate-200 p-12 text-center rounded-xl">
                <p className="text-slate-600">Chưa có phòng nào</p>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {paginatedRooms.map((room: any) => {
                    const meta = getStatusMeta(room.status);
                    return (
                      <Card key={room.id} className="bg-white border-none shadow-sm hover:shadow-md transition-all p-6 rounded-xl ring-1 ring-slate-200 relative overflow-hidden">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${meta.bar}`} />
                        <div className="flex items-start justify-between mb-6">
                          <h3 className="text-xl font-bold text-slate-900">
                            Phòng {room.roomNumber}
                          </h3>
                          <div className="relative group/menu">
                            <button className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            <div className="absolute right-0 top-9 z-20 w-32 bg-white border border-slate-200 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all">
                              <button
                                onClick={() => handleEdit(room)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-blue-600" /> Sửa
                              </button>
                              <button
                                onClick={() => handleDelete(room.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Xóa
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Users className="w-4 h-4" /> Tối đa {room.capacity} người
                          </div>
                          <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Banknote className="w-4 h-4" /> <span className="font-bold text-blue-600">{room.pricePerHour.toLocaleString('vi-VN')}đ</span> / giờ
                          </div>
                        </div>
                        <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold ${meta.pill}`}>
                          {meta.label}
                        </span>
                      </Card>
                    );
                  })}
                </div>

                {/* Pagination (chỉ hiển thị, cắt từ filteredRooms phía trên) */}
                <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
                  <p className="text-xs text-slate-400">
                    Hiển thị {paginatedRooms.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredRooms.length)} trong tổng số {filteredRooms.length} phòng
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${page === p ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="h-8 px-2 rounded-lg border border-slate-200 text-xs text-slate-600 outline-none ml-1"
                    >
                      {[12, 10, 20, 50].map((s) => (
                        <option key={s} value={s}>{s} / trang</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Slide-over: Thêm / Sửa phòng */}
      {showForm && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/40 z-40"
            onClick={handleToggleForm}
          />
          <div className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white z-50 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingRoom ? 'Chỉnh sửa phòng' : 'Thêm phòng mới'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Điền thông tin để {editingRoom ? 'cập nhật' : 'tạo'} phòng mới
                </p>
              </div>
              <button
                onClick={handleToggleForm}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={editingRoom ? handleUpdateRoom : handleAddRoom}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Thông tin phòng</p>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Số phòng *</label>
                  <Input
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    placeholder="VD: VIP01, P01..."
                    required
                    className="bg-slate-50 border-slate-200 h-11"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Mã phòng phải là duy nhất</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sức chứa tối đa</label>
                  <Input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    placeholder="Nhập số người tối đa"
                    className="bg-slate-50 border-slate-200 h-11"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Đơn giá (VNĐ / giờ) *</label>
                  <Input
                    type="text"
                    value={formData.pricePerHour.toLocaleString('vi-VN')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, pricePerHour: val ? parseInt(val) : 0 });
                    }}
                    placeholder="Nhập đơn giá"
                    className="bg-slate-50 border-slate-200 h-11"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleToggleForm}
                  className="flex-1 h-11 font-bold"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 font-bold"
                >
                  {editingRoom ? 'Xác nhận cập nhật' : 'Tạo phòng'}
                </Button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}