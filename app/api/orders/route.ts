import { prisma } from '@/lib/prisma';

async function getProductWithStock(productId: string) {
  try {
    const product = await prisma.product.findUnique({
      where: { Id: productId },
    });
    if (!product) return null;
    return {
      id: product.Id,
      name: product.Name,
      price: Number(product.Price),
      quantity: product.Quantity,
      source: 'sql' as const,
    };
  } catch (error) {
    console.log('Product not found in SQL Server, trying mock data');
  }

  // Fallback to mock data if needed
  return null;
}

export async function POST(request: Request) {
  try {
    const { roomSessionId, productId, quantity } = await request.json();
    const parsedQuantity = Number(quantity);

    if (!roomSessionId || !productId || isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return Response.json({ error: 'Invalid order payload' }, { status: 400 });
    }

    const product = await getProductWithStock(productId);
    if (!product) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.quantity < parsedQuantity) {
      return Response.json({ error: 'Số lượng trong kho không đủ' }, { status: 400 });
    }

    const orderItem = await prisma.orderItem.create({
      data: {
        Id: Date.now().toString(),
        RoomSessionId: roomSessionId,
        ProductId: productId,
        ProductName: product.name,
        Price: product.price,
        Quantity: parsedQuantity,
        OrderedAt: new Date(),
      },
    });

    return Response.json({
      id: orderItem.Id,
      roomSessionId: orderItem.RoomSessionId,
      productId: orderItem.ProductId,
      productName: orderItem.ProductName,
      price: Number(orderItem.Price),
      quantity: orderItem.Quantity,
      orderedAt: orderItem.OrderedAt,
    });
  } catch (error) {
    console.error('Error in POST /api/orders:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, quantity } = await request.json();
    const parsedQuantity = Number(quantity);

    if (!id) {
      return Response.json({ error: 'Order item ID is required' }, { status: 400 });
    }

    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return Response.json({ error: 'Invalid quantity' }, { status: 400 });
    }

    const existingItem = await prisma.orderItem.findUnique({
      where: { Id: id },
    });

    if (!existingItem) {
      return Response.json({ error: 'Order item not found' }, { status: 404 });
    }

    const delta = parsedQuantity - existingItem.Quantity;
    if (delta > 0) {
      const product = await getProductWithStock(existingItem.ProductId);
      if (!product) {
        return Response.json({ error: 'Product not found' }, { status: 404 });
      }
      if (product.quantity < delta) {
        return Response.json({ error: 'Số lượng trong kho không đủ' }, { status: 400 });
      }
    }

    const updatedItem = await prisma.orderItem.update({
      where: { Id: id },
      data: { Quantity: parsedQuantity },
    });

    return Response.json({
      id: updatedItem.Id,
      roomSessionId: updatedItem.RoomSessionId,
      productId: updatedItem.ProductId,
      productName: updatedItem.ProductName,
      price: Number(updatedItem.Price),
      quantity: updatedItem.Quantity,
      orderedAt: updatedItem.OrderedAt,
    });
  } catch (error) {
    console.error('Error in PUT /api/orders:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return Response.json({ error: 'Order item ID is required' }, { status: 400 });
    }

    const orderItem = await prisma.orderItem.findUnique({
      where: { Id: id },
    });

    if (!orderItem) {
      return Response.json({ error: 'Order item not found' }, { status: 404 });
    }

    await prisma.orderItem.delete({
      where: { Id: id },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/orders:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // If sessionId is provided, return orders for that session
    if (sessionId) {
      const items = await prisma.orderItem.findMany({
        where: { RoomSessionId: sessionId },
      });

      return Response.json(items.map(item => ({
        id: item.Id,
        roomSessionId: item.RoomSessionId,
        productId: item.ProductId,
        productName: item.ProductName,
        price: Number(item.Price),
        quantity: item.Quantity,
        orderedAt: item.OrderedAt,
      })));
    }

    // Otherwise, return all orders
    const allItems = await prisma.orderItem.findMany();
    return Response.json(allItems.map(item => ({
      id: item.Id,
      roomSessionId: item.RoomSessionId,
      productId: item.ProductId,
      productName: item.ProductName,
      price: Number(item.Price),
      quantity: item.Quantity,
      orderedAt: item.OrderedAt,
    })));
  } catch (error) {
    console.error('Error in GET /api/orders:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
