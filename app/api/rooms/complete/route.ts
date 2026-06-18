import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { roomId, invoiceId } = await request.json();

    // Update room status to empty
    await prisma.room.update({
      where: { Id: roomId },
      data: { Status: 'empty' },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error completing room:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
