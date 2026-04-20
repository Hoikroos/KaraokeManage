import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const users = await prisma.user.findMany({
            orderBy: { CreatedAt: 'desc' }
        });

        // Chuyển đổi PascalCase từ DB sang camelCase cho Frontend
        const formatted = users.map(u => ({
            id: u.Id,
            email: u.Email,
            name: u.Name,
            role: u.Role,
            storeId: u.StoreId,
            createdAt: u.CreatedAt
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('Fetch Users Error:', error);
        return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { name, email, password, storeId, role = 'user' } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Vui lòng nhập đầy đủ Name, Email và Password' }, { status: 400 });
        }

        const existing = await prisma.user.findUnique({ where: { Email: email } });
        if (existing) {
            return NextResponse.json({ error: 'Email này đã tồn tại trên hệ thống' }, { status: 400 });
        }

        const user = await prisma.user.create({
            data: {
                Id: `USR-${Date.now()}`,
                Name: name,
                Email: email,
                Password: password,
                StoreId: (role === 'admin' || !storeId) ? null : storeId,
                Role: role
            }
        });

        return NextResponse.json({ id: user.Id, name: user.Name, email: user.Email });
    } catch (error) {
        return NextResponse.json({ error: 'Lỗi khi tạo tài khoản' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Thiếu ID' }, { status: 400 });

    try {
        await prisma.user.delete({ where: { Id: id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Lỗi khi xóa tài khoản' }, { status: 500 });
    }
}