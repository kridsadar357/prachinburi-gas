-- ==============================================
-- แอปค้นหาปั๊มน้ำมันปราจีนบุรี - โครงสร้างฐานข้อมูล
-- ==============================================
-- ไฟล์ SQL นี้เป็นเอกสารโครงสร้างฐานข้อมูล
-- สำหรับแอป PWA ค้นหาปั๊มน้ำมัน
-- 
-- หมายเหตุ: โปรเจกต์นี้ใช้ Prisma ORM กับ SQLite
-- โครงสร้างจริงอยู่ใน prisma/schema.prisma
-- ไฟล์นี้จัดทำเพื่อเป็นเอกสารอ้างอิง
-- ==============================================

-- ตารางสถานะน้ำมันของแต่ละปั๊ม
-- เก็บสถานะความพร้อมของน้ำมันแต่ละประเภทในแต่ละปั๊ม
-- Primary Key: (station_id, fuel_type)
-- ตารางนี้เก็บสถานะ "ทางการ" ที่ได้จากการรายงานของผู้ใช้
CREATE TABLE IF NOT EXISTS station_fuel_status (
    station_id VARCHAR(255) NOT NULL,
    fuel_type VARCHAR(50) NOT NULL,
    is_empty BOOLEAN DEFAULT FALSE,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (station_id, fuel_type)
);

-- ตารางรายงานน้ำมันหมด
-- เก็บรายงานทั้งหมดจากผู้ใช้
-- ใช้สำหรับตรวจสอบความถูกต้อง (3 รายงานภายใน 1 ชั่วโมง จะเปลี่ยนสถานะ)
CREATE TABLE IF NOT EXISTS fuel_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id VARCHAR(255) NOT NULL,
    fuel_type VARCHAR(50) NOT NULL,
    user_ip VARCHAR(45) NOT NULL,  -- รองรับ IPv6
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index สำหรับการตรวจสอบ threshold อย่างมีประสิทธิภาพ
-- ช่วยให้ค้นหาและนับรายงานในช่วงเวลาได้เร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_reports_station_fuel_time 
ON fuel_reports(station_id, fuel_type, reported_at);

-- ==============================================
-- คำอธิบายระบบ Threshold (การตรวจสอบความถูกต้อง)
-- ==============================================
-- เมื่อผู้ใช้รายงานว่าน้ำมันหมด:
-- 1. บันทึกรายงานลงตาราง 'fuel_reports'
-- 2. นับจำนวนรายงานสำหรับ station_id + fuel_type ภายใน 1 ชั่วโมงที่ผ่านมา
-- 3. ถ้าจำนวน >= 3 (threshold) จะอัปเดต 'station_fuel_status' เป็น is_empty = TRUE
-- 
-- วิธีนี้ช่วยป้องกันรายงานเท็จจากคนเดียว
-- และทำให้มั่นใจว่ารายงานที่ได้รับการยืนยันจากหลายคนจะถูกเชื่อถือ
--
-- สถานะจะล้างอัตโนมัติหลัง 24 ชั่วโมง (จัดการโดย API)
-- ==============================================

-- ปั๊มน้ำมันในปราจีนบุรี (ข้อมูลสำหรับทดสอบ)
-- รหัสสถานีตรงกับข้อมูล GeoJSON

-- ตัวอย่าง: กำหนดให้น้ำมัน 95 ของ ptt_prachinburi_1 หมด
-- INSERT INTO station_fuel_status (station_id, fuel_type, is_empty, last_updated)
-- VALUES ('ptt_prachinburi_1', '95', TRUE, CURRENT_TIMESTAMP);

-- ตัวอย่าง: เพิ่มรายงานตัวอย่าง
-- INSERT INTO fuel_reports (station_id, fuel_type, user_ip, reported_at)
-- VALUES ('ptt_prachinburi_1', '95', '192.168.1.1', CURRENT_TIMESTAMP);
