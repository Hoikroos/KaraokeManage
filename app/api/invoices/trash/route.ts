import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET — lấy danh sách hóa đơn trong thùng rác (DeletedAt != null)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId') || '';
        let rows: any[] = [];
        // Sử dụng $queryRaw để tránh lỗi SQL Injection và tối ưu JOIN
        if (storeId && storeId !== 'all') {
            rows = await prisma.$queryRaw`
SELECT 
    i.Id, 
    i.CustomerName, 
    i.StoreId, 
    i.TotalPrice, 
    i.CreatedAt, 
    i.DeletedAt, 
    r.RoomNumber
FROM Invoices i
LEFT JOIN Room r ON i.RoomId = r.Id
WHERE i.DeletedAt IS NOT NULL AND i.StoreId = ${storeId}
ORDER BY i.DeletedAt DESC
`;
        } else {
            rows = await prisma.$queryRaw`
SELECT 
    i.Id, 
    i.CustomerName, 
    i.StoreId, 
    i.TotalPrice, 
    i.CreatedAt, 
    i.DeletedAt, 
    r.RoomNumber
FROM Invoices i
LEFT JOIN Room r ON i.RoomId = r.Id
WHERE i.DeletedAt IS NOT NULL
ORDER BY i.DeletedAt DESC
`;
        }
        return NextResponse.json(
            rows.map((inv: any) => ({
                // Map linh hoạt cả trường hợp DB trả về tên cột viết hoa hoặc viết thường
                id: inv.Id || inv.id,
                customerName: inv.CustomerName || inv.customerName || 'Khách lẻ',
                storeId: inv.StoreId || inv.storeId,
                roomNumber: inv.RoomNumber || inv.roomNumber || '',
                totalPrice: Number(inv.TotalPrice || inv.totalprice || 0),
                createdAt: inv.CreatedAt || inv.createdat,
                deletedAt: inv.DeletedAt || inv.deletedat,
            }))
        );
    } catch (error) {
        console.error('Trash fetch error:', error);
        return Response.json({ error: 'Server error' }, { status: 500 });
    }
}

// PATCH — khôi phục hóa đơn: set DeletedAt = NULL
export async function PATCH(request: NextRequest) {
    try {
        const { id, all, storeId } = await request.json();

        if (all) {
            await prisma.invoice.updateMany({
                where: {
                    DeletedAt: { not: null },
                    ...(storeId && storeId !== 'all' ? { StoreId: storeId } : {})
                },
                data: { DeletedAt: null }
            });
            return Response.json({ success: true });
        }

        if (!id) {
            return Response.json({ error: 'ID hóa đơn là bắt buộc' }, { status: 400 });
        }

        await prisma.invoice.update({
            where: { Id: id },
            data: { DeletedAt: null }
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error('Restore error:', error);
        return Response.json({ error: 'Lỗi khi khôi phục hóa đơn' }, { status: 500 });
    }
}

// DELETE — xóa vĩnh viễn khỏi database (chỉ dùng từ trang thùng rác)
export async function DELETE(request: NextRequest) {
    try {
        const { id, all, storeId } = await request.json();

        if (all) {
            await prisma.invoice.deleteMany({
                where: {
                    DeletedAt: { not: null },
                    ...(storeId && storeId !== 'all' ? { StoreId: storeId } : {})
                }
            });
            return Response.json({ success: true });
        }

        if (!id) {
            return Response.json({ error: 'ID hóa đơn là bắt buộc' }, { status: 400 });
        }

        await prisma.invoice.delete({
            where: { Id: id },
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error('Hard delete error:', error);
        return Response.json({ error: 'Lỗi khi xóa vĩnh viễn hóa đơn' }, { status: 500 });
    }
}