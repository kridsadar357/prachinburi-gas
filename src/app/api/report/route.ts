import { NextRequest, NextResponse } from 'next/server';
import { updateMemoryStore } from '../status/route';

// Threshold: จำนวนรายงานที่ต้องการภายใน 1 ชั่วโมง
const REPORT_THRESHOLD = 3;
const REPORT_WINDOW_HOURS = 1;

// Fallback in-memory storage
const memoryReports: { stationId: string; fuelType: string; userIp: string; reportedAt: Date }[] = [];

/**
 * POST /api/report
 * 
 * รับรายงานน้ำมันหมดจากผู้ใช้
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

    // ดึง IP ของผู้ใช้
    const userIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';

    const oneHourAgo = new Date(Date.now() - REPORT_WINDOW_HOURS * 60 * 60 * 1000);

    // ลองใช้ database
    try {
      const { db } = await import('@/lib/db');
      
      // ตรวจสอบว่าเคยรายงานหรือยัง
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

      // นับจำนวนรายงาน
      const reportCount = await db.fuelReport.count({
        where: {
          stationId,
          fuelType,
          reportedAt: { gte: oneHourAgo }
        }
      });

      // ตรวจสอบ threshold
      if (reportCount >= REPORT_THRESHOLD) {
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
          message: 'บันทึกรายงานแล้ว น้ำมันถูก标记ว่าหมดแล้ว',
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

    } catch (dbError) {
      console.error('Database error, using memory fallback:', dbError);
      
      // Fallback to memory storage
      // ตรวจสอบว่าเคยรายงานหรือยัง
      const existingMemoryReport = memoryReports.find(
        r => r.stationId === stationId && 
             r.fuelType === fuelType && 
             r.userIp === userIp && 
             r.reportedAt >= oneHourAgo
      );

      if (existingMemoryReport) {
        return NextResponse.json(
          { error: 'คุณได้รายงานน้ำมันชนิดนี้ที่ปั๊มนี้ไปแล้วในช่วงเวลาใกล้เคียง' },
          { status: 429 }
        );
      }

      // บันทึกรายงานใหม่
      memoryReports.push({
        stationId,
        fuelType,
        userIp,
        reportedAt: new Date()
      });

      // นับจำนวนรายงาน
      const reportCount = memoryReports.filter(
        r => r.stationId === stationId && 
             r.fuelType === fuelType && 
             r.reportedAt >= oneHourAgo
      ).length;

      // ตรวจสอบ threshold
      if (reportCount >= REPORT_THRESHOLD) {
        updateMemoryStore(stationId, fuelType);
        
        return NextResponse.json({
          success: true,
          message: 'บันทึกรายงานแล้ว น้ำมันถูก标记ว่าหมดแล้ว',
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
    }

  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการประมวลผลรายงาน:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
