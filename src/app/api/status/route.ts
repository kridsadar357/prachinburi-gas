import { NextResponse } from 'next/server';

// In-memory storage สำหรับเก็บสถานะน้ำมันหมด
// ใน production ควรใช้ database จริง
const outOfStockStore: Map<string, { fuelTypes: string[], lastUpdated: Date, reports: { fuelType: string, timestamp: Date }[] }> = new Map();

/**
 * GET /api/status
 * 
 * ส่งคืนรายการน้ำมันที่หมดทั้งหมดในแต่ละปั๊ม
 * ใช้โดย Frontend เพื่อแสดงการแจ้งเตือนบนแผนที่
 */
export async function GET() {
  try {
    // ล้างสถานะเก่า (เก่ากว่า 24 ชั่วโมง)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [stationId, data] of outOfStockStore.entries()) {
      // กรอง reports ที่เก่ากว่า 24 ชั่วโมงออก
      data.reports = data.reports.filter(r => r.timestamp > twentyFourHoursAgo);
      
      // คำนวณสถานะใหม่จาก reports ที่เหลือ
      const fuelTypeCounts: Record<string, number> = {};
      for (const report of data.reports) {
        fuelTypeCounts[report.fuelType] = (fuelTypeCounts[report.fuelType] || 0) + 1;
      }
      
      // เก็บเฉพาะน้ำมันที่มี 3+ reports ใน 1 ชั่วโมง
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentFuelTypes = new Set<string>();
      
      for (const report of data.reports) {
        if (report.timestamp > oneHourAgo) {
          const count = data.reports.filter(
            r => r.fuelType === report.fuelType && r.timestamp > oneHourAgo
          ).length;
          if (count >= 3) {
            recentFuelTypes.add(report.fuelType);
          }
        }
      }
      
      data.fuelTypes = Array.from(recentFuelTypes);
      data.lastUpdated = new Date();
      
      // ลบ station ที่ไม่มี out of stock แล้ว
      if (data.fuelTypes.length === 0) {
        outOfStockStore.delete(stationId);
      }
    }

    // แปลงเป็น array format สำหรับ Frontend
    const result = Array.from(outOfStockStore.entries()).map(([stationId, data]) => ({
      stationId,
      outOfStock: data.fuelTypes,
      lastUpdated: data.lastUpdated.toISOString()
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการดึงสถานะ:', error);
    // ส่งคืน empty array แทนที่จะเป็น error
    return NextResponse.json([]);
  }
}

// Export store ให้ report API ใช้
export { outOfStockStore };
