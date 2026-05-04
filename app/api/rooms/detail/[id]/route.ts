import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;

    // 1. Lấy thông tin phòng
    const room = await prisma.room.findUnique({
      where: { Id: roomId },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // 2. Lấy Store, Sản phẩm và Session hiện tại song song để tối ưu tốc độ
    const [store, products, session] = await Promise.all([
      prisma.store.findUnique({
        where: { Id: room.StoreId },
      }),
      prisma.product.findMany({
        where: { StoreId: room.StoreId },
      }),
      prisma.roomSession.findFirst({
        where: {
          RoomId: roomId,
          Status: { in: ['active', 'pending', 'paused'] },
        },
        orderBy: { StartTime: 'desc' },
      }),
    ]);

    // 3. Nếu có session, lấy luôn các món đã gọi
    let orderItems: any[] = [];
    if (session) {
      orderItems = await prisma.orderItem.findMany({
        where: { RoomSessionId: session.Id },
        orderBy: { OrderedAt: 'asc' },
      });
    }

    // Trả về object gộp đúng định dạng frontend yêu cầu
    return NextResponse.json({
      room: {
        id: room.Id,
        storeId: room.StoreId,
        roomNumber: room.RoomNumber,
        capacity: room.Capacity,
        pricePerHour: Number(room.PricePerHour),
        status: room.Status,
      },
      store: store ? { id: store.Id, name: store.Name } : null,
      products: products.map(p => ({
        id: p.Id,
        name: p.Name,
        category: p.Category,
        price: Number(p.Price),
        quantity: p.Quantity,
      })),
      session: session ? {
        id: session.Id,
        status: session.Status,
        startTime: session.StartTime,
        endTime: session.EndTime,
        customerName: session.CustomerName || 'Khách lẻ',
        updatedAt: session.UpdatedAt,
      } : null,
      orderItems: orderItems.map(item => ({
        id: item.Id,
        productId: item.ProductId,
        productName: item.ProductName,
        price: Number(item.Price),
        quantity: item.Quantity,
        orderedAt: item.OrderedAt,
      })),
    });
  } catch (error) {
    console.error('Room Detail API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
