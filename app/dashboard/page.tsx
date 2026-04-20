'use client';

import { useAuth } from '@/app/context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Room, Store, RoomSession } from '@/lib/db';
import { LayoutDashboard, DoorOpen, DoorClosed, Users, LogOut, Package, History, Store as StoreIcon, Clock, Banknote, Mic, Home, BarChart3 } from 'lucide-react';

// Ép trang này và các fetch bên trong chạy tại region Singapore để gần Database
export const preferredRegion = 'sin1';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'occupied' | 'empty'>('all');
  const [sessions, setSessions] = useState<Record<string, RoomSession>>({});
  const [sessionTotals, setSessionTotals] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  const fetchRooms = useCallback(async (storeId: string) => {
    try {
      // Xóa dữ liệu cũ trong state trước khi tải mới
      setSessions({});
      setSessionTotals({});

      // Sử dụng headers chống cache mạnh mẽ nhất
      const response = await fetch(`/api/admin/rooms?storeId=${storeId}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const data: Room[] = await response.json();
      setRooms(data);

      // === SỬA Ở ĐÂY ===
      const sortedData = [...data].sort((a, b) => {
        // Ưu tiên sắp xếp theo số phòng tự nhiên: P.VIP1, P.VIP2, ..., P.VIP10, P.VIP11, P.PARTY
        const numA = parseInt(a.roomNumber?.toString().replace(/\D/g, '') || '0');
        const numB = parseInt(b.roomNumber?.toString().replace(/\D/g, '') || '0');

        // Nếu cả hai đều là số thì so sánh số
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }

        // Nếu một cái có chữ (như P.PARTY) thì đẩy xuống cuối
        if (!isNaN(numA) && isNaN(numB)) return -1;
        if (isNaN(numA) && !isNaN(numB)) return 1;

        // So sánh chuỗi bình thường nếu không phải số
        return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true });
      });

      setRooms(sortedData);
      // Lấy thông tin phiên hoạt động cho các phòng đang sử dụng để tính thời gian và tiền
      const occupiedRooms = data.filter(r => r.status === 'occupied');
      const sessionData: Record<string, RoomSession> = {};
      const totalsData: Record<string, number> = {};

      await Promise.all(occupiedRooms.map(async (room) => {
        try {
          // Lấy session mới nhất của phòng
          const sessionRes = await fetch(`/api/rooms/session?roomId=${room.id}&t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          if (sessionRes.ok) {
            const session = await sessionRes.json();
            sessionData[room.id] = session;

            // Tải danh sách món đã gọi để tính tổng tiền dịch vụ (products)
            const sessionId = session.id || (session as any).Id;
            const ordersRes = await fetch(`/api/orders?sessionId=${sessionId}&t=${Date.now()}`, { cache: 'no-store' });
            if (ordersRes.ok) {
              const orders = await ordersRes.json();
              const productSum = orders.reduce((sum: number, item: any) =>
                sum + (Number(item.price || item.Price || 0) * (item.quantity || item.Quantity || 0)), 0
              );
              totalsData[room.id] = productSum;
            }
          }
        } catch (err) {
          console.error(`Lỗi tải phiên cho phòng ${room.id}:`, err);
        }
      }));
      setSessions(sessionData);
      setSessionTotals(totalsData);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Fetch stores
      const storesRes = await fetch(`/api/admin/stores?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const storesData = await storesRes.json();
      setStores(storesData);

      // Set initial store to user's store or first available
      const userStore = storesData.find((store: Store) => store.id === user?.storeId);
      const initialStoreId = userStore?.id || storesData[0]?.id;
      if (initialStoreId) {
        setSelectedStoreId(initialStoreId);
        fetchRooms(initialStoreId);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchRooms]);

  useEffect(() => {
    if (user?.role === 'admin') {
      router.push('/dashboard/admin');
    } else {
      router.refresh(); // Xoá sạch router cache khi quay lại dashboard
      fetchData();
    }
  }, [user, router, fetchData]);

  // Cập nhật thời gian hiện tại mỗi phút để làm mới số phút đã trôi qua
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Refetch rooms when component focuses
  useEffect(() => {
    const handleFocus = () => {
      if (selectedStoreId) {
        fetchRooms(selectedStoreId);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedStoreId, fetchRooms]);

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    fetchRooms(storeId);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length;
  const emptyRooms = rooms.filter((r) => r.status === 'empty').length;

  const filteredRooms = rooms.filter((room) => {
    if (activeTab === 'all') return true;
    return room.status === activeTab;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 hidden md:block">QUẢN LÝ HỆ THỐNG KARAOKE</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-slate-900 font-semibold text-sm">{user?.name}</span>
              <span className="text-slate-500 text-[10px] uppercase tracking-wider">{user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</span>
            </div>
            <Link href="/dashboard/invoice">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-blue-600 gap-2"
              >
                <History className="w-4 h-4" />
                <span className="hidden md:inline">Lịch sử</span>
              </Button>
            </Link>
            <Link href="/dashboard/products">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-blue-600 gap-2"
              >
                <Package className="w-4 h-4" />
                <span className="hidden md:inline">Thực đơn</span>
              </Button>
            </Link>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:bg-rose-50 gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Thoát</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Main Interface Wrapper */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Filtering and Selection Header */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-800">Danh sách phòng</h2>

            {user?.role === 'admin' && stores.length > 1 && (
              <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-1 rounded-lg">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => handleStoreChange(store.id)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${selectedStoreId === store.id

                      }`}
                  >
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 min-h-[400px]">
            {/* Tabs Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { id: 'all', label: 'Tất cả', count: rooms.length, color: 'blue' },
                { id: 'occupied', label: 'Đang dùng', count: occupiedRooms, color: 'rose' },
                { id: 'empty', label: 'Đang trống', count: emptyRooms, color: 'green' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border-2 flex items-center gap-2 ${activeTab === tab.id
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                >
                  {tab.label}
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-slate-500 font-medium">Đang tải dữ liệu...</div>
            ) : filteredRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-50 rounded-xl">
                <Package className="w-12 h-12 mb-2 opacity-20" />
                <p>{activeTab === 'all' ? 'Chưa có dữ liệu phòng' : 'Không có phòng nào ở trạng thái này'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                {filteredRooms.map((room) => (
                  <Link
                    key={room.id}
                    href={`/dashboard/room/${room.id}`}
                  >
                    <Card
                      className={`p-3 sm:p-6 h-auto min-h-[140px] sm:h-44 flex flex-col justify-between cursor-pointer transition-all border-2 ${room.status === 'empty'
                        ? 'bg-slate-100 border-blue-300 hover:border-blue-500 hover:bg-slate-200'
                        : 'bg-slate-100 border-red-400 hover:border-red-500 hover:bg-slate-200'
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5 sm:gap-3">
                          <div className={`p-1.5 sm:p-2 rounded-xl ${room.status === 'empty' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                            <Home className="w-5 h-5" />
                          </div>
                          <h3 className="text-base sm:text-2xl font-bold text-slate-900 truncate">
                            P. {room.roomNumber}
                          </h3>
                        </div>
                        <div
                          className={`px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full whitespace-nowrap ${room.status === 'empty'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                            }`}
                        >
                          {room.status === 'empty' ? 'Trống' : 'Dùng'}
                        </div>
                      </div>
                      <div className="space-y-1.5 text-slate-600 text-sm mt-2 min-h-[52px]"> {/* ← thêm min-h-[52px] */}
                        {room.status === 'occupied' && sessions[room.id] ? (
                          <div className="border-t border-slate-200 space-y-1">
                            <div className="flex items-center gap-1.5 text-blue-600 font-semibold">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="text-[11px] sm:text-sm">
                                {(() => {
                                  const session = sessions[room.id] as any;
                                  if (!session || session.status === 'pending' || session.Status === 'pending') return '0p';
                                  const start = new Date(session.startTime || session.StartTime).getTime();
                                  const diffMs = currentTime.getTime() - start;
                                  if (diffMs <= 0) return '0p';
                                  const totalMinutes = Math.ceil(diffMs / 60000);
                                  const hours = Math.floor(totalMinutes / 60);
                                  const minutes = totalMinutes % 60;
                                  return hours > 0 ? `${hours}h ${minutes}p` : `${minutes}p`;
                                })()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-rose-600 font-bold">
                              <Banknote className="w-3.5 h-3.5" />
                              <span className="text-[11px] sm:text-base">
                                {(() => {
                                  const session = sessions[room.id] as any;
                                  if (!session) return '0';
                                  let roomCharge = 0;
                                  const isPending = session.status === 'pending' || session.Status === 'pending';
                                  if (!isPending) {
                                    const start = new Date(session.startTime || session.StartTime).getTime();
                                    const diffMs = currentTime.getTime() - start;
                                    if (diffMs > 0) {
                                      const minutes = Math.ceil(diffMs / 60000);
                                      roomCharge = Math.ceil((minutes * room.pricePerHour) / 60);
                                    }
                                  }
                                  const productTotal = sessionTotals[room.id] || 0;
                                  return Math.round(roomCharge + productTotal).toLocaleString('vi-VN');
                                })()} <span className="text-[10px] font-normal">đ</span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          // ← THÊM: placeholder giữ chiều cao cho phòng trống
                          <div className="border-t border-slate-200 space-y-1 pt-1">
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="text-[11px] sm:text-sm">--</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Banknote className="w-3.5 h-3.5" />
                              <span className="text-[11px] sm:text-base">--</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
