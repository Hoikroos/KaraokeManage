'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/app/context';
import { Product } from '@/lib/db';
import { toast } from 'sonner';
import {
    ArrowLeft, Search, Plus, Minus, Trash2, Printer,
    Gift, ShoppingBag, ClipboardList, Package, CheckCircle2
} from 'lucide-react';

export default function ExportPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<any[]>([]);
    const [note, setNote] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [exportType, setExportType] = useState<'takeaway' | 'gift'>('takeaway');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeView, setActiveView] = useState<'create' | 'history'>('create');
    const [history, setHistory] = useState<any[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [lastExport, setLastExport] = useState<any>(null);

    // 1. Tải dữ liệu từ LocalStorage khi vào trang
    useEffect(() => {
        if (user?.storeId) fetchProducts();

        const savedCustomer = localStorage.getItem('export_customer');
        const savedNote = localStorage.getItem('export_note');
        const savedCart = localStorage.getItem('export_cart');

        if (savedCustomer) setCustomerName(savedCustomer);
        if (savedNote) setNote(savedNote);
        if (savedCart) {
            try { setCart(JSON.parse(savedCart)); } catch (e) { console.error(e); }
        }
    }, [user]);

    // 2. Tự động lưu vào LocalStorage khi có thay đổi
    useEffect(() => {
        localStorage.setItem('export_customer', customerName);
    }, [customerName]);

    useEffect(() => {
        localStorage.setItem('export_note', note);
    }, [note]);

    useEffect(() => {
        localStorage.setItem('export_cart', JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        if (activeView === 'history' && user?.storeId) fetchHistory();
    }, [activeView, user]);

    const fetchHistory = async () => {
        setIsHistoryLoading(true);
        try {
            const res = await fetch(`/api/invoices?storeId=${user?.storeId}`);
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.data || []);
            // Lọc các hóa đơn có mã TKW hoặc GFT
            const exportOnly = list.filter((inv: any) => inv.id.startsWith('TKW') || inv.id.startsWith('GFT'));
            setHistory(exportOnly.slice(0, 20)); // Lấy 20 cái gần nhất
        } catch (e) { console.error(e); }
        finally { setIsHistoryLoading(false); }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch(`/api/products?storeId=${user?.storeId}`);
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.quantity > 0
        );
    }, [products, searchTerm]);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                return prev.map(item =>
                    item.productId === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, {
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: 1
            }];
        });
    };

    const updateQty = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.productId === id) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleConfirmExport = async () => {
        if (cart.length === 0) return toast.error('Vui lòng chọn sản phẩm');
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeId: user?.storeId,
                    items: cart,
                    note: note || (exportType === 'gift' ? 'Xuất tặng khách' : 'Bán mang về'),
                    customerName: customerName || (exportType === 'gift' ? 'Khách tặng' : 'Khách mang về'),
                    type: exportType
                }),
            });

            if (res.ok) {
                const result = await res.json();
                setLastExport({
                    ...result.data,
                    items: cart,
                    exportTime: new Date().toLocaleString('vi-VN')
                });
                toast.success('Xuất kho thành công');
                setTimeout(() => {
                    window.print();
                    setCart([]);
                    setNote('');
                    setCustomerName('');
                    // 3. Xóa bộ nhớ tạm sau khi xuất thành công
                    localStorage.removeItem('export_customer');
                    localStorage.removeItem('export_note');
                    localStorage.removeItem('export_cart');
                    if (activeView === 'history') fetchHistory();
                    fetchProducts();
                }, 500);
            } else {
                const err = await res.json();
                toast.error(err.error || 'Lỗi khi xuất kho');
            }
        } catch (e) {
            toast.error('Lỗi kết nối máy chủ');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrintHistoryItem = async (inv: any) => {
        try {
            // Lấy chi tiết món từ session linked với invoice
            const res = await fetch(`/api/orders?sessionId=${inv.roomSessionId || inv.RoomSessionId}`);
            const items = await res.json();
            
            setLastExport({
                ...inv,
                items: items.map((i: any) => ({ name: i.productName, quantity: i.quantity, price: i.price })),
                exportTime: new Date(inv.createdAt || inv.CreatedAt).toLocaleString('vi-VN')
            });
            
            setTimeout(() => {
                window.print();
            }, 300);
        } catch (e) { toast.error('Lỗi khi tải chi tiết để in'); }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20 lg:pb-0 font-sans">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-sm print:hidden">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-black uppercase tracking-tight text-slate-800">
                        Xuất Kho {exportType === 'gift' ? 'Tặng' : 'Mang về'}
                    </h1>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setExportType('takeaway')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${exportType === 'takeaway' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Mang về
                    </button>
                    <button
                        onClick={() => setExportType('gift')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${exportType === 'gift' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Tặng
                    </button>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="max-w-7xl mx-auto px-4 mt-4 print:hidden">
                <div className="flex gap-2 p-1 bg-slate-200/50 w-fit rounded-xl">
                    <button 
                        onClick={() => setActiveView('create')}
                        className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${activeView === 'create' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        XUẤT MỚI
                    </button>
                    <button 
                        onClick={() => setActiveView('history')}
                        className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${activeView === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        LỊCH SỬ GẦN ĐÂY
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
                {activeView === 'create' ? (
                    <div className="lg:col-span-2 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            placeholder="Tìm món để xuất..."
                            className="pl-12 h-12 bg-white rounded-2xl border-none shadow-sm text-base"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {filteredProducts.map(p => (
                            <Card
                                key={p.id}
                                onClick={() => addToCart(p)}
                                className="p-4 cursor-pointer hover:border-indigo-500 transition-all active:scale-95 border-none shadow-sm"
                            >
                                <div className="font-bold text-slate-800 mb-1 line-clamp-2 h-10 leading-tight">{p.name}</div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-indigo-600 font-black">{p.price.toLocaleString('vi-VN')}đ</span>
                                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">Tồn: {p.quantity}</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
                ) : (
                    <div className="lg:col-span-2 space-y-3">
                        {isHistoryLoading ? (
                            <div className="py-20 text-center text-slate-400 animate-pulse font-bold">Đang tải lịch sử...</div>
                        ) : history.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 font-bold bg-white rounded-3xl border-2 border-dashed">Chưa có dữ liệu xuất</div>
                        ) : (
                            history.map((inv) => (
                                <Card key={inv.id} className="p-4 flex items-center justify-between border-none shadow-sm hover:shadow-md transition-all">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${inv.id.startsWith('GFT') ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {inv.id.startsWith('GFT') ? 'TẶNG' : 'MANG VỀ'}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-400">{new Date(inv.createdAt || inv.CreatedAt).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <div className="font-bold text-slate-800 truncate">{inv.customerName || inv.CustomerName}</div>
                                        <div className="text-xs text-indigo-600 font-black">{(inv.totalPrice || 0).toLocaleString('vi-VN')}đ</div>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handlePrintHistoryItem(inv)}
                                        className="rounded-xl border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 gap-2 font-bold text-xs"
                                    >
                                        <Printer className="w-4 h-4" /> In lại
                                    </Button>
                                </Card>
                            ))
                        )}
                    </div>
                )}

                <div className="space-y-4">
                    <Card className="p-5 border-none shadow-lg rounded-3xl sticky top-24">
                        <div className="flex items-center gap-2 mb-4 text-slate-800">
                            <ClipboardList className="w-5 h-5 text-indigo-500" />
                            <span className="font-black uppercase text-sm tracking-widest">Danh sách xuất</span>
                        </div>

                        <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
                            {cart.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 italic text-sm">Chưa có sản phẩm nào</div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.productId} className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 text-sm truncate">{item.name}</div>
                                            <div className="text-xs text-slate-400">{item.price.toLocaleString('vi-VN')}đ</div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white rounded-lg p-1">
                                            <button onClick={() => updateQty(item.productId, -1)} className="w-7 h-7 flex items-center justify-center text-slate-400"><Minus className="w-3 h-3" /></button>
                                            <span className="font-black text-sm w-5 text-center">{item.quantity}</span>
                                            <button onClick={() => updateQty(item.productId, 1)} className="w-7 h-7 flex items-center justify-center text-indigo-600"><Plus className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Tên người nhận</label>
                                <Input
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="Khách hàng / Nhân viên..."
                                    className="rounded-xl bg-slate-50 border-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-indigo-500 uppercase mb-1.5 block">Ghi chú quan trọng (In ra phiếu)</label>
                                <textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    placeholder="Ví dụ: Tặng khách quen, hàng hư hỏng, mang về..."
                                    className="w-full bg-indigo-50/30 border-2 border-indigo-100 rounded-xl p-3 text-sm font-medium outline-none h-24 resize-none focus:border-indigo-300 focus:bg-white transition-all text-slate-700"
                                />
                            </div>

                            <div className="bg-indigo-600 text-white p-4 rounded-2xl">
                                <div className="flex justify-between items-center opacity-80 text-xs mb-1">
                                    <span>Hình thức:</span>
                                    <span className="font-bold uppercase">{exportType === 'gift' ? 'Tặng (0đ)' : 'Mang về'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold uppercase tracking-wider">Tổng cộng</span>
                                    <span className="text-2xl font-black">{exportType === 'gift' ? '0đ' : `${totalAmount.toLocaleString('vi-VN')}đ`}</span>
                                </div>
                            </div>

                            <Button
                                onClick={handleConfirmExport}
                                disabled={isSubmitting || cart.length === 0}
                                className="w-full h-14 bg-slate-900 hover:bg-slate-800 rounded-2xl font-black text-base gap-2 shadow-xl shadow-slate-200"
                            >
                                {isSubmitting ? 'Đang lưu...' : <><CheckCircle2 className="w-5 h-5" /> XÁC NHẬN & IN PHIẾU</>}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* ── Print Template (80mm) ── */}
            <div className="hidden print:block w-[80mm] mx-auto p-4 bg-white text-black font-bold text-[14px]" style={{ fontFamily: 'monospace' }}>
                <div className="text-center mb-4 border-b-2 border-black pb-2">
                    <h2 className="text-xl font-black uppercase">PHIẾU XUẤT KHO</h2>
                    <p className="text-xs uppercase">{exportType === 'gift' ? 'Hàng Tặng / Biếu' : 'Hàng Mang Về'}</p>
                </div>

                <div className="space-y-1 mb-4">
                    <div className="flex justify-between">
                        <span>Ngày giờ:</span>
                        <span>{lastExport?.exportTime}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Mã phiếu:</span>
                        <span>{lastExport?.id?.substring(0, 10)}</span>
                    </div>
                    {customerName && (
                        <div className="flex justify-between">
                            <span>Người nhận:</span>
                            <span>{customerName}</span>
                        </div>
                    )}
                </div>

                <table className="w-full mb-4 border-t border-black pt-2">
                    <thead>
                        <tr className="border-b border-black">
                            <th className="text-left py-1">Tên món</th>
                            <th className="text-center">SL</th>
                            <th className="text-right">T.Tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lastExport?.items?.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b border-dashed border-slate-300">
                                <td className="py-2">{item.name}</td>
                                <td className="text-center">{item.quantity}</td>
                                <td className="text-right">
                                    {exportType === 'gift' ? '0' : (item.price * item.quantity).toLocaleString('vi-VN')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="space-y-1">
                    <div className="flex justify-between text-lg font-black pt-2 border-t-2 border-black">
                        <span>TỔNG CỘNG:</span>
                        <span>{exportType === 'gift' ? '0đ' : `${totalAmount.toLocaleString('vi-VN')}đ`}</span>
                    </div>
                    {note && (
                        <div className="mt-4 pt-2 border-t-2 border-black">
                            <p className="text-[12px] font-black uppercase mb-1">Ghi chú:</p>
                            <p className="text-[18px] leading-tight font-black break-words" style={{ textTransform: 'none' }}>{note}</p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print\:block, .print\:block * { visibility: visible; }
          .print\:block { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: 80mm auto; margin: 0; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
        </div>
    );
}