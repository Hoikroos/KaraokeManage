'use client';

import { useAuth } from '@/app/context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { BarChart3, Users, Building2, Receipt } from 'lucide-react';

export default function StatisticsPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user && user.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [user, router]);

    if (!user || user.role !== 'admin') {
        return null;
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Thống kê tổng quan</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm">Tổng chi nhánh</p>
                            <p className="text-2xl font-bold text-slate-900">5</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-green-50 p-3 rounded-lg">
                            <Users className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm">Tổng nhân viên</p>
                            <p className="text-2xl font-bold text-slate-900">25</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-50 p-3 rounded-lg">
                            <Receipt className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm">Doanh thu tháng</p>
                            <p className="text-2xl font-bold text-slate-900">150M</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-orange-50 p-3 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm">Đơn hàng hôm nay</p>
                            <p className="text-2xl font-bold text-slate-900">12</p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}