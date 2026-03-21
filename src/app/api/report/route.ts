import { NextRequest, NextResponse } from 'next/server';
import { outOfStockStore } from '../status/route';

// Threshold: จำนวนรายงานที่ต้องการภายใน 1 ชั่วโมงเพื่อ标记ว่าน้ำมันหมด
const REPORT_THRESHOLD = 3;
const REPORT_WINDOW_HOURS = 1;

// In-memory storage สำหรับเก็บรายงาน
const reportsStore: { stationId: string; fuelType: string; userIp: string; reportedAt: Date }[] = [];

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
 * 1. บันทึกรายงานลงใน memory
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
    
    // ล้างรายงานเก่ากว่า 24 ชั่วโมง
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oldReportIndex = reportsStore.findIndex(r => r.reportedAt < twentyFourHoursAgo);
    if (oldReportIndex > -1) {
      reportsStore.splice(0, oldReportIndex + 1);
    }

    // ตรวจสอบว่าเคยรายงานหรือยัง
    const existingReport = reportsStore.find(
      r => r.stationId === stationId && 
           r.fuelType === fuelType && 
           r.userIp === userIp && 
           r.reportedAt >= oneHourAgo
    );

    if (existingReport) {
      return NextResponse.json(
        { error: 'คุณได้รายงานน้ำมันชนิดนี้ที่ปั๊มนี้ไปแล้วในช่วงเวลาใกล้เคียง' },
        { status: 429 }
      );
    }

    // บันทึกรายงานใหม่
    const newReport = {
      stationId,
      fuelType,
      userIp,
      reportedAt: new Date()
    };
    reportsStore.push(newReport);

    // นับจำนวนรายงานทั้งหมดสำหรับปั๊ม+น้ำมันนี้ภายในช่วงเวลาที่กำหนด
    const reportCount = reportsStore.filter(
      r => r.stationId === stationId && 
           r.fuelType === fuelType && 
           r.reportedAt >= oneHourAgo
    ).length;

    // LOGIC การตรวจสอบ THRESHOLD:
    // ถ้ามี 3 รายงานขึ้นไปจากผู้ใช้ต่างคนภายใน 1 ชั่วโมง
    // จะถือว่ารายงานถูกต้องและ标记ว่าน้ำมันหมด
    // วิธีนี้ป้องกันรายงานเท็จจากคนเดียวส่งผลต่อสถานะ
    if (reportCount >= REPORT_THRESHOLD) {
      // อัปเดตหรือสร้างสถานะน้ำมันของปั๊ม
      const existing = outOfStockStore.get(stationId);
      
      if (existing) {
        if (!existing.fuelTypes.includes(fuelType)) {
          existing.fuelTypes.push(fuelType);
        }
        existing.lastUpdated = new Date();
        existing.reports.push({ fuelType, timestamp: new Date() });
      } else {
        outOfStockStore.set(stationId, {
          fuelTypes: [fuelType],
          lastUpdated: new Date(),
          reports: [{ fuelType, timestamp: new Date() }]
        });
      }

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
