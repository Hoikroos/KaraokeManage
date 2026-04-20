import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { roomSessionId, startTime: requestStartTime, endTime: requestEndTime, customerName } = await request.json();

    // Get room session with room and store details
    const session = await prisma.roomSession.findUnique({
      where: { Id: roomSessionId },
      include: { Room: true },
    });

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const room = session.Room;
    if (!room) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    // Get order items
    const items = await prisma.orderItem.findMany({
      where: { RoomSessionId: roomSessionId },
    });

    const startTime = requestStartTime ? new Date(requestStartTime) : session.StartTime;
    const endTime = requestEndTime ? new Date(requestEndTime) : new Date();

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return Response.json({ error: 'Invalid start or end time' }, { status: 400 });
    }

    if (endTime.getTime() <= startTime.getTime()) {
      return Response.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    const durationMinutes = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    const roomCost = Math.ceil((durationMinutes * Number(room.PricePerHour)) / 60);

    // Calculate items cost
    const itemsCost = items.reduce((total, item) => total + Number(item.Price) * item.Quantity, 0);
    const subtotal = roomCost + itemsCost;
    const totalPrice = subtotal;

    // Thực hiện trong transaction để đảm bảo tính nhất quán dữ liệu
    const [invoice] = await prisma.$transaction([
      prisma.invoice.create({
        data: {
          Id: Date.now().toString(),
          RoomSessionId: roomSessionId,
          CustomerName: customerName || 'Khách lẻ',
          StoreId: session.StoreId,
          RoomId: session.RoomId,
          StartTime: startTime,
          EndTime: endTime,
          RoomCost: roomCost,
          TotalPrice: totalPrice,
          Status: 'paid',
        },
      }),
      // Cập nhật trạng thái session
      prisma.roomSession.update({
        where: { Id: roomSessionId },
        data: { Status: 'completed' },
      }),
      // Đưa phòng về trạng thái trống
      prisma.room.update({
        where: { Id: session.RoomId },
        data: { Status: 'empty' },
      }),
    ]);

    // Return invoice with items for display
    return Response.json({
      ...invoice,
      items: items.map(item => ({
        id: item.Id,
        roomSessionId: item.RoomSessionId,
        productId: item.ProductId,
        productName: item.ProductName,
        price: Number(item.Price),
        quantity: item.Quantity,
        orderedAt: item.OrderedAt,
      })),
    });
  } catch (error) {
    console.error('Invoice creation error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const id = searchParams.get('id');

    const invoices = await prisma.invoice.findMany({
      where: id ? { Id: id } : {
        ...(storeId ? { StoreId: storeId } : {}),
        DeletedAt: null, // Chỉ lấy những hóa đơn chưa bị xóa (không nằm trong thùng rác)
      },
      include: {
        RoomSession: {
          include: {
            OrderItems: true,
            Room: true,
          },
        },
      },
      orderBy: { CreatedAt: 'desc' },
    });

    // Transform to match the expected format
    const transformedInvoices = invoices.map(invoice => ({
      id: invoice.Id,
      roomSessionId: invoice.RoomSessionId,
      customerName: invoice.CustomerName,
      storeId: invoice.StoreId,
      roomId: invoice.RoomId,
      roomNumber: (invoice.RoomSession?.Room as any)?.RoomNumber || (invoice.RoomSession?.Room as any)?.roomNumber || '',
      startTime: invoice.StartTime,
      endTime: invoice.EndTime,
      roomCost: Number(invoice.RoomCost),
      totalPrice: Number(invoice.TotalPrice),
      status: invoice.Status,
      createdAt: invoice.CreatedAt,
      updatedAt: invoice.UpdatedAt,
      // Thêm kiểm tra an toàn ở đây để tránh crash API
      items: (invoice.RoomSession?.OrderItems || []).map(item => ({
        id: item.Id,
        roomSessionId: item.RoomSessionId,
        productId: item.ProductId,
        productName: item.ProductName,
        price: Number(item.Price),
        quantity: item.Quantity,
        orderedAt: item.OrderedAt,
      })),
    }));

    // Nếu yêu cầu theo ID đơn lẻ, trả về object thay vì mảng
    if (id && transformedInvoices.length > 0) {
      return Response.json(transformedInvoices[0]);
    }

    return Response.json(transformedInvoices);
  } catch (error) {
    console.error('Invoice fetch error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}


export async function DELETE(request: NextRequest) {
  try {
    const { id, all, storeId, permanent } = await request.json();
    const now = new Date();

    // Xử lý xóa hàng loạt (Bulk delete)
    if (all) {
      if (permanent) {
        // Xóa vĩnh viễn khỏi CSDL
        if (storeId && storeId !== 'all') {
          await prisma.$executeRaw`DELETE FROM Invoices WHERE StoreId = ${storeId}`;
        } else {
          await prisma.$executeRaw`DELETE FROM Invoices`;
        }
      } else {
        // Xóa tạm (Soft delete) - Chuyển vào thùng rác
        if (storeId && storeId !== 'all') {
          await prisma.$executeRaw`UPDATE Invoices SET DeletedAt = ${now} WHERE StoreId = ${storeId} AND DeletedAt IS NULL`;
        } else {
          await prisma.$executeRaw`UPDATE Invoices SET DeletedAt = ${now} WHERE DeletedAt IS NULL`;
        }
      }
      return Response.json({ success: true });
    }

    if (!id) {
      return Response.json({ error: 'ID hóa đơn là bắt buộc' }, { status: 400 });
    }

    if (permanent) {
      await prisma.$executeRaw`DELETE FROM Invoices WHERE Id = ${id}`;
    } else {
      await prisma.$executeRaw`UPDATE Invoices SET DeletedAt = ${now} WHERE Id = ${id}`;
    }

    return Response.json({ success: true });
  } catch (error) {
  }   console.error('Invoice delete error:');
    return Response.json({ error: 'Server error' }, { status: 500 });
  }

