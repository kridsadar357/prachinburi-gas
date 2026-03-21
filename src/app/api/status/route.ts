import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/status
 * 
 * ส่งคืนรายการน้ำมันที่หมดทั้งหมดในแต่ละปั๊ม
 * ใช้โดย Frontend เพื่อแสดงการแจ้งเตือนบนแผนที่
 * 
 * ล้างสถานะที่หมดอายุ (เก่ากว่า 24 ชั่วโมง) อัตโนมัติ
 * ทำให้ปั๊มสามารถ "กลับมา" จากการหมดชั่วคราวได้
 */
export async function GET() {
  try {
    // ล้างสถานะเก่า (เก่ากว่า 24 ชั่วโมง)
    // ทำให้ปั๊มสามารถกลับมาพร้อมบริการได้หลังจากแจ้งว่าหมดไปแล้ว
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    await db.stationFuelStatus.deleteMany({
      where: {
        isEmpty: true,
        lastUpdated: { lt: twentyFourHoursAgo }
      }
    });

    // ดึงสถานะน้ำมันหมดทั้งหมด
    const outOfStockStatuses = await db.stationFuelStatus.findMany({
      where: {
        isEmpty: true
      },
      select: {
        stationId: true,
        fuelType: true,
        lastUpdated: true
      }
    });

    // จัดกลุ่มตามรหัสปั๊มเพื่อให้ Frontend ประมวลผลง่ายขึ้น
    const statusMap: Record<string, { fuelTypes: string[], lastUpdated: string }[]> = {};
    
    for (const status of outOfStockStatuses) {
      if (!statusMap[status.stationId]) {
        statusMap[status.stationId] = [];
      }
      
      // ตรวจสอบว่ามี entry สำหรับน้ำมันชนิดนี้แล้วหรือยัง
      const existingEntry = statusMap[status.stationId].find(
        e => e.fuelTypes.includes(status.fuelType)
      );
      
      if (!existingEntry) {
        statusMap[status.stationId].push({
          fuelTypes: [status.fuelType],
          lastUpdated: status.lastUpdated.toISOString()
        });
      }
    }

    // แปลงเป็น array format สำหรับ Frontend
    const result = Object.entries(statusMap).map(([stationId, statuses]) => ({
      stationId,
      outOfStock: statuses.flatMap(s => s.fuelTypes),
      lastUpdated: statuses[0]?.lastUpdated || new Date().toISOString()
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการดึงสถานะ:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
