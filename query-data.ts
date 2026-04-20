import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function queryData() {
  try {
    console.log('=== STORES ===');
    const stores = await prisma.store.findMany();
    console.table(stores);

    console.log('\n=== ROOMS ===');
    const rooms = await prisma.room.findMany({
      include: { Store: true }
    });
    console.table(rooms.map(r => ({
      Id: r.Id,
      StoreName: r.Store.Name,
      RoomNumber: r.RoomNumber,
      Capacity: r.Capacity,
      Status: r.Status,
      PricePerHour: r.PricePerHour
    })));

    console.log('\n=== PRODUCTS ===');
    const products = await prisma.product.findMany({
      include: { Store: true }
    });
    console.table(products.map(p => ({
      Id: p.Id,
      StoreName: p.Store.Name,
      Name: p.Name,
      Category: p.Category,
      Price: p.Price
    })));

  } catch (error) {
    console.error('Error querying data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

queryData();