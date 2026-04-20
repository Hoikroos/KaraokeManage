import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRooms() {
  try {
    console.log('Checking rooms in database...');

    const rooms = await prisma.room.findMany();
    console.log(`Found ${rooms.length} rooms:`);
    console.table(rooms);

    const stores = await prisma.store.findMany();
    console.log(`Found ${stores.length} stores:`);
    console.table(stores);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRooms();