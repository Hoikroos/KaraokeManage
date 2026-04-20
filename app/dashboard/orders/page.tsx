'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Search, ListOrdered, ArrowLeft } from 'lucide-react';

interface OrderItem {
    id: string;
    roomSessionId: string;
    productId: string;
    productName: string;
    price: number;
    quantity: number;
    orderedAt: Date;
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<OrderItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterType, setFilterType] = useState<'product' | 'session' | 'all'>('all');

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        filterOrders();
    }, [orders, searchTerm, filterType]);

    const fetchOrders = async () => {
        try {
            setIsLoading(true);
            setError('');

            const response = await fetch('/api/orders');
            if (!response.ok) {
                throw new Error('Không thể tải danh sách đơn hàng');
            }

            const data = await response.json();
            // Normalize the data to ensure it's an array
            const ordersArray = Array.isArray(data) ? data : [];
            setOrders(ordersArray);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi khi tải đơn hàng');
            setOrders([]);
        } finally {
            setIsLoading(false);
        }
    };

    const filterOrders = () => {
        let filtered = orders;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();

            if (filterType === 'product' || filterType === 'all') {
                filtered = filtered.filter(order =>
                    order.productName.toLowerCase().includes(term)
                );
            } else if (filterType === 'session') {
                filtered = filtered.filter(order =>
                    order.roomSessionId.toLowerCase().includes(term)
                );
            }
        }

        setFilteredOrders(filtered);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const totalItems = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => {
        return sum + (order.price * order.quantity);
    }, 0);

    return (
        <div className="min-h-screen bg-white text-slate-100">
            {/* Header */}
            <div className="bg-slate-100 border-b border-slate-300 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/products">
                            <Button
                                variant="outline"
                                size="icon"
                                className="border-slate-400 text-slate-700 hover:bg-slate-200"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2">
                                <ListOrdered className="w-8 h-8 text-blue-400" />
                                Quản lý Đơn hàng
                            </h1>
                            <p className="text-slate-600 text-sm">
                                Tìm kiếm và quản lý tất cả đơn hàng
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={fetchOrders}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Search Bar */}
                <Card className="bg-slate-100 border-slate-300 p-6 mb-8">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                <Input
                                    type="text"
                                    placeholder={
                                        filterType === 'product'
                                            ? 'Tìm kiếm theo tên sản phẩm...'
                                            : filterType === 'session'
                                                ? 'Tìm kiếm theo ID phiên...'
                                                : 'Tìm kiếm đơn hàng...'
                                    }
                                    value={searchTerm}
                                    onChange={handleSearch}
                                    className="pl-10 bg-slate-200 border-slate-400 text-slate-900 placeholder:text-slate-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant={filterType === 'all' ? 'default' : 'outline'}
                                onClick={() => setFilterType('all')}
                                className={
                                    filterType === 'all'
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'border-slate-400 text-slate-700 hover:bg-slate-200'
                                }
                            >
                                Tất cả
                            </Button>
                            <Button
                                variant={filterType === 'product' ? 'default' : 'outline'}
                                onClick={() => setFilterType('product')}
                                className={
                                    filterType === 'product'
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'border-slate-400 text-slate-700 hover:bg-slate-200'
                                }
                            >
                                Sản phẩm
                            </Button>
                            <Button
                                variant={filterType === 'session' ? 'default' : 'outline'}
                                onClick={() => setFilterType('session')}
                                className={
                                    filterType === 'session'
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'border-slate-400 text-slate-700 hover:bg-slate-200'
                                }
                            >
                                Phiên
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card className="bg-slate-100 border-slate-300 p-6">
                        <p className="text-slate-600 text-sm">Tổng đơn hàng</p>
                        <p className="text-3xl font-bold text-blue-400 mt-2">
                            {totalItems}
                        </p>
                    </Card>
                    <Card className="bg-slate-100 border-slate-300 p-6">
                        <p className="text-slate-600 text-sm">Tổng doanh thu</p>
                        <p className="text-3xl font-bold text-green-400 mt-2">
                            {totalRevenue.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫
                        </p>
                    </Card>
                    <Card className="bg-slate-100 border-slate-300 p-6">
                        <p className="text-slate-600 text-sm">Trung bình mỗi đơn</p>
                        <p className="text-3xl font-bold text-purple-400 mt-2">
                            {totalItems > 0
                                ? (totalRevenue / totalItems).toLocaleString('vi-VN', { maximumFractionDigits: 0 })
                                : 0}
                            ₫
                        </p>
                    </Card>
                </div>

                {/* Orders List */}
                {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : error ? (
                    <Card className="bg-red-900 border-red-700 p-6">
                        <p className="text-red-100">{error}</p>
                    </Card>
                ) : filteredOrders.length === 0 ? (
                    <Card className="bg-slate-100 border-slate-300 p-12 text-center">
                        <ListOrdered className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-600">
                            {searchTerm
                                ? 'Không tìm thấy đơn hàng phù hợp'
                                : 'Chưa có đơn hàng nào'}
                        </p>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-300 text-slate-600 text-sm">
                                        <th className="text-left py-4 px-4">Sản phẩm</th>
                                        <th className="text-left py-4 px-4">Giá</th>
                                        <th className="text-left py-4 px-4">Số lượng</th>
                                        <th className="text-left py-4 px-4">Tổng cộng</th>
                                        <th className="text-left py-4 px-4">Phiên ID</th>
                                        <th className="text-left py-4 px-4">Thời gian</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOrders.map((order) => {
                                        const orderDate = new Date(order.orderedAt);
                                        return (
                                            <tr
                                                key={order.id}
                                                className="border-b border-slate-300 hover:bg-slate-200/50 transition-colors"
                                            >
                                                <td className="py-4 px-4 font-medium">{order.productName}</td>
                                                <td className="py-4 px-4 text-green-400">
                                                    {order.price.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫
                                                </td>
                                                <td className="py-4 px-4">{order.quantity}</td>
                                                <td className="py-4 px-4 font-bold text-blue-400">
                                                    {(order.price * order.quantity).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫
                                                </td>
                                                <td className="py-4 px-4 text-slate-600 text-sm font-mono">
                                                    {order.roomSessionId.substring(0, 8)}...
                                                </td>
                                                <td className="py-4 px-4 text-slate-600 text-sm">
                                                    {orderDate.toLocaleString('vi-VN')}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
