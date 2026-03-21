import { NextResponse } from 'next/server';

// Fallback in-memory storage เมื่อ database ไม่พร้อม
let memoryStore: { stationId: string; fuelTypes: string[]; lastUpdated: Date }[] = [];

/**
 * GET /api/status
 * 
 * ส่งคืนรายการน้ำมันที่หมดทั้งหมดในแต่ละปั๊ม
 */
export async function GET() {
  try {
    // ลองใช้ database
    const { db } = await import('@/lib/db');
    
    try {
      // ล้างสถานะเก่า (เก่ากว่า 24 ชั่วโมง)
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

      // จัดกลุ่มตามรหัสปั๊ม
      const statusMap: Record<string, string[]> = {};
      const lastUpdatedMap: Record<string, Date> = {};
      
      for (const status of outOfStockStatuses) {
        if (!statusMap[status.stationId]) {
          statusMap[status.stationId] = [];
          lastUpdatedMap[status.stationId] = status.lastUpdated;
        }
        if (!statusMap[status.stationId].includes(status.fuelType)) {
          statusMap[status.stationId].push(status.fuelType);
        }
      }

      const result = Object.entries(statusMap).map(([stationId, fuelTypes]) => ({
        stationId,
        outOfStock: fuelTypes,
        lastUpdated: lastUpdatedMap[stationId]?.toISOString() || new Date().toISOString()
      }));

      return NextResponse.json(result);
      
    } catch (dbError) {
      console.error('Database error, using memory fallback:', dbError);
      // Fallback to memory store
      return NextResponse.json(memoryStore.map(s => ({
        stationId: s.stationId,
        outOfStock: s.fuelTypes,
        lastUpdated: s.lastUpdated.toISOString()
      })));
    }
    
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการดึงสถานะ:', error);
    // ส่งคืน empty array เสมอ
    return NextResponse.json([]);
  }
}

// Export สำหรับใช้โดย report API
export function updateMemoryStore(stationId: string, fuelType: string) {
  const existing = memoryStore.find(s => s.stationId === stationId);
  if (existing) {
    if (!existing.fuelTypes.includes(fuelType)) {
      existing.fuelTypes.push(fuelType);
    }
    existing.lastUpdated = new Date();
  } else {
    memoryStore.push({
      stationId,
      fuelTypes: [fuelType],
      lastUpdated: new Date()
    });
  }
}
