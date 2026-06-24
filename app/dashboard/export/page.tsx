'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/app/context';
import { Product } from '@/lib/db';
import { toast } from 'sonner';
import {
    ArrowLeft, Search, Plus, Minus, Trash2, Printer,
    Gift, ShoppingBag, ClipboardList, CheckCircle2
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
    const [editingQuantities, setEditingQuantities] = useState<{ [key: string]: string }>({});
    const [editingPrices, setEditingPrices] = useState<{ [key: string]: string }>({});

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

    useEffect(() => { localStorage.setItem('export_customer', customerName); }, [customerName]);
    useEffect(() => { localStorage.setItem('export_note', note); }, [note]);
    useEffect(() => { localStorage.setItem('export_cart', JSON.stringify(cart)); }, [cart]);
    useEffect(() => { if (activeView === 'history' && user?.storeId) fetchHistory(); }, [activeView, user]);

    const fetchHistory = async () => {
        setIsHistoryLoading(true);
        try {
            const res = await fetch(`/api/invoices?storeId=${user?.storeId}`);
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.data || []);
            const exportOnly = list.filter((inv: any) => inv.id.startsWith('TKW') || inv.id.startsWith('GFT'));
            setHistory(exportOnly.slice(0, 50));
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
                    item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
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

    const handlePriceChange = (id: string, value: string) => {
        const numericValue = value.replace(/\D/g, '');
        const formattedValue = numericValue ? parseInt(numericValue).toLocaleString('vi-VN') : '';
        setEditingPrices((prev) => ({ ...prev, [id]: formattedValue }));
    };

    const handlePriceBlur = (id: string) => {
        const val = editingPrices[id];
        if (val === undefined || val === '') {
            setEditingPrices((prev) => { const n = { ...prev }; delete n[id]; return n; });
            return;
        }
        const price = parseInt(val.replace(/\D/g, ''));
        if (!isNaN(price) && price >= 0) handleUpdateCartItem(id, { price });
        setEditingPrices((prev) => { const n = { ...prev }; delete n[id]; return n; });
    };

    const handleQuantityChange = (id: string, value: string) => {
        setEditingQuantities((prev) => ({ ...prev, [id]: value }));
    };

    const handleQuantityBlur = (id: string) => {
        const value = editingQuantities[id];
        if (value === undefined || value === '') {
            setEditingQuantities((prev) => { const n = { ...prev }; delete n[id]; return n; });
            return;
        }
        const qty = parseInt(value);
        if (!isNaN(qty)) handleUpdateCartItem(id, { quantity: qty });
        setEditingQuantities((prev) => { const n = { ...prev }; delete n[id]; return n; });
    };

    const handleUpdateCartItem = (id: string, updates: any) => {
        setCart(prev => prev.map(item =>
            item.productId === id ? { ...item, ...updates } : item
        ).filter(item => item.quantity > 0));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.productId !== id));
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
                    customerName: customerName || (exportType === 'gift' ? 'Tặng khách' : 'Bán mang về'),
                    type: exportType
                }),
            });
            if (res.ok) {
                const result = await res.json();
                setLastExport({ ...result.data, items: cart, exportTime: new Date().toLocaleString('vi-VN') });
                setTimeout(() => {
                    window.print();
                    setCart([]);
                    setNote('');
                    setCustomerName('');
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
            const res = await fetch(`/api/orders?sessionId=${inv.roomSessionId || inv.RoomSessionId}`);
            const items = await res.json();
            setLastExport({
                ...inv,
                items: items.map((i: any) => ({ name: i.productName, quantity: i.quantity, price: i.price })),
                exportTime: new Date(inv.createdAt || inv.CreatedAt).toLocaleString('vi-VN')
            });
            setTimeout(() => { window.print(); }, 300);
        } catch (e) { toast.error('Lỗi khi tải chi tiết để in'); }
    };

    /* ── Tính dữ liệu in ── */
    const printItems = lastExport?.items || [];
    const printTotal = printItems.reduce((s: number, i: any) => s + (Number(i.price) * Number(i.quantity)), 0) || totalAmount;
    const isGiftPrint = lastExport?.id?.startsWith('GFT') || exportType === 'gift';
    const printCustomerName = (() => {
        const fullName = lastExport?.customerName || lastExport?.CustomerName || customerName || '';
        return fullName.split(': ')[0].split(' [')[0];
    })();
    const printNote = (() => {
        const fullName = lastExport?.customerName || lastExport?.CustomerName || '';
        const parts = fullName.split(' | Ghichu: ');
        return parts.length > 1 ? parts[1] : (lastExport?.note || note);
    })();

    return (
        <div className="min-h-screen font-sans" style={{ background: '#f8f9fb' }}>

            {/* ── Header (ẩn khi in) ── */}
            <div id="no-print" className="bg-white border-b sticky top-0 z-30 shadow-sm" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        onClick={() => router.push('/dashboard')}
                        style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                        className="hover:bg-slate-100"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 style={{ fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#1e293b', margin: 0 }}>
                        Xuất Kho {exportType === 'gift' ? 'Tặng' : 'Mang Về'}
                    </h1>
                </div>
                <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 12, gap: 2 }}>
                    <button
                        onClick={() => setExportType('takeaway')}
                        style={{
                            padding: '6px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
                            background: exportType === 'takeaway' ? '#fff' : 'transparent',
                            color: exportType === 'takeaway' ? '#4f46e5' : '#64748b',
                            boxShadow: exportType === 'takeaway' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                            display: 'flex', alignItems: 'center', gap: 5
                        }}
                    >
                        <ShoppingBag size={12} /> Mang về
                    </button>
                    <button
                        onClick={() => setExportType('gift')}
                        style={{
                            padding: '6px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
                            background: exportType === 'gift' ? '#fff' : 'transparent',
                            color: exportType === 'gift' ? '#e11d48' : '#64748b',
                            boxShadow: exportType === 'gift' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                            display: 'flex', alignItems: 'center', gap: 5
                        }}
                    >
                        <Gift size={12} /> Tặng
                    </button>
                </div>
            </div>

            {/* ── Body (ẩn khi in) ── */}
            <div id="no-print" style={{ display: 'flex', height: 'calc(100vh - 57px)', overflow: 'hidden' }}>

                {/* Left panel */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }} className="no-scrollbar">

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            onClick={() => setActiveView('create')}
                            style={{
                                padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', transition: 'all 0.18s',
                                background: activeView === 'create' ? '#4f46e5' : 'rgba(99,102,241,0.08)',
                                color: activeView === 'create' ? '#fff' : '#6b7280'
                            }}
                        >
                            XUẤT MỚI
                        </button>
                        <button
                            onClick={() => setActiveView('history')}
                            style={{
                                padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', transition: 'all 0.18s',
                                background: activeView === 'history' ? '#4f46e5' : 'rgba(99,102,241,0.08)',
                                color: activeView === 'history' ? '#fff' : '#6b7280',
                                display: 'flex', alignItems: 'center', gap: 6
                            }}
                        >
                            LỊCH SỬ GẦN ĐÂY
                        </button>
                    </div>

                    {activeView === 'create' ? (
                        <>
                            {/* Search */}
                            <div style={{ position: 'relative' }}>
                                <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#9ca3af' }} />
                                <input
                                    placeholder="Tìm món để xuất..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{
                                        width: '100%', height: 44, paddingLeft: 44, paddingRight: 16,
                                        borderRadius: 14, border: 'none', background: '#fff',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', fontSize: 14,
                                        outline: 'none', color: '#1e293b'
                                    }}
                                />
                            </div>

                            {/* Product grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                                {filteredProducts.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        style={{
                                            background: '#fff', borderRadius: 14, padding: 14,
                                            cursor: 'pointer', border: '1.5px solid transparent',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#4f46e5'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
                                    >
                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13, lineHeight: 1.35, height: 36, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                            {p.name}
                                        </div>
                                        <div style={{ color: '#4f46e5', fontWeight: 800, fontSize: 13, marginTop: 6 }}>
                                            {p.price.toLocaleString('vi-VN')}đ
                                        </div>
                                        <span style={{ fontSize: 10, fontWeight: 700, background: '#f1f5f9', color: '#64748b', padding: '2px 7px', borderRadius: 5, display: 'inline-block', marginTop: 4 }}>
                                            Tồn: {p.quantity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {isHistoryLoading ? (
                                <div style={{ padding: '80px 0', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Đang tải lịch sử...</div>
                            ) : history.length === 0 ? (
                                <div style={{ padding: '80px 0', textAlign: 'center', color: '#94a3b8', fontWeight: 700, background: '#fff', borderRadius: 24, border: '2px dashed #e5e7eb' }}>
                                    Chưa có dữ liệu xuất
                                </div>
                            ) : (
                                history.map((inv) => (
                                    <div key={inv.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <span style={{
                                                    fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 5,
                                                    background: inv.id.startsWith('GFT') ? '#ffe4e6' : '#dbeafe',
                                                    color: inv.id.startsWith('GFT') ? '#be123c' : '#1d4ed8'
                                                }}>
                                                    {inv.id.startsWith('GFT') ? 'TẶNG' : 'MANG VỀ'}
                                                </span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
                                                    {new Date(inv.createdAt || inv.CreatedAt).toLocaleString('vi-VN')}
                                                </span>
                                            </div>
                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 400 }}>
                                                {inv.customerName || inv.CustomerName}
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: '#4f46e5', marginTop: 2 }}>
                                                {(inv.totalPrice || 0).toLocaleString('vi-VN')}đ
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handlePrintHistoryItem(inv)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '8px 14px', borderRadius: 11, border: '1px solid #e5e7eb',
                                                background: '#fff', fontSize: 12, fontWeight: 700,
                                                cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap'
                                            }}
                                            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#eef2ff'; b.style.color = '#4f46e5'; b.style.borderColor = '#c7d2fe'; }}
                                            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#fff'; b.style.color = '#374151'; b.style.borderColor = '#e5e7eb'; }}
                                        >
                                            <Printer size={14} /> In lại
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Right panel */}
                <div style={{ width: 300, borderLeft: '1px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* Cart list */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }} className="no-scrollbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <ClipboardList size={18} style={{ color: '#6366f1' }} />
                            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1e293b' }}>Danh sách xuất</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>Chưa có sản phẩm nào</div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.productId} style={{ background: '#f8f9fb', borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <input
                                                    type="text"
                                                    style={{ width: 72, fontSize: 11, fontWeight: 500, color: '#94a3b8', background: 'transparent', border: 'none', outline: 'none', padding: '0 2px' }}
                                                    value={editingPrices[item.productId] !== undefined ? editingPrices[item.productId] : item.price.toLocaleString('vi-VN')}
                                                    onChange={(e) => handlePriceChange(item.productId, e.target.value)}
                                                    onBlur={() => handlePriceBlur(item.productId)}
                                                />
                                                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>đ</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 9, padding: 2 }}>
                                                <button onClick={() => updateQty(item.productId, -1)} style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', borderRadius: 7 }}>
                                                    <Minus size={11} />
                                                </button>
                                                <input
                                                    type="text"
                                                    style={{ width: 28, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#1e293b', border: 'none', background: 'transparent', outline: 'none' }}
                                                    value={editingQuantities[item.productId] ?? item.quantity}
                                                    onChange={(e) => handleQuantityChange(item.productId, e.target.value)}
                                                    onBlur={() => handleQuantityBlur(item.productId)}
                                                />
                                                <button onClick={() => updateQty(item.productId, 1)} style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', borderRadius: 7 }}>
                                                    <Plus size={11} />
                                                </button>
                                            </div>
                                            <button onClick={() => removeFromCart(item.productId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 4, borderRadius: 7 }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#d1d5db'; }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Bottom form */}
                    <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #f1f5f9' }}>
                        <div>
                            <label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 4, display: 'block' }}>Tên người nhận</label>
                            <input
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                placeholder="Khách hàng / Nhân viên..."
                                style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 11, border: 'none', background: '#f8f9fb', fontSize: 13, outline: 'none', color: '#1e293b' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6366f1', marginBottom: 4, display: 'block' }}>Ghi chú quan trọng (In ra phiếu)</label>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Ví dụ: Tặng khách quen, hàng hư hỏng, mang về..."
                                style={{ width: '100%', padding: '10px 12px', borderRadius: 11, border: '2px solid #e0e7ff', background: 'rgba(238,240,255,0.3)', fontSize: 13, outline: 'none', resize: 'none', height: 76, lineHeight: 1.5, color: '#1e293b' }}
                            />
                        </div>

                        <div style={{ background: '#4f46e5', color: '#fff', borderRadius: 14, padding: '14px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.75, marginBottom: 4 }}>
                                <span>Hình thức:</span>
                                <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{exportType === 'gift' ? 'Tặng (0đ)' : 'Mang về'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tổng cộng</span>
                                <span style={{ fontSize: 22, fontWeight: 900 }}>
                                    {exportType === 'gift' ? '0đ' : `${totalAmount.toLocaleString('vi-VN')}đ`}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleConfirmExport}
                            disabled={isSubmitting || cart.length === 0}
                            style={{
                                width: '100%', height: 50, borderRadius: 14, border: 'none',
                                background: isSubmitting || cart.length === 0 ? '#94a3b8' : '#0f172a',
                                color: '#fff', fontSize: 14, fontWeight: 800, cursor: isSubmitting || cart.length === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                letterSpacing: '0.01em', transition: 'background 0.2s'
                            }}
                        >
                            {isSubmitting ? 'Đang lưu...' : <><CheckCircle2 size={18} /> XÁC NHẬN & IN PHIẾU</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                PHIẾU IN — dùng id="print-area", KHÔNG dùng Tailwind
                print:block vì Tailwind escape không hoạt động trong
                <style jsx global> với @media print
            ══════════════════════════════════════════════════════ */}
            <div id="print-area" style={{ display: 'none' }}>
                <div style={{ width: '72mm', margin: '0 auto', padding: '4mm', background: '#fff', color: '#000', fontFamily: 'monospace', fontSize: 13 }}>

                    {/* Tiêu đề */}
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 10 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>PHIẾU XUẤT KHO</div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', marginTop: 2 }}>
                            {isGiftPrint ? 'Hàng Tặng / Biếu' : 'Hàng Mang Về'}
                        </div>
                    </div>

                    {/* Thông tin */}
                    <div style={{ marginBottom: 10, lineHeight: 1.8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Ngày giờ:</span>
                            <span style={{ fontWeight: 700 }}>{lastExport?.exportTime}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Mã phiếu:</span>
                            <span style={{ fontWeight: 700 }}>{lastExport?.id?.substring(0, 10)}</span>
                        </div>
                        {printCustomerName && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Người nhận:</span>
                                <span style={{ fontWeight: 700 }}>{printCustomerName}</span>
                            </div>
                        )}
                    </div>

                    {/* Bảng sản phẩm */}
                    <table style={{ width: '100%', marginBottom: 10, borderCollapse: 'collapse', borderTop: '1px solid #000' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #000' }}>
                                <th style={{ textAlign: 'left', padding: '4px 0', fontSize: 12 }}>Tên món</th>
                                <th style={{ textAlign: 'center', padding: '4px 2px', fontSize: 12 }}>SL</th>
                                <th style={{ textAlign: 'right', padding: '4px 0', fontSize: 12 }}>T.Tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printItems.map((item: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: '1px dashed #aaa' }}>
                                    <td style={{ padding: '5px 0', fontSize: 13 }}>{item.name}</td>
                                    <td style={{ textAlign: 'center', padding: '5px 2px', fontSize: 13 }}>{item.quantity}</td>
                                    <td style={{ textAlign: 'right', padding: '5px 0', fontSize: 13 }}>
                                        {(Number(item.price) * Number(item.quantity)).toLocaleString('vi-VN')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Tổng */}
                    <div style={{ borderTop: '2px solid #000', paddingTop: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900 }}>
                            <span>TỔNG GIÁ TRỊ:</span>
                            <span>{printTotal.toLocaleString('vi-VN')}đ</span>
                        </div>
                        {isGiftPrint && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900 }}>
                                <span>THANH TOÁN:</span>
                                <span>0đ</span>
                            </div>
                        )}
                    </div>

                    {/* Ghi chú */}
                    {printNote && (
                        <div style={{ marginTop: 12, borderTop: '2px solid #000', paddingTop: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', marginBottom: 4 }}>Ghi chú:</div>
                            <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.4, wordBreak: 'break-word' }}>{printNote}</div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
        /* ── Ẩn giao diện khi in ── */
        @media print {
          #no-print { display: none !important; }
          #print-area { display: block !important; }
          body { background: #fff !important; }
          @page { size: 80mm auto; margin: 0; }
        }

        /* ── Scrollbar ẩn ── */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
        </div>
    );
}