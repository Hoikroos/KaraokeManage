'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Room, Store } from '@/lib/db';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { Plus, Edit2, Trash2, ArrowLeft, Users, Banknote, Building, LayoutGrid } from 'lucide-react';

export default function RoomsPage() {
  const searchParams = useSearchParams();
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

  useEffect(() => {
    fetchData();
  }, [storeId]);

  const fetchData = async () => {
    try {
      // Fetch stores
      const storesRes = await fetch('/api/admin/stores');
      const storesData = await storesRes.json();
      setStores(storesData);

      // Set selected store
      if (storeId) {
        const store = storesData.find((s: Store) => s.id === storeId);
        if (store) {
          setSelectedStore(store);
          await fetchRooms(storeId);
        }
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
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin">
              <Button variant="ghost" size="sm" className="text-slate-600">
                ← Quay lại
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-slate-900">Thiết lập phòng</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Store Selection */}
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

        {selectedStore && (
          <>
            {/* Form */}
            <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-blue-600" /> {selectedStore.name}
              </h2>
              <Button
                onClick={() => {
                  setShowForm(!showForm);
                  if (showForm) {
                    setEditingRoom(null);
                    setFormData({ roomNumber: '', capacity: 4, pricePerHour: 100000 });
                  }
                }}
                className="bg-slate-900 hover:bg-slate-800 gap-2"
              >
                {showForm ? 'Đóng lại' : <><Plus className="w-4 h-4" /> Thêm phòng</>}
              </Button>
            </div>

            {showForm && (
              <Card className="bg-white border-none shadow-md p-6 mb-8 ring-1 ring-slate-200 rounded-xl">
                <h3 className="text-lg font-bold text-slate-900 mb-6">
                  {editingRoom ? 'Chỉnh sửa phòng' : 'Thêm phòng mới'}
                </h3>
                <form onSubmit={editingRoom ? handleUpdateRoom : handleAddRoom} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Số phòng</label>
                      <Input
                        value={formData.roomNumber}
                        onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                        placeholder="A01"
                        required
                        className="bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sức chứa</label>
                      <Input
                        type="number"
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                        placeholder="4"
                        className="bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Giá/giờ (VNĐ)</label>
                      <Input
                        type="text"
                        value={formData.pricePerHour.toLocaleString('vi-VN')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, pricePerHour: val ? parseInt(val) : 0 });
                        }}
                        placeholder="100000"
                        className="bg-slate-50 border-slate-200"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 font-bold h-12"
                  >
                    {editingRoom ? 'Xác nhận cập nhật' : 'Thêm phòng ngay'}
                  </Button>
                </form>
              </Card>
            )}

            {/* Rooms Grid */}
            {rooms.length === 0 ? (
              <Card className="bg-white border-dashed border-2 border-slate-200 p-12 text-center rounded-xl">
                <p className="text-slate-600">Chưa có phòng nào</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {rooms.map((room) => (
                  <Card key={room.id} className="bg-white border-none shadow-sm hover:shadow-md transition-all p-6 rounded-xl ring-1 ring-slate-200 relative group">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${room.status === 'empty' ? 'bg-green-400' : 'bg-rose-400'}`} />
                    <div className="flex items-start justify-between mb-6">
                      <h3 className="text-xl font-bold text-slate-900">
                        Phòng {room.roomNumber}
                      </h3>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(room)} className="h-8 w-8 text-blue-600"><Edit2 className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(room.id)} className="h-8 w-8 text-rose-600"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Users className="w-4 h-4" /> Tối đa {room.capacity} người
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Banknote className="w-4 h-4" /> <span className="font-bold text-blue-600">{room.pricePerHour.toLocaleString('vi-VN')}đ</span> / giờ
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
