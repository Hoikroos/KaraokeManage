import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { Id: invoiceId },
      include: {
        RoomSession: {
          include: {
            OrderItems: true,
          },
        },
        InvoiceItems: true,
      },
    });

    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Transform to match the expected format
    const transformedInvoice = {
      id: invoice.Id,
      roomSessionId: invoice.RoomSessionId,
      storeId: invoice.StoreId,
      roomId: invoice.RoomId,
      startTime: invoice.StartTime,
      endTime: invoice.EndTime,
      roomCost: Number(invoice.RoomCost),
      totalPrice: Number(invoice.TotalPrice),
      status: invoice.Status,
      createdAt: invoice.CreatedAt,
      updatedAt: invoice.UpdatedAt,
      customerName: invoice.CustomerName ?? '',
      items: ((invoice.InvoiceItems && invoice.InvoiceItems.length > 0)
        ? invoice.InvoiceItems
        : invoice.RoomSession.OrderItems).map(item => ({
          id: item.Id,
          roomSessionId: item.RoomSessionId,
          productId: item.ProductId,
          productName: item.ProductName,
          price: Number(item.Price),
          quantity: item.Quantity,
          orderedAt: item.OrderedAt,
        })),
    };

    return Response.json(transformedInvoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const { status } = await request.json();

    const invoice = await prisma.invoice.findUnique({
      where: { Id: invoiceId },
    });

    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { Id: invoiceId },
      data: { Status: status },
      include: {
        RoomSession: {
          include: {
            OrderItems: true,
          },
        },
        InvoiceItems: true,
      },
    });

    // Transform to match the expected format
    const transformedInvoice = {
      id: updatedInvoice.Id,
      roomSessionId: updatedInvoice.RoomSessionId,
      storeId: updatedInvoice.StoreId,
      roomId: updatedInvoice.RoomId,
      startTime: updatedInvoice.StartTime,
      endTime: updatedInvoice.EndTime,
      roomCost: Number(updatedInvoice.RoomCost),
      totalPrice: Number(updatedInvoice.TotalPrice),
      status: updatedInvoice.Status,
      createdAt: updatedInvoice.CreatedAt,
      updatedAt: updatedInvoice.UpdatedAt,
      customerName: updatedInvoice.CustomerName ?? '',
      items: ((updatedInvoice.InvoiceItems && updatedInvoice.InvoiceItems.length > 0)
        ? updatedInvoice.InvoiceItems
        : updatedInvoice.RoomSession.OrderItems).map(item => ({
          id: item.Id,
          roomSessionId: item.RoomSessionId,
          productId: item.ProductId,
          productName: item.ProductName,
          price: Number(item.Price),
          quantity: item.Quantity,
          orderedAt: item.OrderedAt,
        })),
    };

    return Response.json(transformedInvoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
