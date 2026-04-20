import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');
    const type = searchParams.get('type') || 'monthly';
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');

    if (!storeId) {
        return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
    }

    try {
        let startDate = new Date();
        let endDate = new Date();

        if (startParam) {
            startDate = new Date(startParam);
            startDate.setHours(0, 0, 0, 0);
            if (endParam) {
                endDate = new Date(endParam);
                endDate.setHours(23, 59, 59, 999);
            } else {
                endDate.setHours(23, 59, 59, 999);
            }
        } else {
            const now = new Date();
            startDate.setHours(0, 0, 0, 0);
            if (type === 'weekly') startDate.setDate(now.getDate() - 7);
            else if (type === 'monthly') startDate.setMonth(now.getMonth() - 1);
            else if (type === 'yearly') startDate.setFullYear(now.getFullYear() - 1);
            // default daily: startDate là 00:00:00 hôm nay, endDate là now
        }

        // Khởi tạo logs là mảng rỗng để tránh lỗi khi map và kiểm tra model tồn tại để tránh crash
        let logs: any[] = [];
        let restocks: any[] = [];
        if ((prisma as any).inventoryLog) {
            const logWhere = { StoreId: storeId, CreatedAt: { gte: startDate, lte: endDate } };

            logs = await (prisma as any).inventoryLog.findMany({
                where: logWhere,
                include: { product: true },
                orderBy: { CreatedAt: 'desc' }
            });

            restocks = await (prisma as any).inventoryLog.groupBy({
                by: ['ProductId'],
                where: logWhere,
                _sum: { Quantity: true }
            });
        }

        const products = await prisma.product.findMany({
            where: { StoreId: storeId },
        });

        // Fix 2: Lấy danh sách ID phiên làm việc trước vì groupBy không hỗ trợ lọc qua quan hệ (RoomSession: { ... })
        const sessions = await prisma.roomSession.findMany({
            where: {
                StoreId: storeId,
                StartTime: { gte: startDate, lte: endDate },
                Status: { not: 'cancelled' }
            },
            select: { Id: true }
        });
        const sessionIds = sessions.map(s => s.Id);

        const sales = await prisma.orderItem.groupBy({
            by: ['ProductId'],
            where: {
                RoomSessionId: { in: sessionIds }
            },
            _sum: {
                Quantity: true, // Sum số lượng bán
            }
        });

        const stats = products.map(p => {
            const saleRecord = sales.find(s => (s as any).ProductId === p.Id);
            const totalQuantity = Number((saleRecord as any)?._sum?.Quantity ?? 0);

            const restockRecord = restocks.find(r => (r as any).ProductId === p.Id);
            const totalRestocked = Number((restockRecord as any)?._sum?.Quantity ?? 0);

            return {
                productId: p.Id,
                productName: p.Name,
                category: p.Category,
                openingStock: p.Quantity - totalRestocked + totalQuantity,
                totalRestocked: totalRestocked,
                totalQuantity: totalQuantity, // Đây là số lượng bán ra
                totalRevenue: totalQuantity * Number(p.Price || 0),
                currentStock: p.Quantity
            };
        });

        return NextResponse.json({
            stats,
            logs: logs.map((l: any) => ({ // Thêm : any để xóa lỗi đỏ
                id: l.Id,
                productName: l.product?.Name || (l as any).ProductName || 'Sản phẩm đã xóa',
                quantity: l.Quantity,
                createdAt: l.CreatedAt,
                type: l.Type,
                note: l.Note
            }))
        });
    } catch (error) {
        console.error('Inventory Stats API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}