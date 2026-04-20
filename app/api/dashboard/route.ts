import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { sessionId, oldRoomId, newRoomId } = await req.json();

        if (!sessionId || !oldRoomId || !newRoomId) {
            return NextResponse.json({ error: 'Thiếu thông tin yêu cầu' }, { status: 400 });
        }

        // Sử dụng transaction để đảm bảo tất cả các bước đều thành công hoặc không có gì thay đổi
        await prisma.$transaction([
            // 1. Chuyển phiên hoạt động sang phòng mới
            prisma.roomSession.update({
                where: { Id: sessionId },
                data: { RoomId: newRoomId },
            }),
            // 2. Đưa phòng cũ về trạng thái trống
            prisma.room.update({
                where: { Id: oldRoomId },
                data: { Status: 'empty' },
            }),
            // 3. Đưa phòng mới lên trạng thái đang sử dụng
            prisma.room.update({
                where: { Id: newRoomId },
                data: { Status: 'occupied' },
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Transfer room error:', error);
        return NextResponse.json({ error: 'Lỗi khi chuyển phòng' }, { status: 500 });
    }
}
