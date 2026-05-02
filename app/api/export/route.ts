import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { storeId, items, note, customerName, type } = body;

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'Không có sản phẩm để xuất' }, { status: 400 });
        }

        // Transaction: Trừ kho và tạo hóa đơn
        const result = await prisma.$transaction(async (tx) => {
            let totalValue = 0;

            for (const item of items) {
                const product = await tx.product.findUnique({ where: { Id: item.productId } });
                if (!product || product.Quantity < item.quantity) {
                    throw new Error(`Sản phẩm ${product?.Name || 'không xác định'} không đủ tồn kho`);
                }

                // 1. Trừ số lượng sản phẩm
                await tx.product.update({
                    where: { Id: item.productId },
                    data: { Quantity: { decrement: item.quantity } },
                });

                // 2. Ghi log kho (nếu có bảng InventoryLog)
                if ((tx as any).inventoryLog) {
                    await (tx as any).inventoryLog.create({
                        data: {
                            Id: 'LOG' + Date.now().toString() + Math.random().toString(36).substring(7),
                            ProductId: item.productId,
                            StoreId: storeId,
                            Quantity: -item.quantity,
                            Type: type === 'gift' ? 'gift' : 'export',
                            Note: `Xuất ${type === 'gift' ? 'Tặng' : 'Mang về'}: ${note || ''}`,
                            CreatedAt: new Date(),
                        },
                    });
                }

                totalValue += item.price * item.quantity;
            }

            // Vì DB không có cột Note, ta gộp thông tin món vào CustomerName để xem lại trong lịch sử
            const itemsSummary = items.map((i: any) => `${i.name} x${i.quantity}`).join(', ');
            const baseName = customerName || (type === 'gift' ? 'Khách tặng' : 'Khách mang về');
            const finalName = `${baseName} [${itemsSummary}]`.substring(0, 255);

            // 0. Đảm bảo phòng ảo "EXTERNAL" tồn tại để không bị lỗi Foreign Key
            // Chúng ta dùng upsert để nếu phòng đã có rồi thì không báo lỗi
            await tx.room.upsert({
                where: { Id: 'EXTERNAL' },
                update: {},
                create: {
                    Id: 'EXTERNAL',
                    StoreId: storeId,
                    RoomNumber: 'MANG VỀ',
                    Capacity: 0,
                    PricePerHour: 0,
                    Status: 'empty'
                }
            });

            // 3. Tạo hóa đơn để hiển thị trong lịch sử
            const invoice = await tx.invoice.create({
                data: {
                    Id: (type === 'gift' ? 'GFT' : 'TKW') + Date.now().toString(),
                    StoreId: storeId,
                    TotalPrice: type === 'gift' ? 0 : totalValue,
                    CustomerName: finalName,
                    CreatedAt: new Date(),
                    // Bổ sung các trường bắt buộc để sửa lỗi TypeScript
                    RoomId: 'EXTERNAL', // Gán giá trị mặc định cho hóa đơn ngoài phòng
                    StartTime: new Date(),
                    EndTime: new Date(),
                    RoomCost: 0,
                    // Tạo một RoomSession ảo để thỏa mãn ràng buộc Database
                    RoomSession: {
                        create: {
                            Id: 'SES_EX' + Date.now().toString(),
                            StoreId: storeId,
                            RoomId: 'EXTERNAL',
                            StartTime: new Date(),
                            Status: 'completed'
                        }
                    },
                } as any,
            });

            return invoice;
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error('Export Error:', error);
        return NextResponse.json({ error: error.message || 'Lỗi hệ thống' }, { status: 500 });
    }
}