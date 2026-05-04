import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const roomId = params.id;

    try {
        // 1. Lấy thông tin phòng
        const room = await prisma.room.findUnique({
            where: { Id: roomId },
        });

        if (!room) {
            return NextResponse.json({ error: 'Không tìm thấy phòng' }, { status: 404 });
        }

        // 2. Chạy song song việc lấy Chi nhánh, Sản phẩm và Session hiện tại
        const [store, products, session] = await Promise.all([
            prisma.store.findUnique({ where: { Id: room.StoreId } }),
            prisma.product.findMany({ where: { StoreId: room.StoreId } }),
            prisma.roomSession.findFirst({
                where: {
                    RoomId: roomId,
                    Status: { in: ['active', 'pending', 'paused'] },
                },
                orderBy: {
                    StartTime: 'desc',
                },
            }),
        ]);

        // 3. Nếu có session đang chạy, lấy danh sách món đã gọi
        let orders: any[] = [];
        if (session) {
            orders = await prisma.orderItem.findMany({
                where: { RoomSessionId: session.Id },
                orderBy: { OrderedAt: 'asc' },
            });
        }

        // Trả về gói dữ liệu tổng hợp
        return NextResponse.json({
            room,
            store,
            products,
            session,
            orders,
        });
    } catch (error) {
        console.error('Error fetching consolidated room details:', error);
        return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
    }
}