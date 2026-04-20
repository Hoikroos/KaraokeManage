import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập Email và Mật khẩu' }, { status: 400 });
    }

    // 1. Tìm người dùng theo Email
    const user = await prisma.user.findUnique({
      where: { Email: email }
    });

    if (!user || user.Password !== password) {
      return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 });
    }

    return NextResponse.json({
      id: user.Id,
      name: user.Name,
      email: user.Email,
      role: user.Role,
      storeId: user.StoreId
    });
  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}