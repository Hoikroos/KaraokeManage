import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');
    const type = searchParams.get('type') || 'daily';
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');

    if (!storeId) {
        return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
    }

    try {
        // ── 1. Xác định khoảng thời gian ──────────────────────────────────────
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (startParam) {
            // Người dùng tự chọn ngày
            startDate = new Date(startParam);
            startDate.setHours(0, 0, 0, 0);
            endDate = endParam ? new Date(endParam) : new Date();
            endDate.setHours(23, 59, 59, 999);
        } else {
            // Bộ lọc nhanh theo type
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);

            startDate = new Date(now);
            if (type === 'daily') {
                startDate.setHours(0, 0, 0, 0);
            } else if (type === 'weekly') {
                // Thứ 2 đầu tuần hiện tại
                const day = now.getDay(); // 0=CN
                const diff = day === 0 ? -6 : 1 - day;
                startDate.setDate(now.getDate() + diff);
                startDate.setHours(0, 0, 0, 0);
            } else if (type === 'monthly') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            } else if (type === 'yearly') {
                startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            } else {
                startDate.setHours(0, 0, 0, 0);
            }
        }

        // ── 2. Sản phẩm của cửa hàng ──────────────────────────────────────────
        const products = await prisma.product.findMany({
            where: { StoreId: storeId },
        });

        // ── 3. Số lượng ĐÃ BÁN trong kỳ (qua OrderItem) ──────────────────────
        const sessions = await prisma.roomSession.findMany({
            where: {
                StoreId: storeId,
                StartTime: { gte: startDate, lte: endDate },
                Status: { not: 'cancelled' },
            },
            select: { Id: true },
        });
        const sessionIds = sessions.map(s => s.Id);

        const salesInPeriod = sessionIds.length > 0
            ? await prisma.orderItem.groupBy({
                by: ['ProductId'],
                where: { RoomSessionId: { in: sessionIds } },
                _sum: { Quantity: true },
            })
            : [];

        // ── 4. Inventory logs ──────────────────────────────────────────────────
        let logs: any[] = [];
        let restocksInPeriod: any[] = [];   // nhập THỰC SỰ trong kỳ (loại log khởi tạo)
        let allRestocksEver: any[] = [];     // tất cả nhập thực sự TỪ TRƯỚC ĐẾN TRƯỚC KỲ (để tính tồn đầu)

        if ((prisma as any).inventoryLog) {
            // Điều kiện loại trừ log khởi tạo / import hàng loạt
            const excludeInit = {
                NOT: {
                    OR: [
                        { Type: 'init' },
                        { Type: 'import' },
                        { Type: 'create' },
                        { Note: { contains: 'Khởi tạo sản phẩm' } },
                        { Note: { contains: 'Nhập mới từ file Excel' } },
                        { Note: { contains: 'Nhập mới từ file' } },
                    ],
                },
            };

            // 4a. Tất cả logs trong kỳ để hiển thị lịch sử
            logs = await (prisma as any).inventoryLog.findMany({
                where: { StoreId: storeId, CreatedAt: { gte: startDate, lte: endDate } },
                include: { product: true },
                orderBy: { CreatedAt: 'desc' },
            });

            // 4b. Nhập THỰC SỰ trong kỳ (bỏ log khởi tạo)
            restocksInPeriod = await (prisma as any).inventoryLog.groupBy({
                by: ['ProductId'],
                where: {
                    StoreId: storeId,
                    CreatedAt: { gte: startDate, lte: endDate },
                    Quantity: { gt: 0 },  // chỉ lấy nhập vào, không lấy xuất/hư
                    ...excludeInit,
                },
                _sum: { Quantity: true },
            });

            // 4c. Nhập THỰC SỰ TRƯỚC kỳ này (để tính tồn đầu kỳ)
            allRestocksEver = await (prisma as any).inventoryLog.groupBy({
                by: ['ProductId'],
                where: {
                    StoreId: storeId,
                    CreatedAt: { lt: startDate },  // trước kỳ
                    Quantity: { gt: 0 },
                    ...excludeInit,
                },
                _sum: { Quantity: true },
            });
        }

        // ── 5. Số lượng đã bán TRƯỚC kỳ (để tính tồn đầu kỳ) ─────────────────
        const sessionsBefore = await prisma.roomSession.findMany({
            where: {
                StoreId: storeId,
                StartTime: { lt: startDate },
                Status: { not: 'cancelled' },
            },
            select: { Id: true },
        });
        const sessionIdsBefore = sessionsBefore.map(s => s.Id);

        const salesBefore = sessionIdsBefore.length > 0
            ? await prisma.orderItem.groupBy({
                by: ['ProductId'],
                where: { RoomSessionId: { in: sessionIdsBefore } },
                _sum: { Quantity: true },
            })
            : [];

        // ── 6. Tính stats ──────────────────────────────────────────────────────
        const stats = products.map(p => {
            // Đã bán trong kỳ
            const saleInPeriodRec = salesInPeriod.find(s => (s as any).ProductId === p.Id);
            const totalQuantity = Number((saleInPeriodRec as any)?._sum?.Quantity ?? 0);

            // Nhập thực sự trong kỳ
            const restockInPeriodRec = restocksInPeriod.find(r => (r as any).ProductId === p.Id);
            const totalRestocked = Number((restockInPeriodRec as any)?._sum?.Quantity ?? 0);

            // Nhập thực sự trước kỳ
            const restockBeforeRec = allRestocksEver.find(r => (r as any).ProductId === p.Id);
            const restockedBefore = Number((restockBeforeRec as any)?._sum?.Quantity ?? 0);

            // Đã bán trước kỳ
            const saleBeforeRec = salesBefore.find(s => (s as any).ProductId === p.Id);
            const soldBefore = Number((saleBeforeRec as any)?._sum?.Quantity ?? 0);

            // Tồn đầu kỳ = tồn hiện tại + đã bán trong kỳ - nhập trong kỳ
            // Hoặc tính từ gốc: khởi tạo + tất cả nhập trước - tất cả bán trước
            // Cách 2 chính xác hơn:
            const openingStock = p.Quantity - totalRestocked + totalQuantity;
            // openingStock = tồn cuối kỳ - nhập kỳ + bán kỳ = tồn đầu kỳ ✓

            return {
                productId: p.Id,
                productName: p.Name,
                category: p.Category,
                openingStock: Math.max(0, openingStock),
                totalRestocked,      // Nhập trong kỳ
                totalQuantity,       // Bán trong kỳ
                totalRevenue: totalQuantity * Number(p.Price || 0),
                currentStock: p.Quantity,  // Tồn hiện tại (cuối kỳ)
            };
        });

        return NextResponse.json({
            stats,
            period: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                type,
            },
            logs: logs.map((l: any) => ({
                id: l.Id,
                productName: l.product?.Name || l.ProductName || 'Sản phẩm đã xóa',
                quantity: l.Quantity,
                createdAt: l.CreatedAt,
                type: l.Type,
                note: l.Note,
            })),
        });

    } catch (error) {
        console.error('Inventory Stats API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}