'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// import { AuthContext } from '@/app/context';
// import { useContext } from 'react';
import { useAuth } from '@/app/context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store } from '@/lib/db';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit2, Trash2, ArrowLeft, ListOrdered, Search, Filter, Package, ShoppingBag, Utensils, Beaker, Cookie, Layers, CheckCircle2, AlertCircle, Store as StoreIcon } from 'lucide-react';

interface Product {
  id: string;
  storeId: string;
  name: string;
  category: 'food' | 'drink' | 'dry' | 'towel';
  price: number;
  quantity: number;
  note?: string;
  createdAt: Date;
}

const categoryOptions = [
  { value: 'food', label: 'Đồ Ăn', icon: <Utensils className="w-4 h-4" />, color: 'bg-orange-400' },
  { value: 'drink', label: 'Đồ uống, bia', icon: <Beaker className="w-4 h-4" />, color: 'bg-blue-400' },
  { value: 'dry', label: 'Đồ Khô', icon: <Package className="w-4 h-4" />, color: 'bg-amber-600' },
  { value: 'towel', label: 'Khăn Lạnh', icon: <Layers className="w-4 h-4" />, color: 'bg-cyan-400' },
] as const;

export default function ProductsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: 'food' as Product['category'],
    price: '',
    quantity: '',
    note: '',
    logNote: '',
  });

  // Redirect admin to their dashboard
  useEffect(() => {
    if (user?.role === 'admin') {
      router.push('/dashboard/admin');
    }
  }, [user, router]);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await fetch('/api/admin/stores');
        let data = await res.json();

        if (!Array.isArray(data)) {
          return;
        }

        if (user?.role !== 'admin' && user?.storeId) {
          data = data.filter((store: Store) => store.id === user.storeId);
        }

        setStores(data);
        const userStore = data.find((store: Store) => store.id === user?.storeId);
        const initialStoreId = userStore?.id || data[0]?.id || '';
        setSelectedStoreId(initialStoreId);
      } catch (error) {
        console.error('Error fetching stores:', error);
      }
    };

    if (user) {
      fetchStores();
    }
  }, [user]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!selectedStoreId) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/products?storeId=${selectedStoreId}`);
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedStoreId]);

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        category: product.category,
        price: product.price.toString(),
        quantity: '0', // Reset về 0 khi edit để người dùng nhập số lượng CỘNG THÊM
        note: product.note || '',
        logNote: '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        category: 'food',
        price: '',
        quantity: '',
        note: '',
        logNote: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      category: 'food',
      price: '',
      quantity: '',
      note: '',
      logNote: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.price || !formData.quantity) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (!selectedStoreId) {
      toast.error('Chưa chọn quán để lưu sản phẩm');
      return;
    }

    const inputQty = parseInt(formData.quantity, 10);

    try {
      if (editingProduct) {
        // Update product
        const res = await fetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingProduct.id,
            name: formData.name,
            category: formData.category,
            price: parseFloat(formData.price),
            quantity: (editingProduct.quantity || 0) + inputQty, // Cộng dồn số lượng vào kho cũ
            note: formData.note,
            logNote: formData.logNote,
          }),
        });

        if (res.ok) {
          const updated = await res.json();
          setProducts(
            products.map((p) => (p.id === updated.id ? updated : p))
          );
          toast.success('Cập nhật sản phẩm thành công');
          handleCloseDialog();
        }
      } else {
        // Create new product
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: selectedStoreId,
            name: formData.name,
            category: formData.category,
            price: parseFloat(formData.price),
            quantity: inputQty,
            note: formData.note,
            logNote: formData.logNote,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setProducts([...products, data]);
          toast.success('Thêm sản phẩm thành công');
          handleCloseDialog();
        } else {
          console.error('Failed to add product:', data);
          toast.error(data.error || 'Lỗi khi thêm sản phẩm');
        }
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Lỗi khi lưu sản phẩm');
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Xóa sản phẩm?',
      text: 'Bạn chắc chắn muốn xóa sản phẩm này? Hành động này không thể hoàn tác.',
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
      const res = await fetch(`/api/products?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setProducts(products.filter((p) => p.id !== id));
        toast.success('Xóa sản phẩm thành công');
      } else {
        toast.error('Lỗi khi xóa sản phẩm');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Lỗi khi xóa sản phẩm');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (loading) {
    return <div className="p-8 text-center">Đang tải...</div>;
  }

  const groupedProducts = categoryOptions.map((category) => ({
    ...category,
    items: (Array.isArray(products) ? products : []).filter(
      (p) =>
        p.category === category.value &&
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  }));

  const selectedStore = stores.find((store) => store.id === selectedStoreId);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase">
                Thực Đơn & Kho
              </h1>
            </div>
          </div>
          {/* Thanh tìm kiếm - Luôn hiển thị trên cả mobile và desktop */}
          <div className="flex-1 max-w-md md:mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Tìm nhanh món ăn, đồ uống..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-10 bg-slate-100 border-none rounded-full focus:ring-2 focus:ring-indigo-200 w-full text-base md:text-sm"
              />
            </div>
          </div>

          {/* Nút quay lại (Desktop) + Tên user */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden sm:block mr-2">
              <p className="text-slate-900 text-xs font-bold leading-none">{user?.name}</p>
            </div>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="ghost"
              className="text-slate-600 hover:text-indigo-600 flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden md:inline">Quay Lại</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-row items-center justify-between bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-slate-100 p-3 rounded-xl text-slate-600">
              <StoreIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight uppercase">Kho hàng</h1>
              {selectedStore && (
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                  Chi nhánh: {selectedStore.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => handleOpenDialog()}
                  className="bg-indigo-600 hover:bg-indigo-700 h-10 sm:h-11 px-3 sm:px-6 rounded-xl font-bold gap-2 shadow-lg shadow-indigo-100 transition-all hover:-translate-y-0.5"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Thêm sản phẩm</span>
                  <span className="sm:hidden text-xs">Thêm</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[450px] rounded-3xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? 'Nhập kho / Chỉnh sửa' : 'Thêm Sản Phẩm Mới'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingProduct ? `Bạn đang điều chỉnh sản phẩm: ${editingProduct.name}` : 'Điền thông tin để tạo món mới trong thực đơn.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      Tên Sản Phẩm
                    </label>
                    <Input
                      placeholder="Ví dụ: Nước ngọt Coca"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                      className="bg-slate-50 border-slate-100 h-11 text-base md:text-sm"
                    />
                  </div>
                  {editingProduct && (
                    <div>
                      <label className="block text-xs font-bold text-indigo-600 uppercase mb-2">
                        Ghi chú nhập/xuất kho (Lý do hư, mất...)
                      </label>
                      <Input
                        placeholder="Ví dụ: Hàng bị vỡ, khách làm mất, trả hàng NCC..."
                        value={formData.logNote}
                        onChange={(e) => setFormData({ ...formData, logNote: e.target.value })}
                        className="bg-indigo-50 border-indigo-100 h-11 font-medium text-base md:text-sm"
                      />
                    </div>
                  )}

                  {editingProduct && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase">Số lượng hiện có:</span>
                        <span className="font-black text-slate-900">{editingProduct.quantity} đơn vị</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
                        <span className="text-indigo-600 font-bold uppercase">Tổng dự kiến sau nhập:</span>
                        <span className="font-black text-indigo-700 text-sm">
                          {(editingProduct.quantity || 0) + (parseInt(formData.quantity) || 0)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      Loại
                    </label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          category: value as Product['category'],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Giá bán (VNĐ)
                      </label>
                      <Input
                        type="text"
                        placeholder="50000"
                        value={formData.price ? Number(formData.price).toLocaleString('vi-VN') : ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, price: val });
                        }}
                        min="0"
                        required
                        className="bg-slate-50 border-slate-100 h-11 text-base md:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2 text-indigo-600">
                        {editingProduct ? 'Số lượng nhập thêm/xuất' : 'Số lượng kho'}
                      </label>
                      <Input
                        type="number"
                        placeholder={editingProduct ? "0" : "10"}
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, quantity: e.target.value })
                        }
                        required
                        className="bg-indigo-50 border-indigo-100 h-11 font-bold text-indigo-700 text-base md:text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6">
                    <Button type="submit" className="flex-1 bg-indigo-600 h-12 font-bold rounded-xl">
                      {editingProduct ? 'Lưu Thay Đổi' : 'Thêm Món'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-12 font-bold rounded-xl border-slate-200"
                      onClick={handleCloseDialog}
                    >
                      Hủy Bỏ
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {user?.role === 'admin' && stores.length > 1 && (
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <Filter className="w-4 h-4 text-slate-400 ml-2" />
            <div className="flex flex-wrap gap-2">
              {stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => setSelectedStoreId(store.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedStoreId === store.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                >
                  {store.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {groupedProducts.map((category) => (
          <div key={category.value}>
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className={`p-1.5 rounded-lg text-white ${category.color}`}>{category.icon}</div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                {category.label} <span className="text-slate-300 ml-1">/ {category.items.length} món</span>
              </h2>
            </div>
            {category.items.length === 0 ? (
              <Card className="bg-slate-50 border-dashed border-2 border-slate-200 shadow-none">
                <CardContent className="py-10">
                  <p className="text-center text-slate-600">
                    Danh mục {category.label.toLowerCase()} đang trống
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                {category.items.map((product) => (
                  <Card key={product.id} className="bg-white border-none shadow-sm hover:shadow-xl hover:shadow-indigo-50 transition-all rounded-3xl group relative overflow-hidden ring-1 ring-slate-100">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${category.color}`} />
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{product.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="space-y-6">
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Giá bán</div>
                            <div className="text-xl font-black text-slate-900 tracking-tighter">
                              {product.price.toLocaleString('vi-VN')}<span className="text-sm ml-1 text-slate-400 font-medium">đ</span>
                            </div>
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider ${product.quantity > 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {product.quantity > 5 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            Kho: {product.quantity ?? 0}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-10 gap-2 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl font-bold text-xs"
                            onClick={() => handleOpenDialog(product)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Nhập Kho
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-10 px-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
