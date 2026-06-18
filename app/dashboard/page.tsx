'use client';

import { useAuth } from '@/app/context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Room, Store, RoomSession, Product } from '@/lib/db';
import { LayoutDashboard, DoorOpen, DoorClosed, Users, LogOut, Package, History, Store as StoreIcon, Clock, Banknote, ReceiptText, Home, BarChart3, ShoppingBag, Delete, X, Lock, Search, LayoutGrid, List } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // State cho khóa bảo vệ mới
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [isPinError, setIsPinError] = useState(false);

  // Mật khẩu quản lý (tự định nghĩa tại đây)
  const ADMIN_PIN = "2531";

  const handleProtectedNavigation = (path: string) => {
    if (sessionStorage.getItem('dashboard_unlocked') === 'true') {
      router.push(path);
      return;
    }
    setTargetPath(path);
    setPinInput('');
    setIsLockModalOpen(true);
  };

  const handlePinClick = (num: string) => {
    if (pinInput.length < 4) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      if (newPin.length === 4) verifyPin(newPin);
    }
  };

  const verifyPin = (pin: string) => {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('dashboard_unlocked', 'true');
      setIsLockModalOpen(false);
      router.push(targetPath);
    } else {
      setIsPinError(true);
      toast.error('Mã PIN không chính xác!');
      setTimeout(() => {
        setIsPinError(false);
        setPinInput('');
      }, 500);
    }
  };

  const fetchRooms = useCallback(async (storeId: string) => {
    try {
      setSessions({});
      setSessionTotals({});

      const response = await fetch(`/api/admin/rooms?storeId=${storeId}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const rawData: Room[] = await response.json();

      // Lọc bỏ phòng ảo "MANG VỀ" (Id: EXTERNAL) để không hiển thị trên sơ đồ phòng chính
      const data = rawData.filter(r => (r.id ?? (r as any).Id) !== 'EXTERNAL');

      const sortedData = [...data].sort((a, b) => {
        const numA = parseInt(a.roomNumber?.toString().replace(/\D/g, '') || '0');
        const numB = parseInt(b.roomNumber?.toString().replace(/\D/g, '') || '0');

        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
        if (!isNaN(numA) && isNaN(numB)) return -1;
        if (isNaN(numA) && !isNaN(numB)) return 1;
        return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true });
      });

      setRooms(sortedData);

      const occupiedRooms = data.filter(r => r.status === 'occupied');
      const sessionData: Record<string, RoomSession> = {};
      const totalsData: Record<string, number> = {};

      await Promise.all(occupiedRooms.map(async (room) => {
        try { // Chỉ lấy session nếu thực sự cần thiết, hoặc gộp vào API rooms
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

            const sessionId = session.id || (session as any).Id;
            // TỐI ƯU: Nếu là nhân viên xem ngoài sảnh, có thể chưa cần load chi tiết đơn hàng ngay
            // giúp giảm Function Invocations đáng kể
            const ordersRes = await fetch(`/api/orders?sessionId=${sessionId}&t=${Date.now()}`, {
              cache: 'no-store',
              next: { revalidate: 60 } // Cho phép cache nhẹ 60s ngoài Dashboard
            });
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
      const storesRes = await fetch(`/api/admin/stores?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const storesData = await storesRes.json();
      setStores(storesData);

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
      router.refresh();
      fetchData();
    }
  }, [user, router, fetchData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const lastDashboardFetchRef = useRef(0);
  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      // Tăng lên 5 phút (300.000ms). Dashboard chỉ cần cái nhìn tổng quan, 
      // không cần cập nhật từng giây như trong phòng.
      if (selectedStoreId && (now - lastDashboardFetchRef.current > 300000)) {
        fetchRooms(selectedStoreId);
        lastDashboardFetchRef.current = now;
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
    const matchTab = activeTab === 'all' ? true : room.status === activeTab;
    const matchSearch = searchQuery === '' || String(room.roomNumber).toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/LogoNew.jpg"
              alt="Logo Hệ thống"
              className="w-10 h-10 rounded-lg object-cover"
            />
            <h1 className="text-xl font-bold text-blue-600 hidden md:block">QUẢN LÝ HỆ THỐNG BÁN HÀNG</h1>
          </div>

          <div className="flex items-center gap-1 md:gap-3">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-slate-700 font-semibold text-sm">{user?.name}</span>
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">{user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</span>
            </div>

            <Button variant="ghost" size="sm" onClick={() => handleProtectedNavigation('/dashboard/invoice')} className="hidden md:flex text-slate-600 hover:text-blue-600 gap-1.5 text-sm font-medium">
              <History className="w-4 h-4" />
              <span>Lịch sử</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleProtectedNavigation('/dashboard/customers')} className="hidden md:flex text-slate-600 hover:text-indigo-600 gap-1.5 text-sm font-medium">
              <Users className="w-4 h-4" />
              <span>Khách hàng</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleProtectedNavigation('/dashboard/products')} className="hidden md:flex text-slate-600 hover:text-blue-600 gap-1.5 text-sm font-medium">
              <Package className="w-4 h-4" />
              <span>Thực đơn/ Kho</span>
            </Button>
            <Link href="/dashboard/export" className="hidden md:flex">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-indigo-600 gap-1.5 text-sm font-medium">
                <ShoppingBag className="w-4 h-4" />
                <span>Bán mang về/ Tặng</span>
              </Button>
            </Link>

            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 gap-1.5 font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Thoát</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Store selector for admin */}
        {user?.role === 'admin' && stores.length > 1 && (
          <div className="flex flex-wrap gap-2 items-center mb-4">
            {stores.map((store) => (
              <button
                key={store.id}
                onClick={() => handleStoreChange(store.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all border ${selectedStoreId === store.id
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
              >
                {store.name}
              </button>
            ))}
          </div>
        )}

        {/* Page Title + Search */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Phòng / Bàn</h2>
            <p className="text-slate-400 text-sm mt-0.5">Quản lý trạng thái phòng / bàn trong hệ thống</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm phòng / bàn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 w-48 sm:w-56 transition-all"
              />
            </div>
            {/* View toggle */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'all', label: 'Tất cả', count: rooms.length },
            { id: 'occupied', label: 'Đang dùng', count: occupiedRooms },
            { id: 'empty', label: 'Đang trống', count: emptyRooms },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                }`}
            >
              {tab.label}
              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Room Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 font-medium">Đang tải dữ liệu...</div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <Package className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm">{activeTab === 'all' ? 'Chưa có dữ liệu phòng' : 'Không có phòng nào ở trạng thái này'}</p>
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            : "flex flex-col gap-3"
          }>
            {filteredRooms.map((room) => (
              <Link key={room.id} href={`/dashboard/room/${room.id}`}>
                <div
                  className={`relative bg-white border rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden
                    ${room.status === 'occupied' ? 'border-slate-200' : 'border-slate-100'}
                    ${viewMode === 'list' ? 'flex items-center gap-4 px-5 py-4' : 'p-5'}
                  `}
                >
                  {/* Background watermark icon */}
                  {viewMode === 'grid' && (
                    <div className="absolute right-3 bottom-3 opacity-[0.04] pointer-events-none">
                      <Home className="w-20 h-20 text-blue-600" />
                    </div>
                  )}

                  <div className={`flex items-center gap-3 ${viewMode === 'grid' ? 'mb-4' : 'flex-1'}`}>
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Home className="w-5 h-5 text-blue-500" />
                    </div>

                    {/* Room name */}
                    <h3 className="text-lg font-bold text-slate-800 flex-1">
                      P. {room.roomNumber}
                    </h3>

                    {/* Status badge */}
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${room.status === 'empty'
                        ? 'bg-green-100 text-green-700'
                        : (((sessions[room.id] as any)?.status === 'paused' || (sessions[room.id] as any)?.Status === 'paused')
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-600')
                        }`}
                    >
                      {room.status === 'empty'
                        ? 'Trống'
                        : (((sessions[room.id] as any)?.status === 'paused' || (sessions[room.id] as any)?.Status === 'paused')
                          ? 'Tạm dừng'
                          : 'Đang dùng')
                      }
                    </span>
                  </div>

                  {/* Time & Money info */}
                  <div className={`space-y-1.5 ${viewMode === 'list' ? 'flex gap-6 space-y-0 flex-shrink-0' : 'border-t border-slate-100 pt-3'}`}>
                    {/* Time */}
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>
                        {room.status === 'occupied' && sessions[room.id] ? (() => {
                          const session = sessions[room.id];
                          if (!session || (session as any).status === 'pending' || (session as any)?.Status === 'pending') return 'Thời gian: --:--';
                          const start = new Date((session.startTime || (session as any).StartTime)).getTime();

                          let end: number;
                          const savedEnd = session.endTime || (session as any).EndTime;
                          if (savedEnd) {
                            end = new Date(savedEnd).getTime();
                          } else {
                            const isPaused = (session as any).status === 'paused' || (session as any)?.Status === 'paused';
                            end = isPaused ? new Date(((session as any).updatedAt || (session as any).UpdatedAt || currentTime)).getTime() : currentTime.getTime();
                          }

                          const diffMs = end - start;
                          if (diffMs <= 0) return 'Thời gian: 0p';
                          const totalMinutes = Math.ceil(diffMs / 60000);
                          const hours = Math.floor(totalMinutes / 60);
                          const minutes = totalMinutes % 60;
                          return `Thời gian: ${hours > 0 ? `${hours}h ${minutes}p` : `${minutes}p`}`;
                        })() : 'Thời gian: --:--'}
                      </span>
                    </div>

                    {/* Money */}
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Banknote className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>
                        {room.status === 'occupied' && sessions[room.id] ? (() => {
                          const session = sessions[room.id] as any;
                          if (!session) return 'Tiền: 0 đ';
                          let roomCharge = 0;
                          const isPending = (session as any).status === 'pending' || (session as any)?.Status === 'pending';
                          if (!isPending) {
                            const start = new Date((session.startTime || (session as any).StartTime)).getTime();

                            let end: number;
                            const savedEnd = session.endTime || (session as any).EndTime;
                            if (savedEnd) {
                              end = new Date(savedEnd).getTime();
                            } else {
                              const isPaused = (session as any).status === 'paused' || (session as any)?.Status === 'paused';
                              end = isPaused ? new Date(((session as any).updatedAt || (session as any).UpdatedAt || currentTime)).getTime() : currentTime.getTime();
                            }

                            const diffMs = end - start;
                            if (diffMs > 0) {
                              const minutes = Math.ceil(diffMs / 60000);
                              roomCharge = Math.ceil((minutes * room.pricePerHour) / 60);
                            }
                          }
                          const productTotal = sessionTotals[room.id] || 0;
                          return `Tiền: ${(Math.ceil((roomCharge + productTotal) / 1000) * 1000).toLocaleString('vi-VN')} đ`;
                        })() : 'Tiền: 0 đ'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Custom PIN Pad Modal ── */}
      <Dialog open={isLockModalOpen} onOpenChange={setIsLockModalOpen}>
        <DialogContent className="w-[240px] rounded-[2.5rem] p-5 border-none shadow-2xl overflow-hidden bg-white/95 backdrop-blur-xl">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
              <Lock className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-0.5 text-center">Xác thực PIN</h2>
            <p className="text-slate-400 text-[8px] font-bold uppercase tracking-widest mb-5 text-center">Quản lý hệ thống</p>

            {/* PIN Dots Display */}
            <div className={`flex gap-2.5 mb-6 ${isPinError ? 'animate-bounce' : ''}`}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-200 
                    ${pinInput.length >= i
                      ? 'bg-indigo-600 border-indigo-600 scale-110'
                      : 'bg-transparent border-slate-200'}`}
                />
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 w-full">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  onClick={() => handlePinClick(num)}
                  className="w-full aspect-square rounded-xl bg-slate-50 hover:bg-indigo-50 active:scale-90 text-base font-black text-slate-700 transition-all"
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                onClick={() => handlePinClick('0')}
                className="w-full aspect-square rounded-xl bg-slate-50 hover:bg-indigo-50 active:scale-90 text-base font-black text-slate-700 transition-all"
              >
                0
              </button>
              <button
                onClick={() => setPinInput(prev => prev.slice(0, -1))}
                className="w-full aspect-square rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 active:scale-90 transition-all"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={() => setIsLockModalOpen(false)}
              className="mt-5 text-slate-400 text-[9px] font-bold uppercase hover:text-slate-600 transition tracking-widest"
            >
              Hủy bỏ
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}