import { NextResponse } from 'next/server';

/**
 * GET /api/stations
 * 
 * ส่งคืนข้อมูล GeoJSON ของสถานีบริการน้ำมันทั้งหมดในจังหวัดปราจีนบุรี
 * ข้อมูลนี้ถูกใช้โดย Leaflet map เพื่อแสดงตัวปั๊มน้ำมันบนแผนที่
 * 
 * ข้อมูลครอบคลุมปั๊มน้ำมันทั้งหมดในจังหวัดปราจีนบุรี
 * รวมถึงพื้นที่นิคมอุตสาหกรรม 304 และถนนสายหลักทุกสาย
 */
export async function GET() {
  // ข้อมูล GeoJSON ของสถานีบริการน้ำมันในจังหวัดปราจีนบุรี
  // พิกัดศูนย์กลาง: ละติจูด 14.0509, ลองจิจูด 101.3689
  const stationsGeoJSON = {
    type: "FeatureCollection",
    features: [
      // ============================================
      // นิคมอุตสาหกรรม 304 (304 Industrial Estate)
      // ============================================
      {
        type: "Feature",
        properties: {
          id: "ptt_nikhom_304",
          name: "ปตท. นิคมอุตสาหกรรม 304",
          brand: "ปตท.",
          address: "ถนน 304 หน้านิคมอุตสาหกรรม 304 ต.เมืองเก่า อ.กบินทร์บุรี จ.ปราจีนบุรี 25240",
          fuels: ["95", "91", "E20", "E85", "B7", "B20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.7220, 13.9650]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "shell_nikhom_304",
          name: "เชลล์ นิคม 304 ปราจีนบุรี",
          brand: "เชลล์",
          address: "ถนน 304 ฝั่งตลาด 304 พลาซ่า ต.เมืองเก่า อ.กบินทร์บุรี จ.ปราจีนบุรี 25240",
          fuels: ["95", "91", "E20", "ดีเซล"],
          hours: "04:30 - 23:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.7180, 13.9680]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "shell_304_khuphanan",
          name: "เชลล์ คู่ขนาน ทล.304",
          brand: "เชลล์",
          address: "ถนนคู่ขนานทางหลวง 304 ต.เมืองเก่า อ.กบินทร์บุรี จ.ปราจีนบุรี 25240",
          fuels: ["95", "91", "E20", "ดีเซล"],
          hours: "06:00 - 22:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.7150, 13.9620]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "ptt_kabinburi_304_new",
          name: "ปตท. กบินทร์บุรี 304 (ปั๊มใหม่)",
          brand: "ปตท.",
          address: "ถนน 304 เลยสี่แยกสามทหารไปประมาณ 3 กม. ต.เมืองเก่า อ.กบินทร์บุรี จ.ปราจีนบุรี 25240",
          fuels: ["95", "91", "E20", "E85", "B7", "B20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.6950, 13.9780]
        }
      },

      // ============================================
      // กบินทร์บุรี (Kabin Buri District)
      // ============================================
      {
        type: "Feature",
        properties: {
          id: "ptt_kabinburi",
          name: "ปตท. กบินทร์บุรี",
          brand: "ปตท.",
          address: "ถนนสุวรรณภาค ต.กบินทร์บุรี อ.กบินทร์บุรี จ.ปราจีนบุรี 25210",
          fuels: ["95", "91", "E20", "E85", "B7", "B20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.4567, 13.9823]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "ptt_kabinburi_304_2",
          name: "ปตท. กบินทร์บุรี 304",
          brand: "ปตท.",
          address: "ถนน 304 (เส้นทางเศรษฐกิจตะวันออก) ต.กบินทร์บุรี อ.กบินทร์บุรี จ.ปราจีนบุรี 25210",
          fuels: ["95", "91", "E20", "E85", "B7", "B20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.4950, 13.9890]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "shell_kabinburi",
          name: "เชลล์ กบินทร์บุรี",
          brand: "เชลล์",
          address: "ถนนสุวรรณภาค ต.กบินทร์บุรี อ.กบินทร์บุรี จ.ปราจีนบุรี 25210",
          fuels: ["95", "91", "E20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.4620, 13.9850]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "shell_khlong_rang",
          name: "เชลล์ คลองรั้งสายนอก",
          brand: "เชลล์",
          address: "ถนน 304 ต.กบินทร์บุรี อ.กบินทร์บุรี จ.ปราจีนบุรี 25210",
          fuels: ["95", "91", "E20", "ดีเซล"],
          hours: "06:00 - 22:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.4920, 13.9750]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "bangchak_kabinburi",
          name: "บางจาก กบินทร์บุรี",
          brand: "บางจาก",
          address: "ถนนสุวรรณภาค ต.กบินทร์บุรี อ.กบินทร์บุรี จ.ปราจีนบุรี 25210",
          fuels: ["95", "E20", "E85", "B7", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.4680, 13.9920]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "ptt_kabin_junction",
          name: "ปตท. แยกกบินทร์บุรี",
          brand: "ปตท.",
          address: "แยกกบินทร์บุรี ต.กบินทร์บุรี อ.กบินทร์บุรี จ.ปราจีนบุรี 25210",
          fuels: ["95", "91", "E20", "E85", "B7", "B20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.4450, 13.9650]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "pt_energy_kabinburi",
          name: "พีที เอนเนอร์ยี กบินทร์บุรี",
          brand: "พีที",
          address: "ถนนสุวรรณภาค ต.กบินทร์บุรี อ.กบินทร์บุรี จ.ปราจีนบุรี 25210",
          fuels: ["95", "E20", "B7", "ดีเซล"],
          hours: "06:00 - 23:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.4780, 13.9980]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "ptt_phanomsarakam_kabin",
          name: "ปตท. พนมสารคาม-กบินทร์บุรี",
          brand: "ปตท.",
          address: "ถนนพนมสารคาม-กบินทร์บุรี ต.เมืองเก่า อ.กบินทร์บุรี จ.ปราจีนบุรี 25240",
          fuels: ["95", "91", "E20", "E85", "B7", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.7545, 13.9787]
        }
      },

      // ============================================
      // เมืองปราจีนบุรี (Mueang Prachinburi District)
      // ============================================
      {
        type: "Feature",
        properties: {
          id: "ptt_prachinburi_1",
          name: "ปตท. ปราจีนบุรี",
          brand: "ปตท.",
          address: "ถนนปราจีนบุรี-นครนายก ต.บ้านเพชร อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25000",
          fuels: ["95", "91", "E20", "E85", "B7", "B20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.3689, 14.0509]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "ptt_prachinburi_2",
          name: "ปตท. ปราจีนบุรี 2",
          brand: "ปตท.",
          address: "ถนนสุวรรณภาค (ทางหลวงหมายเลข 33) ต.โคกไม้ลาย อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25230",
          fuels: ["95", "91", "E20", "E85", "B7", "B20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.3420, 14.0310]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "bangchak_prachinburi",
          name: "บางจาก ปราจีนบุรี",
          brand: "บางจาก",
          address: "ถนนปราจีนบุรี-กบินทร์บุรี ต.หน้าเมือง อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25000",
          fuels: ["95", "E20", "E85", "B7", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.3650, 14.0480]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "shell_prachinburi",
          name: "เชลล์ ปราจีนบุรี",
          brand: "เชลล์",
          address: "ถนนสุวรรณภาค ต.บ้านเพชร อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25000",
          fuels: ["95", "91", "E20", "ดีเซล"],
          hours: "06:00 - 22:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.3750, 14.0530]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "esso_prachinburi",
          name: "เอสโซ่ ปราจีนบุรี",
          brand: "เอสโซ่",
          address: "ถนนปราจีนบุรี-นครนายก ต.บ้านเพชร อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25000",
          fuels: ["95", "91", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.3550, 14.0420]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "pt_prachinburi",
          name: "พีที ปราจีนบุรี",
          brand: "พีที",
          address: "ถนนสุวรรณภาค ต.โคกไม้ลาย อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25000",
          fuels: ["95", "E20", "B7", "ดีเซล"],
          hours: "06:00 - 22:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.3580, 14.0350]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "ptt_highway33",
          name: "ปตท. ทางหลวง 33",
          brand: "ปตท.",
          address: "ทางหลวงหมายเลข 33 ต.โคกไม้ลาย อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25000",
          fuels: ["95", "91", "E20", "E85", "B7", "B20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.3280, 14.0180]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "bangchak_city",
          name: "บางจาก ตัวเมืองปราจีนบุรี",
          brand: "บางจาก",
          address: "ตัวเมืองปราจีนบุรี ต.หน้าเมือง อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25000",
          fuels: ["95", "E20", "B7", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.3620, 14.0520]
        }
      },

      // ============================================
      // ศรีมหาโพธิ (Si Maha Pho District)
      // ============================================
      {
        type: "Feature",
        properties: {
          id: "ptt_srimahapho",
          name: "ปตท. ศรีมหาโพธิ",
          brand: "ปตท.",
          address: "ถนนสุวรรณภาค ต.ศรีมหาโพธิ อ.ศรีมหาโพธิ จ.ปราจีนบุรี 25140",
          fuels: ["95", "91", "E20", "B7", "ดีเซล"],
          hours: "05:00 - 23:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.3890, 14.0678]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "bangchak_srimahapho",
          name: "บางจาก ศรีมหาโพธิ",
          brand: "บางจาก",
          address: "ถนนปราจีนบุรี-ศรีมหาโพธิ ต.ศรีมหาโพธิ อ.ศรีมหาโพธิ จ.ปราจีนบุรี 25140",
          fuels: ["95", "E20", "B7", "ดีเซล"],
          hours: "06:00 - 22:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.4123, 14.0856]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "shell_srimahapho",
          name: "เชลล์ ศรีมหาโพธิ",
          brand: "เชลล์",
          address: "ถนนสุวรรณภาค ต.ศรีมหาโพธิ อ.ศรีมหาโพธิ จ.ปราจีนบุรี 25140",
          fuels: ["95", "91", "E20", "ดีเซล"],
          hours: "06:00 - 22:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.3950, 14.0720]
        }
      },

      // ============================================
      // บางสะเกษ (Ban Sang District)
      // ============================================
      {
        type: "Feature",
        properties: {
          id: "ptt_bansang",
          name: "ปตท. บางสะเกษ",
          brand: "ปตท.",
          address: "ถนนบางสะเกษ-ปราจีนบุรี ต.บางสะเกษ อ.บางสะเกษ จ.ปราจีนบุรี 25150",
          fuels: ["95", "91", "E20", "B7", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.5234, 14.1234]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "bangchak_bansang",
          name: "บางจาก บางสะเกษ",
          brand: "บางจาก",
          address: "ถนนบางสะเกษ ต.บางสะเกษ อ.บางสะเกษ จ.ปราจีนบุรี 25150",
          fuels: ["95", "E20", "B7", "ดีเซล"],
          hours: "06:00 - 21:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.5310, 14.1280]
        }
      },

      // ============================================
      // นาดี (Na Di District)
      // ============================================
      {
        type: "Feature",
        properties: {
          id: "ptt_nadi",
          name: "ปตท. นาดี",
          brand: "ปตท.",
          address: "ถนนนาดี-ปราจีนบุรี ต.นาดี อ.นาดี จ.ปราจีนบุรี 25220",
          fuels: ["95", "91", "E20", "B7", "ดีเซล"],
          hours: "06:00 - 22:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.5550, 14.1450]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "shell_nadi",
          name: "เชลล์ นาดี",
          brand: "เชลล์",
          address: "ถนนนาดี ต.นาดี อ.นาดี จ.ปราจีนบุรี 25220",
          fuels: ["95", "91", "ดีเซล"],
          hours: "07:00 - 20:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.5480, 14.1380]
        }
      },

      // ============================================
      // ประจันตคาม (Prachantakham District)
      // ============================================
      {
        type: "Feature",
        properties: {
          id: "ptt_prachantakham",
          name: "ปตท. ประจันตคาม",
          brand: "ปตท.",
          address: "ถนนประจันตคาม ต.ประจันตคาม อ.ประจันตคาม จ.ปราจีนบุรี 25230",
          fuels: ["95", "91", "E20", "B7", "ดีเซล"],
          hours: "05:00 - 23:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.3780, 14.1120]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "caltex_prachantakham",
          name: "คาลเท็กซ์ ประจันตคาม",
          brand: "คาลเท็กซ์",
          address: "ถนนประจันตคาม ต.ประจันตคาม อ.ประจันตคาม จ.ปราจีนบุรี 25230",
          fuels: ["95", "91", "ดีเซล"],
          hours: "06:00 - 22:00 น."
        },
        geometry: {
          type: "Point",
          coordinates: [101.3820, 14.1150]
        }
      },

      // ============================================
      // ปั๊มน้ำมันเพิ่มเติมตามถนนสายหลัก
      // ============================================
      {
        type: "Feature",
        properties: {
          id: "ptt_suvarnabhumi_prachin",
          name: "ปตท. สุวรรณภาค ปราจีนบุรี",
          brand: "ปตท.",
          address: "ถนนสุวรรณภาค กม. 155 ต.โคกไม้ลาย อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25000",
          fuels: ["95", "91", "E20", "E85", "B7", "B20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.3350, 14.0250]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "shell_suvarnabhumi",
          name: "เชลล์ สุวรรณภาค",
          brand: "เชลล์",
          address: "ถนนสุวรรณภาค ต.โคกไม้ลาย อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25000",
          fuels: ["95", "91", "E20", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.3380, 14.0280]
        }
      },
      {
        type: "Feature",
        properties: {
          id: "ptt_nakornnayok_prachin",
          name: "ปตท. ปราจีนบุรี-นครนายก",
          brand: "ปตท.",
          address: "ถนนปราจีนบุรี-นครนายก กม. 15 ต.บ้านเพชร อ.เมืองปราจีนบุรี จ.ปราจีนบุรี 25000",
          fuels: ["95", "91", "E20", "B7", "ดีเซล"],
          hours: "เปิดบริการ 24 ชั่วโมง"
        },
        geometry: {
          type: "Point",
          coordinates: [101.3850, 14.0650]
        }
      }
    ]
  };

  return NextResponse.json(stationsGeoJSON);
}
