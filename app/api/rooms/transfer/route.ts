// app/api/rooms/transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, oldRoomId, newRoomId } = await req.json();

    if (!sessionId || !oldRoomId || !newRoomId) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc' },
        { status: 400 }
      );
    }

    // 1. Verify the new room is actually empty
    const newRoom = await prisma.room.findUnique({
      where: { Id: newRoomId },
    });

    if (!newRoom) {
      return NextResponse.json({ error: 'Phòng mới không tồn tại' }, { status: 404 });
    }
    if (newRoom.Status !== 'empty') {
      return NextResponse.json({ error: 'Phòng mới không còn trống' }, { status: 409 });
    }

    // 2. Run transfer atomically
    await prisma.$transaction([
      // Move the session to the new room
      prisma.roomSession.updateMany({
        where: { Id: sessionId },
        data: { RoomId: newRoomId },
      }),

      // Mark old room as empty
      prisma.room.update({
        where: { Id: oldRoomId },
        data: { Status: 'empty' },
      }),

      // Mark new room as occupied
      prisma.room.update({
        where: { Id: newRoomId },
        data: { Status: 'occupied' },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[transfer] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi máy chủ' },
      { status: 500 }
    );
  }
}