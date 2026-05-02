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

        // ── 3. Lấy dữ liệu bán hàng tại phòng (OrderItem) ────────────────────
        // Lấy tất cả hóa đơn từ StartDate đến Tận bây giờ để phục vụ tính Tồn đầu
        const allInvoicesSinceStart = await prisma.invoice.findMany({
            where: { StoreId: storeId, CreatedAt: { gte: startDate } },
            select: { CreatedAt: true, RoomSessionId: true },
        });

        const sessionIdsInPeriod = allInvoicesSinceStart
            .filter(inv => inv.CreatedAt <= endDate)
            .map(inv => inv.RoomSessionId).filter((id): id is string => !!id);

        const sessionIdsSinceStart = allInvoicesSinceStart
            .map(inv => inv.RoomSessionId).filter((id): id is string => !!id);

        // Bán trong kỳ [Start, End]
        const salesInPeriod = sessionIdsInPeriod.length > 0
            ? await prisma.orderItem.groupBy({
                by: ['ProductId'],
                where: { RoomSessionId: { in: sessionIdsInPeriod } },
                _sum: { Quantity: true },
            }) : [];

        // Bán từ lúc Start đến Tận bây giờ (để tính tồn đầu)
        const salesSinceStart = sessionIdsSinceStart.length > 0
            ? await prisma.orderItem.groupBy({
                by: ['ProductId'],
                where: { RoomSessionId: { in: sessionIdsSinceStart } },
                _sum: { Quantity: true },
            }) : [];

        // ── 4. Lấy dữ liệu kho (InventoryLog) ────────────────────────────────
        const excludeInit = {
            NOT: {
                OR: [
                    { Type: 'init' }, { Type: 'import' }, { Type: 'create' },
                    { Note: { contains: 'Khởi tạo' } }, { Note: { contains: 'Excel' } }
                ]
            },
        };

        let logs: any[] = [];
        let restocksInPeriod: any[] = [];
        let exportsInPeriod: any[] = [];

        // Logs để hiển thị danh sách
        logs = await (prisma as any).inventoryLog.findMany({
            where: { StoreId: storeId, CreatedAt: { gte: startDate, lte: endDate } },
            include: { product: true },
            orderBy: { CreatedAt: 'desc' },
        });

        // Nhập thực sự trong kỳ
        restocksInPeriod = await (prisma as any).inventoryLog.groupBy({
            by: ['ProductId'],
            where: { StoreId: storeId, CreatedAt: { gte: startDate, lte: endDate }, Quantity: { gt: 0 }, ...excludeInit },
            _sum: { Quantity: true },
        });

        // Xuất lẻ (Mang về/Tặng) trong kỳ
        exportsInPeriod = await (prisma as any).inventoryLog.groupBy({
            by: ['ProductId'],
            where: { StoreId: storeId, CreatedAt: { gte: startDate, lte: endDate }, Quantity: { lt: 0 }, OR: [{ Type: 'export' }, { Type: { contains: 'gift' } as any }] },
            _sum: { Quantity: true },
        });

        // TẤT CẢ biến động log từ lúc Start đến Tận bây giờ (để tính tồn đầu)
        const logsSinceStart = await (prisma as any).inventoryLog.groupBy({
            by: ['ProductId'],
            where: { StoreId: storeId, CreatedAt: { gte: startDate }, ...excludeInit },
            _sum: { Quantity: true },
        });

        const stats = products.map(p => {
            const saleInPeriodRec = salesInPeriod.find((s: any) => s.ProductId === p.Id);
            const roomSales = Number((saleInPeriodRec as any)?._sum?.Quantity ?? 0);
            const exportInPeriodRec = exportsInPeriod.find((e: any) => e.ProductId === p.Id);
            const totalExported = Math.abs(Number((exportInPeriodRec as any)?._sum?.Quantity ?? 0));
            const totalQuantity = roomSales + totalExported;

            const restockInPeriodRec = restocksInPeriod.find((r: any) => r.ProductId === p.Id);
            const totalRestocked = Number((restockInPeriodRec as any)?._sum?.Quantity ?? 0);

            // TÍNH TOÁN TỒN ĐẦU KỲ CHÍNH XÁC:
            // Lấy tất cả những gì đã bán/xuất/nhập từStartDate đến Tận Bây Giờ
            const soldSinceStartRec = salesSinceStart.find((s: any) => s.ProductId === p.Id);
            const totalSoldSinceStart = Number((soldSinceStartRec as any)?._sum?.Quantity ?? 0);

            const logsSinceStartRec = logsSinceStart.find((l: any) => l.ProductId === p.Id);
            const netLogChangeSinceStart = Number((logsSinceStartRec as any)?._sum?.Quantity ?? 0);

            // Công thức: Tồn đầu = Tồn hiện tại - (Tổng nhập từ đó đến nay) + (Tổng bán từ đó đến nay)
            // Lưu ý: netLogChange đã bao gồm Nhập (+) và Xuất lẻ (-)
            const openingStock = p.Quantity - netLogChangeSinceStart + totalSoldSinceStart;

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