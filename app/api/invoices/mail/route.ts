import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Định nghĩa kiểu dữ liệu cho hóa đơn với các quan hệ được include
// Điều này giúp TypeScript hiểu đúng cấu trúc của đối tượng invoice từ Prisma
type InvoiceWithDetails = Prisma.InvoiceGetPayload<{
  include: {
    RoomSession: {
      include: {
        Room: true;
        OrderItems: true;
      };
    };
    Store: true;
  };
}>;

export async function POST(request: Request) {
  try {
    const { invoiceId, targetEmail } = await request.json();

    if (!invoiceId || !targetEmail) {
      return NextResponse.json({ error: 'Thiếu thông tin hóa đơn hoặc email' }, { status: 400 });
    }

    // 1. Lấy dữ liệu hóa đơn chi tiết từ DB
    const invoice: InvoiceWithDetails | null = await prisma.invoice.findUnique({
      where: { Id: invoiceId },
      include: {
        RoomSession: {
          include: {
            Room: true,
            OrderItems: true
          }
        },
        Store: true
      }
    });

    if (!invoice) return NextResponse.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });

    // Kiểm tra biến môi trường
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('Email Error: SMTP_USER hoặc SMTP_PASS chưa được định nghĩa trong .env');
      return NextResponse.json({ error: 'Hệ thống chưa cấu hình email gửi đi' }, { status: 500 });
    }

    // 2. Cấu hình Transporter (Sử dụng Gmail hoặc SMTP khác)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // dùng SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Tính toán tiền phòng và dịch vụ
    const orderItems = invoice.RoomSession?.OrderItems || [];
    const itemsHtml = orderItems.map((item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${item.ProductName}</td>
        <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: center;">${item.Quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: right;">${(Number(item.Price) * item.Quantity).toLocaleString('vi-VN')} đ</td>
      </tr>
    `).join('');

    // 3. Nội dung Email (HTML)
    const mailOptions = {
      from: `"${invoice.Store?.Name || 'Karaoke'}" <${process.env.SMTP_USER}>`,
      to: targetEmail,
      subject: `Hóa đơn thanh toán - Phòng ${invoice.RoomSession?.Room?.RoomNumber}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">HÓA ĐƠN THANH TOÁN</h1>
            <p style="margin: 5px 0 0; opacity: 0.8;">Mã HD: #${invoice.Id.substring(0, 8).toUpperCase()}</p>
          </div>
          
          <div style="padding: 30px; background-color: white;">
            <p>Chào <b>${invoice.CustomerName || 'Quý khách'}</b>,</p>
            <p>Cảm ơn bạn đã sử dụng dịch vụ tại <b>${invoice.Store?.Name || 'Karaoke'}</b>. Dưới đây là thông tin chi tiết hóa đơn của bạn:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0;">Mục</th>
                  <th style="text-align: center; padding: 10px; border-bottom: 2px solid #e2e8f0;">SL</th>
                  <th style="text-align: right; padding: 10px; border-bottom: 2px solid #e2e8f0;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">Tiền phòng (${invoice.RoomSession?.Room?.RoomNumber})</td>
                  <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: center;">1</td>
                  <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: right;">${Number(invoice.RoomCost).toLocaleString('vi-VN')} đ</td>
                </tr>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding: 20px 10px 10px; text-align: right; font-weight: bold; font-size: 18px;">TỔNG CỘNG:</td>
                  <td style="padding: 20px 10px 10px; text-align: right; font-weight: bold; font-size: 20px; color: #4f46e5;">
                    ${Number(invoice.TotalPrice).toLocaleString('vi-VN')} đ
                  </td>
                </tr>
              </tfoot>
            </table>

            <div style="margin-top: 30px; padding: 20px; background-color: #f8fafc; border-radius: 8px; font-size: 14px; color: #64748b;">
              <p style="margin: 0;"><b>Địa chỉ:</b> ${invoice.Store?.Address || 'Đang cập nhật'}</p>
              <p style="margin: 5px 0 0;"><b>Điện thoại:</b> ${invoice.Store?.Phone || 'Đang cập nhật'}</p>
            </div>
          </div>

          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0;">Đây là email tự động từ hệ thống quản lý. Vui lòng không trả lời email này.</p>
            <p style="margin: 5px 0 0;">&copy; ${new Date().getFullYear()} ${invoice.Store?.Name || 'Karaoke'}. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email Error:', error);
    return NextResponse.json({ error: 'Lỗi khi gửi email' }, { status: 500 });
  }
}
