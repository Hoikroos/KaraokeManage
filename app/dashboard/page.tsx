'use client';

import { useAuth } from '@/app/context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Room, Store, RoomSession, Product } from '@/lib/db';
import { LayoutDashboard, DoorOpen, DoorClosed, Users, LogOut, Package, History, Store as StoreIcon, Clock, Banknote, ReceiptText, Home, Waves, BarChart3, ShoppingBag, Delete, X, Lock, Search, LayoutGrid, List } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

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

  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [isPinError, setIsPinError] = useState(false);

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
      const data = rawData.filter(r => (r.id ?? (r as any).Id) !== 'EXTERNAL');

      const sortedData = [...data].sort((a, b) => {
        const numA = parseInt((a.roomNumber || (a as any).RoomNumber)?.toString().replace(/\D/g, '') || '0');
        const numB = parseInt((b.roomNumber || (b as any).RoomNumber)?.toString().replace(/\D/g, '') || '0');
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
        if (!isNaN(numA) && isNaN(numB)) return -1;
        if (isNaN(numA) && !isNaN(numB)) return 1;
        return String(a.roomNumber || (a as any).RoomNumber).localeCompare(String(b.roomNumber || (b as any).RoomNumber), undefined, { numeric: true });
      });

      setRooms(sortedData);

      const occupiedRooms = data.filter(r => (r.status || (r as any).Status) === 'occupied');
      const sessionData: Record<string, RoomSession> = {};
      const totalsData: Record<string, number> = {};

      await Promise.all(occupiedRooms.map(async (room) => {
        const roomId = room.id || (room as any).Id;
        try {
          const sessionRes = await fetch(`/api/rooms/session?roomId=${roomId}&t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
          });
          if (sessionRes.ok) {
            const session = await sessionRes.json();
            sessionData[roomId] = session;
            const sessionId = session.id || (session as any).Id || (session as any).id;
            const ordersRes = await fetch(`/api/orders?sessionId=${sessionId}&t=${Date.now()}`, {
              cache: 'no-store',
              next: { revalidate: 60 }
            });
            if (ordersRes.ok) {
              const orders = await ordersRes.json();
              const productSum = orders.reduce((sum: number, item: any) =>
                sum + (Number(item.price || item.Price || 0) * (item.quantity || item.Quantity || 0)), 0
              );
              totalsData[roomId] = productSum;
            }
          }
        } catch (err) {
          console.error(`Lỗi tải phiên cho phòng ${roomId}:`, err);
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
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const lastDashboardFetchRef = useRef(0);
  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
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

  const selectedStore = stores.find((s) => (s.id || (s as any).Id) === selectedStoreId);
  const occupiedRooms = rooms.filter((r) => (r.status || (r as any).Status) === 'occupied').length;
  const emptyRooms = rooms.filter((r) => (r.status || (r as any).Status) === 'empty').length;

  const filteredRooms = rooms.filter((room) => {
    const matchTab = activeTab === 'all' ? true : (room.status || (room as any).Status) === activeTab;
    const matchSearch = searchQuery === '' || String(room.roomNumber || (room as any).RoomNumber).toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <div className="min-h-screen" style={{
      backgroundImage: `url('/bg-karaoke.png')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      backgroundColor: '#e8ecff',
    }}>

      {/* ── Header ── */}
      <div className="bg-white/95 backdrop-blur-md border-b border-white/60 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/LogoNew.jpg"
              alt="Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover flex-shrink-0 shadow-sm"
            />
            <h1 className="text-sm sm:text-lg font-extrabold text-blue-600 truncate tracking-tight">
              HỆ THỐNG QUẢN LÝ BÁN HÀNG
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* User avatar + info */}
            <div className="hidden sm:flex items-center gap-2.5 mr-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow flex-shrink-0 ring-2 ring-blue-100">
                <span className="text-white text-xs font-bold leading-none select-none">
                  {user?.name?.split(' ').map((w: string) => w[0]).slice(-2).join('').toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-slate-700 font-semibold text-sm leading-tight">{user?.name}</span>
                <span className="text-slate-400 text-[10px] uppercase tracking-wider">
                  {user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
                </span>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={() => handleProtectedNavigation('/dashboard/invoice')} className="hidden md:flex text-slate-600 hover:text-blue-600 hover:bg-blue-50 gap-1.5 text-sm font-medium rounded-xl">
              <History className="w-4 h-4" /><span>Lịch sử</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleProtectedNavigation('/dashboard/customers')} className="hidden md:flex text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 gap-1.5 text-sm font-medium rounded-xl">
              <Users className="w-4 h-4" /><span>Khách hàng</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleProtectedNavigation('/dashboard/products')} className="hidden md:flex text-slate-600 hover:text-blue-600 hover:bg-blue-50 gap-1.5 text-sm font-medium rounded-xl">
              <Package className="w-4 h-4" /><span>Thực đơn/ Kho</span>
            </Button>
            <Link href="/dashboard/export" className="hidden md:flex">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 gap-1.5 text-sm font-medium rounded-xl">
                <ShoppingBag className="w-4 h-4" /><span>Bán mang về/ Tặng</span>
              </Button>
            </Link>

            <Button onClick={handleLogout} variant="ghost" size="sm"
              className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 gap-1 font-semibold px-2 sm:px-3 rounded-xl">
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Thoát</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">

        {/* Store selector */}
        {user?.role === 'admin' && stores.length > 1 && (
          <div className="flex flex-wrap gap-2 items-center mb-4">
            {stores.map((store) => (
              <button
                key={store.id}
                onClick={() => handleStoreChange(store.id)}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all border shadow-sm ${
                  selectedStoreId === store.id
                    ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200'
                    : 'bg-white/80 border-white text-slate-600 hover:border-blue-300 hover:bg-white'
                }`}
              >
                {store.name}
              </button>
            ))}
          </div>
        )}

        {/* Page Title */}
        <div className="mb-5">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800">Phòng / Bàn</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Quản lý trạng thái phòng / bàn trong hệ thống</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-0.5 -mx-3 px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { id: 'all', label: 'Tất cả', count: rooms.length },
            { id: 'occupied', label: 'Đang dùng', count: occupiedRooms },
            { id: 'empty', label: 'Đang trống', count: emptyRooms },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-blue-200'
                  : 'bg-white/80 border border-white/60 text-slate-600 hover:bg-white'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-lg text-[11px] font-extrabold ${
                activeTab === tab.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Room Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 font-medium bg-white/60 rounded-2xl">
            Đang tải dữ liệu...
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white/70 rounded-2xl border border-white/60">
            <Home className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm">{activeTab === 'all' ? 'Chưa có dữ liệu phòng' : 'Không có phòng nào ở trạng thái này'}</p>
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
            : "flex flex-col gap-3"
          }>
            {filteredRooms.map((room) => {
              const rId = room.id || (room as any).Id;
              const status = room.status || (room as any).Status;
              const isPaused = (sessions[rId] as any)?.status === 'paused' || (sessions[rId] as any)?.Status === 'paused';

              // Border color per status
              const borderClass = status === 'empty'
                ? 'border-blue-300'
                : isPaused
                  ? 'border-amber-400'
                  : 'border-red-400';

              // Badge
              const badgeClass = status === 'empty'
                ? 'bg-blue-100 text-blue-600'
                : isPaused
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-600';
              const badgeLabel = status === 'empty' ? 'Trống' : isPaused ? 'Tạm Tính' : 'Đang dùng';

              return (
                <Link key={rId} href={`/dashboard/room/${rId}`}>
                  <div className={`relative bg-white/90 backdrop-blur-sm border-2 ${borderClass} rounded-2xl shadow-sm hover:shadow-lg active:scale-[0.98] transition-all duration-150 cursor-pointer overflow-hidden
                    ${viewMode === 'list' ? 'flex items-center gap-3 px-4 py-3.5' : 'p-3 sm:p-5'}
                  `}>

                    {/* Watermark */}
                    {viewMode === 'grid' && (
                      <div className="absolute right-2 bottom-2 opacity-[0.04] pointer-events-none">
                        <Home className="w-16 h-16 text-blue-600" />
                      </div>
                    )}

                    {/* Top row: icon + name + badge */}
                    <div className={`flex items-center gap-2 ${viewMode === 'grid' ? 'mb-3' : 'flex-1 min-w-0'}`}>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                        <Home className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 flex-1 min-w-0 leading-tight">
                        P. {room.roomNumber || (room as any).RoomNumber}
                      </h3>
                      <span className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-xs font-bold rounded-full flex-shrink-0 ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </div>

                    {/* Time & Money */}
                    <div className={`${viewMode === 'list' ? 'flex gap-5 flex-shrink-0' : 'border-t border-slate-100 pt-3 space-y-2'}`}>
                      {/* Time */}
                      <div className="flex items-center gap-2 text-blue-600">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="hidden sm:inline text-[11px] font-semibold text-slate-400">Thời gian:</span>
                        <span className="text-[12px] sm:text-sm font-bold">
                          {(() => {
                            const session = sessions[rId];
                            if (!session || (session as any).status === 'pending' || (session as any)?.Status === 'pending') return '0p';
                            const start = new Date((session.startTime || (session as any).StartTime)).getTime();
                            let end: number;
                            const savedEnd = session.endTime || (session as any).EndTime;
                            if (savedEnd) {
                              end = new Date(savedEnd).getTime();
                            } else {
                              const iP = (session as any).status === 'paused' || (session as any)?.Status === 'paused';
                              end = iP ? new Date(((session as any).updatedAt || (session as any).UpdatedAt || currentTime)).getTime() : currentTime.getTime();
                            }
                            const diffMs = end - start;
                            if (diffMs <= 0) return '0p';
                            const totalMinutes = Math.ceil(diffMs / 60000);
                            const hours = Math.floor(totalMinutes / 60);
                            const minutes = totalMinutes % 60;
                            return hours > 0 ? `${hours}h ${minutes}p` : `${minutes}p`;
                          })()}
                        </span>
                      </div>

                      {/* Money */}
                      <div className="flex items-center gap-2 text-red-500">
                        <Banknote className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="hidden sm:inline text-[11px] font-semibold text-slate-400">Thành tiền:</span>
                        <span className="text-xs sm:text-sm font-bold">
                          {(() => {
                            const session = sessions[rId] as any;
                            const pricePerHour = room.pricePerHour || (room as any).PricePerHour || 0;
                            if (status !== 'occupied' || !session) return '0 đ';
                            let roomCharge = 0;
                            const isPending = session.status === 'pending' || session.Status === 'pending';
                            if (!isPending) {
                              const start = new Date(session.startTime || session.StartTime).getTime();
                              const savedEnd = session.endTime || session.EndTime;
                              const iP = session.status === 'paused' || session.Status === 'paused';
                              const end = savedEnd
                                ? new Date(savedEnd).getTime()
                                : (iP ? new Date(session.updatedAt || session.UpdatedAt || currentTime).getTime() : currentTime.getTime());
                              const diffMs = end - start;
                              if (diffMs > 0) {
                                const minutes = Math.ceil(diffMs / 60000);
                                roomCharge = Math.ceil((minutes * pricePerHour) / 60);
                              }
                            }
                            const productTotal = sessionTotals[rId] || 0;
                            return `${(Math.ceil((roomCharge + productTotal) / 1000) * 1000).toLocaleString('vi-VN')} đ`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PIN Modal ── */}
       <Dialog open={isLockModalOpen} onOpenChange={setIsLockModalOpen}>
        <DialogContent className="w-[300px] max-w-[90vw] rounded-3xl p-0 border-none shadow-2xl overflow-hidden bg-white">
 
          {/* ── Header gradient ── */}
          <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 pt-7 pb-9 px-6 flex flex-col items-center gap-3 overflow-hidden">
            {/* Decorative blur blobs */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -bottom-8 -left-4 w-20 h-20 rounded-full bg-white/10" />
 
            {/* Lock icon */}
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg">
              <Lock className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
 
            {/* Heading */}
            <div className="relative z-10 text-center">
              <p className="text-white font-black text-base tracking-tight">Xác thực PIN</p>
              <p className="text-blue-200 text-[10px] font-bold uppercase tracking-[0.15em] mt-0.5">Quản lý hệ thống</p>
            </div>
 
            {/* PIN dot indicators */}
            <div className={`relative z-10 flex gap-3 mt-1 ${isPinError ? 'animate-bounce' : ''}`}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${
                    pinInput.length >= i
                      ? 'bg-white border-white scale-110'
                      : 'bg-transparent border-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
 
          {/* ── Numpad ── */}
          <div className="bg-slate-50 px-5 pt-5 pb-5">
            <div className="grid grid-cols-3 gap-2.5">
              {['1','2','3','4','5','6','7','8','9'].map((num) => (
                <button
                  key={num}
                  onClick={() => handlePinClick(num)}
                  className="
                    h-[52px] rounded-2xl bg-white border border-slate-100
                    text-[18px] font-black text-slate-800
                    shadow-sm
                    hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 hover:shadow
                    active:scale-95 active:bg-indigo-100
                    transition-all duration-100 select-none
                  "
                >
                  {num}
                </button>
              ))}
 
              {/* Row 4: blank | 0 | backspace */}
              <div />
 
              <button
                onClick={() => handlePinClick('0')}
                className="
                  h-[52px] rounded-2xl bg-white border border-slate-100
                  text-[18px] font-black text-slate-800
                  shadow-sm
                  hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 hover:shadow
                  active:scale-95 active:bg-indigo-100
                  transition-all duration-100 select-none
                "
              >
                0
              </button>
 
              <button
                onClick={() => setPinInput(prev => prev.slice(0, -1))}
                className="
                  h-[52px] rounded-2xl bg-white border border-slate-100
                  flex items-center justify-center
                  shadow-sm
                  hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500 hover:shadow
                  active:scale-95
                  transition-all duration-100 select-none text-slate-400
                "
              >
                <Delete className="w-[18px] h-[18px]" />
              </button>
            </div>
 
            {/* Cancel */}
            <button
              onClick={() => setIsLockModalOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-600 hover:bg-indigo-50 transition-all"
            >
              Hủy bỏ
            </button>
          </div>
 
        </DialogContent>
      </Dialog>
    </div>
  );
}