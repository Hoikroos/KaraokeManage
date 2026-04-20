import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { roomId, invoiceId } = await request.json();

    // 1. Tìm hóa đơn và thông tin phiên liên quan (bao gồm danh sách món ăn)
    const invoice = await prisma.invoice.findUnique({
      where: { Id: invoiceId },
      include: {
        RoomSession: {
          include: {
            OrderItems: true
          }
        }
      }
    });

    if (invoice && invoice.RoomSession) {
      // 2. Duyệt qua từng món ăn trong phiên và trừ số lượng tương ứng trong kho
      for (const item of invoice.RoomSession.OrderItems) {
        await prisma.product.update({
          where: { Id: item.ProductId },
          data: {
            Quantity: {
              decrement: item.Quantity
            }
          }
        });
      }
    }

    // Update room status to empty
    await prisma.room.update({
      where: { Id: roomId },
      data: { Status: 'empty' },
    });

    // Update invoice status to paid
    await prisma.invoice.update({
      where: { Id: invoiceId },
      data: { Status: 'paid' },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error completing room:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
