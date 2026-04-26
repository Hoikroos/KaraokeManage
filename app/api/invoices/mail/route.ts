import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { invoiceId, targetEmail } = body;

    // --- 1. Validate đầu vào ---
    if (!invoiceId || !targetEmail) {
      return NextResponse.json(
        { error: 'Thiếu thông tin hóa đơn hoặc email' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      return NextResponse.json(
        { error: 'Địa chỉ email không hợp lệ' },
        { status: 400 }
      );
    }

    // --- 2. Kiểm tra biến môi trường SMTP ---
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS; // xoá khoảng trắng nếu có

    if (!smtpUser || !smtpPass) {
      console.error('[Mail Error] Biến môi trường SMTP_USER hoặc SMTP_PASS còn thiếu trong tệp .env');
      return NextResponse.json(
        { error: 'Hệ thống chưa cấu hình email gửi đi' },
        { status: 500 }
      );
    }

    // --- 3. Truy vấn hóa đơn từ DB ---
    // 3. Truy vấn hóa đơn từ DB (Hỗ trợ linh hoạt cả Id và id)
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { Id: invoiceId },
          { id: invoiceId } as any
        ]
      } as any,
      include: {
        RoomSession: {
          include: {
            Room: true,
            OrderItems: true,
          },
        },
        Store: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: `Không tìm thấy hóa đơn với ID: ${invoiceId}` },
        { status: 404 }
      );
    }

    // --- 4. Tạo transporter với Gmail + App Password ---
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false // Hỗ trợ kết nối trên một số môi trường server khắt khe
      },
      connectionTimeout: 10000, // 10 giây timeout
    });

    // Xác minh kết nối SMTP trước khi gửi
    await transporter.verify();

    // --- 5. Chuẩn bị dữ liệu cho email ---
    // Ép kiểu sang any để tránh lỗi đỏ khi truy cập các thuộc tính không có trong định nghĩa gốc của Prisma
    const inv = invoice as any;

    const orderItems = inv.RoomSession?.OrderItems ?? inv.RoomSession?.orderItems ?? [];
    const roomNumber = inv.RoomSession?.Room?.RoomNumber || inv.RoomSession?.Room?.roomNumber || 'N/A';
    const storeName = inv.Store?.Name || inv.Store?.name || 'Karaoke';
    const storeAddress = inv.Store?.Address || inv.Store?.address || 'Đang cập nhật';
    const storePhone = inv.Store?.Phone || inv.Store?.phone || 'Đang cập nhật';
    const customerName = inv.CustomerName || inv.customerName || 'Quý khách';
    
    const totalPrice = Number(inv.TotalPrice ?? inv.totalPrice ?? 0);
    const roomCost = Number(inv.RoomCost || inv.roomCost || 0);
    const invoiceCode = String(inv.Id || inv.id || '').substring(0, 8).toUpperCase();

    const itemsHtml = orderItems
      .map((item: any) => {
        const name = item.ProductName ?? item.productName ?? 'Dịch vụ';
        const qty = Number(item.Quantity ?? item.quantity ?? 0);
        const price = Number(item.Price ?? item.price ?? 0);
        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #edf2f7;">${name}</td>
            <td style="padding:10px;border-bottom:1px solid #edf2f7;text-align:center;">${qty}</td>
            <td style="padding:10px;border-bottom:1px solid #edf2f7;text-align:right;">
              ${(price * qty).toLocaleString('vi-VN')} đ
            </td>
          </tr>`;
      })
      .join('');

    // --- 6. Soạn & gửi email ---
    await transporter.sendMail({
      from: `"${storeName}" <${smtpUser}>`,
      to: targetEmail,
      subject: `Hóa đơn thanh toán - Phòng ${roomNumber}`,
      html: `
        <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <div style="background-color:#4f46e5;padding:20px;text-align:center;color:white;">
            <h1 style="margin:0;font-size:24px;">HÓA ĐƠN THANH TOÁN</h1>
            <p style="margin:5px 0 0;opacity:0.8;">Mã HD: #${invoiceCode}</p>
          </div>

          <!-- Body -->
          <div style="padding:30px;background-color:white;">
            <p>Chào <b>${customerName}</b>,</p>
            <p>Cảm ơn bạn đã sử dụng dịch vụ tại <b>${storeName}</b>. Dưới đây là thông tin chi tiết hóa đơn:</p>

            <table style="width:100%;border-collapse:collapse;margin-top:20px;">
              <thead>
                <tr style="background-color:#f8fafc;">
                  <th style="text-align:left;padding:10px;border-bottom:2px solid #e2e8f0;">Mục</th>
                  <th style="text-align:center;padding:10px;border-bottom:2px solid #e2e8f0;">SL</th>
                  <th style="text-align:right;padding:10px;border-bottom:2px solid #e2e8f0;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:10px;border-bottom:1px solid #edf2f7;">Tiền phòng (${roomNumber})</td>
                  <td style="padding:10px;border-bottom:1px solid #edf2f7;text-align:center;">1</td>
                  <td style="padding:10px;border-bottom:1px solid #edf2f7;text-align:right;">${roomCost.toLocaleString('vi-VN')} đ</td>
                </tr>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding:20px 10px 10px;text-align:right;font-weight:bold;font-size:18px;">
                    TỔNG CỘNG:
                  </td>
                  <td style="padding:20px 10px 10px;text-align:right;font-weight:bold;font-size:20px;color:#4f46e5;">
                    ${totalPrice.toLocaleString('vi-VN')} đ
                  </td>
                </tr>
              </tfoot>
            </table>

            <!-- Store info -->
            <div style="margin-top:30px;padding:20px;background-color:#f8fafc;border-radius:8px;font-size:14px;color:#64748b;">
              <p style="margin:0;"><b>Địa chỉ:</b> ${storeAddress}</p>
              <p style="margin:5px 0 0;"><b>Điện thoại:</b> ${storePhone}</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color:#f1f5f9;padding:20px;text-align:center;font-size:12px;color:#94a3b8;">
            <p style="margin:0;">Đây là email tự động. Vui lòng không trả lời email này.</p>
            <p style="margin:5px 0 0;">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: 'Email đã được gửi thành công' });
  } catch (error: any) {
    // Log chi tiết lỗi phía server
    console.error('[Mail Error] Chi tiết lỗi:', {
      message: error?.message,
      code: error?.code,       // vd: EAUTH, ECONNECTION
      command: error?.command, // lệnh SMTP thất bại
      stack: error?.stack
    });

    // Trả lỗi rõ ràng cho client
    const isAuthError = error?.code === 'EAUTH';
    const isConnError = error?.code === 'ECONNECTION' || error?.code === 'ETIMEDOUT';

    if (isAuthError) {
      return NextResponse.json(
        { error: 'Xác thực SMTP thất bại. Kiểm tra lại SMTP_USER và SMTP_PASS trong .env' },
        { status: 500 }
      );
    }

    if (isConnError) {
      return NextResponse.json(
        { error: 'Không thể kết nối tới máy chủ email. Kiểm tra lại cấu hình SMTP.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `Lỗi khi gửi email: ${error?.message ?? 'Unknown error'}` },
      { status: 500 }
    );
  }
}