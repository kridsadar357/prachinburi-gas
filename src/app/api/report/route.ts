import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Threshold: จำนวนรายงานที่ต้องการภายใน 1 ชั่วโมงเพื่อ标记ว่าน้ำมันหมด
const REPORT_THRESHOLD = 3;
const REPORT_WINDOW_HOURS = 1;

/**
 * POST /api/report
 * 
 * รับรายงานน้ำมันหมดจากผู้ใช้
 * 
 * Request body:
 * - stationId: รหัสปั๊มน้ำมัน
 * - fuelType: ประเภทน้ำมัน (เช่น "95", "91", "E20", "B7", "ดีเซล")
 * 
 * ขั้นตอน:
 * 1. บันทึกรายงานลงฐานข้อมูล
 * 2. นับจำนวนรายงานสำหรับ station_id + fuel_type ภายใน 1 ชั่วโมงที่ผ่านมา
 * 3. ถ้าจำนวน >= threshold (3) ให้อัปเดตสถานะน้ำมันเป็น "หมด"
 * 
 * ระบบนี้ใช้การโหวตเพื่อยืนยัน ต้องมีหลายรายงานอิสระจากกัน
 * จึงจะเปลี่ยนสถานะ ป้องกันรายงานเท็จจากบุคคลเดียว
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stationId, fuelType } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!stationId || !fuelType) {
      return NextResponse.json(
        { error: 'กรุณาระบุ stationId และ fuelType' },
        { status: 400 }
      );
    }

    // ดึง IP ของผู้ใช้เพื่อป้องกันสแปม
    const userIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';

    // ตรวจสอบว่า IP นี้เคยรายงานปั๊ม+น้ำมันนี้ในชั่วโมงที่ผ่านมาหรือยัง
    const oneHourAgo = new Date(Date.now() - REPORT_WINDOW_HOURS * 60 * 60 * 1000);
    
    const existingReport = await db.fuelReport.findFirst({
      where: {
        stationId,
        fuelType,
        userIp,
        reportedAt: { gte: oneHourAgo }
      }
    });

    if (existingReport) {
      return NextResponse.json(
        { error: 'คุณได้รายงานน้ำมันชนิดนี้ที่ปั๊มนี้ไปแล้วในช่วงเวลาใกล้เคียง' },
        { status: 429 }
      );
    }

    // บันทึกรายงานใหม่
    await db.fuelReport.create({
      data: {
        stationId,
        fuelType,
        userIp,
      }
    });

    // นับจำนวนรายงานทั้งหมดสำหรับปั๊ม+น้ำมันนี้ภายในช่วงเวลาที่กำหนด
    const reportCount = await db.fuelReport.count({
      where: {
        stationId,
        fuelType,
        reportedAt: { gte: oneHourAgo }
      }
    });

    // LOGIC การตรวจสอบ THRESHOLD:
    // ถ้ามี 3 รายงานขึ้นไปจากผู้ใช้ต่างคนภายใน 1 ชั่วโมง
    // จะถือว่ารายงานถูกต้องและ标记ว่าน้ำมันหมด
    // วิธีนี้ป้องกันรายงานเท็จจากคนเดียวส่งผลต่อสถานะ
    if (reportCount >= REPORT_THRESHOLD) {
      // อัปเดตหรือสร้างสถานะน้ำมันของปั๊ม
      await db.stationFuelStatus.upsert({
        where: {
          stationId_fuelType: {
            stationId,
            fuelType
          }
        },
        update: {
          isEmpty: true,
          lastUpdated: new Date()
        },
        create: {
          stationId,
          fuelType,
          isEmpty: true
        }
      });

      return NextResponse.json({
        success: true,
        message: 'บันทึกรายงานแล้ว น้ำมันถูก标记ว่าหมดแล้ว (ถึงจำนวนที่กำหนด)',
        thresholdReached: true,
        reportCount
      });
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกรายงานสำเร็จ',
      thresholdReached: false,
      reportCount,
      reportsNeeded: REPORT_THRESHOLD - reportCount
    });

  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการประมวลผลรายงาน:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
