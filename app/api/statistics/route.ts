import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return Response.json({ error: 'storeId is required' }, { status: 400 });
    }

    // Get revenue by date
    const revenueByDate = db.getRevenueByStore(storeId);

    // Get total stats
    const invoices = db.getInvoicesByStoreId(storeId);
    const rooms = db.getRoomsByStoreId(storeId);
    const occupiedCount = rooms.filter((r) => r.status === 'occupied').length;
    const emptyCount = rooms.filter((r) => r.status === 'empty').length;

    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalPrice, 0);
    const paidRevenue = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.totalPrice, 0);

    return Response.json({
      revenueByDate,
      totalRevenue,
      paidRevenue,
      pendingRevenue: totalRevenue - paidRevenue,
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter((inv) => inv.status === 'paid').length,
      pendingInvoices: invoices.filter((inv) => inv.status === 'pending').length,
      totalRooms: rooms.length,
      occupiedRooms: occupiedCount,
      emptyRooms: emptyCount,
      averageRevenue:
        invoices.length > 0
          ? Math.round(totalRevenue / invoices.length)
          : 0,
    });
  } catch (error) {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
