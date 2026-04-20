import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Lấy tất cả hóa đơn đã thanh toán
        const invoices = await prisma.invoice.findMany({
            where: { Status: 'paid' },
            select: {
                CustomerName: true,
                TotalPrice: true,
                CreatedAt: true,
            },
            orderBy: { CreatedAt: 'desc' }
        });

        // Nhóm dữ liệu theo tên khách hàng (Logic xử lý thống kê)
        const statsMap = new Map();

        invoices.forEach((inv) => {
            const name = (inv.CustomerName || 'Khách lẻ').trim();

            if (!statsMap.has(name)) {
                statsMap.set(name, {
                    name,
                    visitCount: 0,
                    totalSpent: 0,
                    lastVisit: inv.CreatedAt,
                });
            }

            const stat = statsMap.get(name);
            stat.visitCount += 1;
            stat.totalSpent += inv.TotalPrice;

            // Cập nhật ngày ghé thăm cuối cùng nếu hóa đơn này mới hơn
            if (new Date(inv.CreatedAt) > new Date(stat.lastVisit)) {
                stat.lastVisit = inv.CreatedAt;
            }
        });

        const result = Array.from(statsMap.values());
        return NextResponse.json(result);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch customer stats' }, { status: 500 });
    }
}