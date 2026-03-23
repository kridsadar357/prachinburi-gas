'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, ChevronLeft, ChevronRight, CircleX, Eye, EyeOff, Fuel, MapPin, Navigation, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { OilAssistant3D } from '@/components/oil-assistant-3d';
import { toast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';

import 'leaflet/dist/leaflet.css';

interface Station {
  id: string;
  name: string;
  brand: string;
  address: string;
  fuels: string[];
  fuelStatus: Record<string, 'available' | 'limited' | 'out' | 'pending_delivery' | 'unknown'>;
  lat: number;
  lng: number;
  district: string | null;
}

interface ApiStation {
  id: string;
  name: string;
  brandId: string;
  lat: number;
  lon: number;
  province: string;
  district: string | null;
  latestReport?: Record<string, boolean>;
}

interface ApiStationsResponse {
  stations: ApiStation[];
  allowReport?: boolean;
}

const PRACHINBURI_CENTER = { lat: 14.0509, lng: 101.3689 };

const FUEL_TYPES: Record<string, { label: string; color: string }> = {
  '95': { label: 'แก๊สโซฮอล์ 95', color: 'bg-green-500' },
  '91': { label: 'แก๊สโซฮอล์ 91', color: 'bg-blue-500' },
  E20: { label: 'แก๊สโซฮอล์ E20', color: 'bg-yellow-500' },
  E85: { label: 'แก๊สโซฮอล์ E85', color: 'bg-orange-500' },
  B20: { label: 'ไบโอดีเซล B20', color: 'bg-amber-700' },
  'ดีเซล': { label: 'ดีเซล', color: 'bg-gray-600' },
};

const FUEL_STATUS_LABEL: Record<string, string> = {
  available: 'มีขาย',
  limited: 'มีจำกัด',
  out: 'หมด',
  pending_delivery: 'กำลังเติม',
  unknown: 'ไม่ทราบ',
};

const BRAND_ASSET: Record<string, { label: string; logo: string }> = {
  PTT: { label: 'PTT', logo: '/brands/ptt.png' },
  PT: { label: 'PT', logo: '/brands/pt.png' },
  SHELL: { label: 'Shell', logo: '/brands/shell.png' },
  BANGCHAK: { label: 'Bangchak', logo: '/brands/bangchak.png' },
  CALTEX: { label: 'Caltex', logo: '/brands/caltex.png' },
  ESSO: { label: 'Esso', logo: '/brands/esso.png' },
  OTHER: { label: 'Other', logo: '/brands/other.png' },
};

const FUEL_FILTER_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'ดีเซล', label: 'ดีเซล' },
  { key: 'B20', label: 'B20' },
  { key: '95', label: 'แก๊สโซฮอล์ 95' },
  { key: '91', label: 'แก๊สโซฮอล์ 91' },
  { key: 'E20', label: 'E20' },
  { key: 'E85', label: 'E85' },
];

const ASSISTANT_QUOTES = [
  'เดินทางปลอดภัยนะครับ ออกไปข้างนอกอย่าลืมใส่หน้ากากกันฝุ่น PM 2.5 ด้วยนะ',
  'เดินทางโดยสวัสดิภาพตลอดการเดินทางนะครับ',
  'ขับขี่ปลอดภัย เดินทางราบรื่นนะครับ',
  'ขอให้ถึงที่หมายอย่างปลอดภัย และดูแลสุขภาพจากฝุ่น PM 2.5 ด้วยการสวมหน้ากากเสมอนะครับ',
  'ดูแลรักษาสุขภาพให้ดีนะครับ',
];

const DISTRICT_ALIAS: Record<string, string> = {
  'เมืองปราจีน': 'เมืองปราจีนบุรี',
  'ปราจีน': 'เมืองปราจีนบุรี',
  'ศรีมหาโพธิ': 'ศรีมหาโพธิ',
  'ศรีมโหสถ': 'ศรีมโหสถ',
  'กบินทร์': 'กบินทร์บุรี',
  'อำเภอกบินทร์บุรี': 'กบินทร์บุรี',
  'อำเภอเมืองปราจีนบุรี': 'เมืองปราจีนบุรี',
};

const INVALID_DISTRICTS = new Set(['ง', 'งเก่า', 'งโพรง', 'กสมบูรณ์', '-', '']);

function normalizeDistrict(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^อำเภอ/, '')
    .replace(/^อ\./, '')
    .replace(/^เขต/, '')
    .trim();

  if (INVALID_DISTRICTS.has(cleaned)) return null;
  if (DISTRICT_ALIAS[cleaned]) return DISTRICT_ALIAS[cleaned];
  if (cleaned.length < 3) return null;
  return cleaned;
}

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then((mod) => mod.Circle), { ssr: false });

function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MarkersLayer({
  stations,
  userLocation,
  nearRangeKm,
  userAccuracyMeters,
  onNavigate,
  onReport,
  onPopupVisibilityChange,
}: {
  stations: Station[];
  userLocation: { lat: number; lng: number } | null;
  nearRangeKm: number | null;
  userAccuracyMeters: number | null;
  onNavigate: (station: Station) => void;
  onReport?: (station: Station) => void;
  onPopupVisibilityChange: (visible: boolean) => void;
}) {
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    import('leaflet').then((mod) => setL(mod.default));
  }, []);

  const iconCache = useMemo(() => {
    if (!L) return new Map<string, any>();
    const cache = new Map<string, any>();
    for (const brand of Object.keys(BRAND_ASSET)) {
      for (const warning of ['0', '1']) {
        const key = `${brand}-${warning}`;
        const html = `
          <div style="position:relative;transform:translate(-50%,-100%);">
            <img src="${BRAND_ASSET[brand]?.logo || BRAND_ASSET.OTHER.logo}" style="width:34px;height:34px;border-radius:999px;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.35);" />
            ${
              warning === '1'
                ? '<div style="position:absolute;top:-2px;right:-9px;width:14px;height:14px;background:#facc15;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:9px;color:#111">!</div>'
                : ''
            }
          </div>
        `;
        cache.set(
          key,
          L.divIcon({
            html,
            className: 'brand-marker',
            iconSize: [34, 42],
            iconAnchor: [17, 42],
          })
        );
      }
    }
    return cache;
  }, [L]);

  if (!L) return null;
  const userIcon = L.divIcon({
    html: `
      <div style="position:relative;transform:translate(-50%,-50%);">
        <div style="width:14px;height:14px;border-radius:999px;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.2)"></div>
      </div>
    `,
    className: 'user-location-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  return (
    <>
      {stations.map((station) => {
        const hasWarning = Object.values(station.fuelStatus).some((s) => s === 'out');
        const hasAvailableFuel = Object.values(station.fuelStatus).some((s) => s === 'available');
        const icon = iconCache.get(`${station.brand}-${hasWarning ? '1' : '0'}`) || iconCache.get('OTHER-0');

        return (
          <Marker
            key={station.id}
            position={[station.lat, station.lng]}
            icon={icon}
            eventHandlers={{
              popupopen: () => onPopupVisibilityChange(true),
              popupclose: () => onPopupVisibilityChange(false),
            }}
          >
            <Popup>
              <div className="min-w-[280px] overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/95 via-white/90 to-white/85 p-3 text-slate-900 shadow-2xl backdrop-blur-xl">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold tracking-tight">{station.name}</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-500">{BRAND_ASSET[station.brand]?.label || 'Other'}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{station.address}</p>
                  </div>
                  <img
                    src={BRAND_ASSET[station.brand]?.logo || BRAND_ASSET.OTHER.logo}
                    alt={BRAND_ASSET[station.brand]?.label || 'Other'}
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-white shadow-lg"
                  />
                </div>
                {userLocation && (
                  <p className="mb-3 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600">
                    ระยะทางจากคุณ: {distanceKm(userLocation.lat, userLocation.lng, station.lat, station.lng).toFixed(1)} กม.
                  </p>
                )}
                <div className="overflow-hidden rounded-xl border border-slate-200/80 shadow-sm">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-700 to-slate-600 text-white">
                        <th className="px-3 py-2 text-left text-xs font-semibold">ประเภทน้ำมัน</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {station.fuels.map((fuel) => {
                        const status = station.fuelStatus[fuel] || 'unknown';
                        const statusClass =
                          status === 'out'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : status === 'limited'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : status === 'available'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

                        return (
                          <tr key={fuel} className="border-t border-slate-100 bg-white/70">
                            <td className="px-3 py-2">
                              <span className="font-semibold text-slate-700">{FUEL_TYPES[fuel]?.label || fuel}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>
                                {FUEL_STATUS_LABEL[status]}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 grid gap-2">
                  {hasAvailableFuel && (
                    <Button
                      size="sm"
                      className="h-11 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700"
                      onClick={() => onNavigate(station)}
                    >
                      <Navigation className="mr-1 h-4 w-4" />
                      นำทางไปสถานีนี้
                    </Button>
                  )}
                  {onReport && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 w-full rounded-xl border-red-300 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100"
                      onClick={() => onReport(station)}
                    >
                      <AlertTriangle className="mr-1 h-4 w-4" />
                      แจ้งน้ำมันหมด
                    </Button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
      {userLocation && (
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={userIcon}
          eventHandlers={{
            popupopen: () => onPopupVisibilityChange(true),
            popupclose: () => onPopupVisibilityChange(false),
          }}
        >
          <Popup>
            <div className="text-sm font-medium">ตำแหน่งของคุณ</div>
            {userAccuracyMeters && (
              <div className="mt-1 text-xs text-muted-foreground">
                ความแม่นยำประมาณ ±{Math.round(userAccuracyMeters)} เมตร
              </div>
            )}
          </Popup>
        </Marker>
      )}
      {userLocation && userAccuracyMeters && (
        <Circle
          center={[userLocation.lat, userLocation.lng]}
          radius={userAccuracyMeters}
          pathOptions={{
            color: '#2563eb',
            weight: 1,
            fillColor: '#3b82f6',
            fillOpacity: 0.12,
          }}
        />
      )}
      {userLocation && nearRangeKm && (
        <Circle
          center={[userLocation.lat, userLocation.lng]}
          radius={nearRangeKm * 1000}
          pathOptions={{
            color: '#10b981',
            weight: 2,
            fillColor: '#10b981',
            fillOpacity: 0.12,
          }}
        />
      )}
    </>
  );
}

export default function Home() {
  const [stations, setStations] = useState<Station[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userAccuracyMeters, setUserAccuracyMeters] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [showNearPanel, setShowNearPanel] = useState(false);
  const [nearRangeKm, setNearRangeKm] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAvailablePanel, setShowAvailablePanel] = useState(true);
  const [availableIndex, setAvailableIndex] = useState(0);
  const [showFuelAssistant, setShowFuelAssistant] = useState(false);
  const [selectedFuelFilter, setSelectedFuelFilter] = useState<string>('ALL');
  const [assistantQuote, setAssistantQuote] = useState(ASSISTANT_QUOTES[0]);
  const [isMapPopupOpen, setIsMapPopupOpen] = useState(false);
  const [allowReport, setAllowReport] = useState(false);
  const [reportStation, setReportStation] = useState<Station | null>(null);
  const [reportFuel, setReportFuel] = useState('ดีเซล');
  const [submittingReport, setSubmittingReport] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const mapBrandId = (brandId: string): string => (BRAND_ASSET[brandId] ? brandId : 'OTHER');

  const mapFuelStatus = (report?: ApiStation['latestReport']): Station['fuelStatus'] => {
    const result: Station['fuelStatus'] = {
      'ดีเซล': 'unknown',
      B20: 'unknown',
      '95': 'unknown',
      '91': 'unknown',
      E20: 'unknown',
      E85: 'unknown',
    };

    if (!report) return result;
    for (const [fuel, available] of Object.entries(report)) {
      if (fuel in result) {
        result[fuel] = available ? 'available' : 'out';
      }
    }
    return result;
  };

  const fetchStations = async () => {
    try {
      const response = await fetch('/api/stations');
      const data: ApiStationsResponse = await response.json();
      const stationList: Station[] = (data.stations || [])
        .map((station) => {
          const fuelStatus = mapFuelStatus(station.latestReport);
          const fuels = Object.keys(fuelStatus).filter((f) => fuelStatus[f] !== 'unknown');
          return {
            id: station.id,
            name: station.name,
            brand: mapBrandId(station.brandId),
            address: `${normalizeDistrict(station.district) || '-'}, ${station.province}`,
            fuels: fuels.length > 0 ? fuels : Object.keys(fuelStatus),
            fuelStatus,
            lat: station.lat,
            lng: station.lon,
            district: normalizeDistrict(station.district),
          };
        })
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));

      setStations(stationList);
      setAllowReport(Boolean(data.allowReport));
    } catch (error) {
      console.error('Failed to fetch stations:', error);
      toast({
        title: 'โหลดข้อมูลไม่สำเร็จ',
        description: 'ไม่สามารถโหลดข้อมูลจาก API ได้',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchStations();
    setMapReady(true);

    // Cleanup stale service workers/caches in local development.
    // This prevents old cached CSP/asset responses from breaking dev sessions.
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => undefined);
        });
      });

      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys
            .filter((key) => key.startsWith('gas-finder-'))
            .forEach((key) => {
              caches.delete(key).catch(() => undefined);
            });
        });
      }
    }

    return () => {
    };
  }, []);

  const filteredStations = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const byName = keyword
      ? stations.filter((station) => station.name.toLowerCase().includes(keyword))
      : stations;

    const byDistance = !nearRangeKm || !userLocation
      ? byName
      : byName.filter((station) => {
      const d = distanceKm(userLocation.lat, userLocation.lng, station.lat, station.lng);
      return d <= nearRangeKm;
    });

    if (selectedFuelFilter === 'ALL') return byDistance;
    return byDistance.filter((station) => station.fuelStatus[selectedFuelFilter] === 'available');
  }, [stations, search, nearRangeKm, userLocation, selectedFuelFilter]);

  const suggestions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return [];
    return stations
      .filter((station) => station.name.toLowerCase().includes(keyword))
      .slice(0, 5);
  }, [stations, search]);

  const availableStations = useMemo(() => {
    return filteredStations.filter((station) =>
      Object.values(station.fuelStatus).some((status) => status === 'available')
    );
  }, [filteredStations]);

  useEffect(() => {
    if (availableStations.length === 0) {
      setAvailableIndex(0);
      return;
    }
    setAvailableIndex((prev) => Math.min(prev, availableStations.length - 1));
  }, [availableStations]);

  useEffect(() => {
    if (!mapInstance || !userLocation || !nearRangeKm) return;
    import('leaflet').then((leaflet) => {
      const L = leaflet.default;
      const center = L.latLng(userLocation.lat, userLocation.lng);
      const bounds = center.toBounds(nearRangeKm * 1000 * 2);
      mapInstance.fitBounds(bounds, { padding: [32, 32] });
    });
  }, [nearRangeKm, userLocation, mapInstance]);

  const centerOnUser = async () => {
    if (!navigator.geolocation) return;

    const start = Date.now();
    let best: GeolocationPosition | null = null;

    const finish = () => {
      if (!best) {
        toast({
          title: 'ไม่สามารถระบุตำแหน่ง',
          description: 'กรุณาอนุญาตตำแหน่งในเบราว์เซอร์',
          variant: 'destructive',
        });
        return;
      }

      const location = { lat: best.coords.latitude, lng: best.coords.longitude };
      setUserLocation(location);
      setUserAccuracyMeters(best.coords.accuracy || null);
      mapInstance?.setView([location.lat, location.lng], 16);
      toast({
        title: 'อัปเดตตำแหน่งแล้ว',
        description: `ความแม่นยำประมาณ ±${Math.round(best.coords.accuracy)} เมตร`,
      });
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!best || position.coords.accuracy < best.coords.accuracy) {
          best = position;
        }
        const accurateEnough = position.coords.accuracy <= 40;
        const timedOut = Date.now() - start > 8000;
        if (accurateEnough || timedOut) {
          navigator.geolocation.clearWatch(watchId);
          finish();
        }
      },
      () => {
        navigator.geolocation.clearWatch(watchId);
        finish();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  const zoomToStation = (station: Station) => {
    mapInstance?.setView([station.lat, station.lng], 15);
    setSearch(station.name);
    setShowSuggestions(false);
  };

  const focusAvailableStation = (nextIndex: number) => {
    if (availableStations.length === 0) return;
    const normalized = (nextIndex + availableStations.length) % availableStations.length;
    setAvailableIndex(normalized);
    const station = availableStations[normalized];
    mapInstance?.setView([station.lat, station.lng], 14);
  };

  const navigateToStation = (station: Station) => {
    const openMap = (origin?: { lat: number; lng: number }) => {
      const destination = `${station.lat},${station.lng}`;
      const originParam = origin ? `&origin=${origin.lat},${origin.lng}` : '';
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}${originParam}&travelmode=driving`;
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    if (userLocation) {
      openMap(userLocation);
      return;
    }

    if (!navigator.geolocation) {
      openMap();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(origin);
        openMap(origin);
      },
      () => openMap(),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  const submitReport = async () => {
    if (!reportStation || !reportFuel) return;
    if (!navigator.geolocation) {
      toast({
        title: 'อุปกรณ์ไม่รองรับตำแหน่ง',
        description: 'ไม่สามารถตรวจสอบตำแหน่งปัจจุบันได้',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingReport(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stationId: reportStation.id,
              fuelType: reportFuel,
              userLat: position.coords.latitude,
              userLng: position.coords.longitude,
            }),
          });

          const result = await response.json();
          if (!response.ok) {
            toast({
              title: 'ส่งรายงานไม่สำเร็จ',
              description: result?.error || result?.message || 'ไม่สามารถส่งรายงานได้',
              variant: 'destructive',
            });
            return;
          }

          toast({
            title: 'รับรายงานแล้ว',
            description: result?.message || 'ขอบคุณสำหรับการแจ้งข้อมูล',
          });
          setReportStation(null);
          fetchStations();
        } catch {
          toast({
            title: 'ส่งรายงานไม่สำเร็จ',
            description: 'เกิดข้อผิดพลาดระหว่างส่งข้อมูล',
            variant: 'destructive',
          });
        } finally {
          setSubmittingReport(false);
        }
      },
      () => {
        setSubmittingReport(false);
        toast({
          title: 'ไม่สามารถอ่านตำแหน่งปัจจุบัน',
          description: 'กรุณาอนุญาตตำแหน่งเพื่อส่งรายงาน',
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const enableNearFilter = () => {
    if (!userLocation) {
      centerOnUser();
    }
    setNearRangeKm((prev) => prev ?? 10);
    setShowNearPanel(true);
    setShowAvailablePanel(false);
  };

  const clearNearFilter = () => {
    setNearRangeKm(null);
    setShowNearPanel(false);
  };

  useEffect(() => {
    if (showFuelAssistant || showNearPanel) return;

    const timer = window.setInterval(() => {
      setAssistantQuote((prev) => {
        let next = prev;
        while (next === prev) {
          next = ASSISTANT_QUOTES[Math.floor(Math.random() * ASSISTANT_QUOTES.length)];
        }
        return next;
      });
    }, 20000);

    return () => window.clearInterval(timer);
  }, [showFuelAssistant, showNearPanel]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <header
        className="fixed left-0 right-0 z-40 px-3 pb-2 pt-2 md:px-4 md:pt-3"
        style={{ top: 'max(env(safe-area-inset-top), 8px)' }}
      >
        <div className="mx-auto max-w-6xl rounded-[28px] border border-white/20 bg-white/20 px-3 py-2.5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 rounded-2xl bg-emerald-600 p-2 text-white shadow-lg shadow-emerald-500/30">
                <Fuel className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold leading-tight md:text-lg">ค้นหาปั๊มน้ำมัน</h1>
                <p className="truncate text-[12px] text-muted-foreground md:text-xs">ปราจีนบุรี ประเทศไทย</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle variant="glass" />
              <Button
                size="icon"
                variant="ghost"
                className="rounded-xl border border-white/20 bg-white/15 text-foreground hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20"
                onClick={fetchStations}
                aria-label="refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="ค้นหาชื่อสถานีบริการ..."
                className="h-10 rounded-2xl border-white/20 bg-white/45 pl-9 text-sm shadow-inner dark:bg-white/10"
              />
              {search.trim().length > 0 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg"
                  onClick={() => {
                    setSearch('');
                    setShowSuggestions(false);
                  }}
                  aria-label="clear search input"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-12 z-50 w-full overflow-hidden rounded-2xl border border-white/25 bg-white/85 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
                  {suggestions.map((station) => (
                    <button
                      key={station.id}
                      type="button"
                      onMouseDown={() => zoomToStation(station)}
                      className="flex w-full items-center justify-between border-b border-border/40 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-white/70 dark:hover:bg-white/10"
                    >
                      <span className="truncate font-medium">{station.name}</span>
                      <span className="ml-3 text-xs text-muted-foreground">{BRAND_ASSET[station.brand]?.label || 'Other'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="absolute inset-0 z-0 pt-28 md:pt-32">
        {mapReady && (
          <MapContainer
            center={[PRACHINBURI_CENTER.lat, PRACHINBURI_CENTER.lng]}
            zoom={12}
            className="h-full w-full"
            zoomControl={false}
            preferCanvas
            zoomAnimation={false}
            markerZoomAnimation={false}
            ref={(ref: any) => setMapInstance(ref)}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url={
                isDark
                  ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              }
              updateWhenZooming={false}
            />
            <MarkersLayer
              stations={filteredStations}
              userLocation={userLocation}
              nearRangeKm={nearRangeKm}
              userAccuracyMeters={userAccuracyMeters}
              onNavigate={navigateToStation}
              onReport={allowReport ? (station) => {
                setReportStation(station);
                setReportFuel(station.fuels[0] || 'ดีเซล');
              } : undefined}
              onPopupVisibilityChange={setIsMapPopupOpen}
            />
          </MapContainer>
        )}
      </main>

      {reportStation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur-xl">
            <h3 className="text-base font-semibold">แจ้งน้ำมันหมด</h3>
            <p className="mt-1 text-xs text-slate-600">{reportStation.name}</p>
            <p className="mt-1 text-[11px] text-slate-500">ต้องอยู่ในระยะ 200 เมตรจากสถานี</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {reportStation.fuels.map((fuel) => (
                <Button
                  key={fuel}
                  size="sm"
                  variant="ghost"
                  className={`h-9 rounded-lg border ${reportFuel === fuel ? 'border-red-500 bg-red-600 text-white hover:bg-red-700' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  onClick={() => setReportFuel(fuel)}
                >
                  {FUEL_TYPES[fuel]?.label || fuel}
                </Button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => setReportStation(null)}
                disabled={submittingReport}
              >
                ยกเลิก
              </Button>
              <Button
                className="h-10 rounded-xl bg-red-600 text-white hover:bg-red-700"
                onClick={submitReport}
                disabled={submittingReport}
              >
                {submittingReport ? 'กำลังส่ง...' : 'ยืนยันรายงาน'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!isMapPopupOpen && (
      <div className={`fixed left-5 z-50 transition-all ${showNearPanel ? 'bottom-32' : 'bottom-52'}`}>
        <div className="flex items-end gap-2">
          <div>
          <Button
            size="icon"
            variant="ghost"
            className="assistant-drop h-14 w-14 rounded-full border-0 bg-transparent p-0 text-white shadow-none hover:bg-transparent"
            onClick={() => setShowFuelAssistant((v) => !v)}
            aria-label="open fuel assistant"
            title="ผู้ช่วยเลือกน้ำมัน"
          >
            <OilAssistant3D size={44} className="pointer-events-none" />
          </Button>
          </div>
          {!showFuelAssistant && !showNearPanel && (
            <div className="max-w-[260px] rounded-xl border border-slate-300/70 bg-white/85 px-3 py-2 text-[11px] leading-relaxed text-slate-700 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-black/25 dark:text-white">
              {assistantQuote}
            </div>
          )}
        </div>

        {showFuelAssistant && (
          <div className="mt-2 w-[210px] rounded-2xl border border-white/25 bg-white/20 p-3 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/10">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">ผู้ช่วยเลือกน้ำมัน</p>
              <button
                type="button"
                className="rounded-md px-1 text-xs text-muted-foreground hover:bg-white/20"
                onClick={() => setShowFuelAssistant(false)}
              >
                ปิด
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FUEL_FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.key}
                  size="sm"
                  variant="ghost"
                  className={`h-8 rounded-lg border border-white/20 text-[11px] ${
                    selectedFuelFilter === option.key
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-black/80 text-white dark:bg-white/10 dark:hover:bg-white/20'
                  }`}
                  onClick={() => setSelectedFuelFilter(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              แสดงเฉพาะสถานีที่มีน้ำมันชนิดที่เลือก (สถานะมีขาย)
            </p>
          </div>
        )}
      </div>
      )}

      <div className="fixed bottom-4 right-4 z-30">
        {showNearPanel && (
          <div className="mb-3 w-[220px] rounded-2xl border border-white/25 bg-white/20 p-3 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/10">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">ช่วงใกล้ฉัน</p>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg"
                onClick={() => setShowNearPanel(false)}
                aria-label="close near panel"
              >
                <CircleX className="h-4 w-4" />
              </Button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              {userLocation
                ? 'กำลังแสดงปั๊มตามระยะทางจากตำแหน่งของคุณ'
                : 'กดปุ่มตำแหน่งเพื่อเปิดระยะใกล้ฉันให้แม่นยำ'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-xl bg-black/80 text-white dark:bg-white/10"
                onClick={() => setNearRangeKm((v) => Math.max(1, (v ?? 10) - 1))}
                aria-label="decrease range"
              >
                -
              </Button>
              <div className="min-w-20 text-center text-sm font-semibold">{nearRangeKm ?? 10} กม.</div>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-xl bg-black/80 text-white dark:bg-white/10"
                onClick={() => setNearRangeKm((v) => Math.min(100, (v ?? 10) + 1))}
                aria-label="increase range"
              >
                +
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 w-full rounded-xl border border-white/20 bg-white/20 text-xs"
              onClick={clearNearFilter}
            >
              ล้างระยะ
            </Button>
            <input
              type="range"
              min={1}
              max={100}
              value={nearRangeKm ?? 10}
              onChange={(e) => setNearRangeKm(Number(e.target.value))}
              className="mt-3 w-full accent-emerald-500"
            />
          </div>
        )}
        <div className="flex items-center gap-2 rounded-2xl border border-white/25 bg-white/20 p-2 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/10">
          <Button
            size="icon"
            variant="ghost"
            className="h-11 w-11 rounded-xl bg-black/80 text-white hover:bg-black/90 dark:bg-white/10 dark:hover:bg-white/20"
            onClick={() => mapInstance?.zoomIn()}
            aria-label="zoom in"
          >
            +
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-11 w-11 rounded-xl bg-black/80 text-white hover:bg-black/90 dark:bg-white/10 dark:hover:bg-white/20"
            onClick={() => mapInstance?.zoomOut()}
            aria-label="zoom out"
          >
            -
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-11 w-11 rounded-xl bg-black/80 text-white hover:bg-black/90 dark:bg-white/10 dark:hover:bg-white/20"
            onClick={centerOnUser}
            aria-label="my location"
          >
            <Navigation className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={`h-11 w-11 rounded-xl ${nearRangeKm ? 'bg-emerald-600 text-white' : 'bg-black/80 text-white dark:bg-white/10 dark:hover:bg-white/20'}`}
            onClick={enableNearFilter}
            aria-label="nearby range filter"
            title="ใกล้ฉัน"
          >
            <MapPin className="h-4 w-4" />
          </Button>
          {nearRangeKm && (
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11 rounded-xl bg-red-600/90 text-white hover:bg-red-600"
              onClick={clearNearFilter}
              aria-label="clear nearby range filter"
              title="ล้างช่วงระยะ"
            >
              <CircleX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!showNearPanel && (
      <div className="fixed bottom-24 left-1/2 z-30 w-[min(88vw,500px)] -translate-x-1/2 transition-all">
        <div className="rounded-2xl border border-white/25 bg-white/25 p-1.5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/10">
          <div className="mb-1.5 flex items-center justify-between px-1.5">
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              สถานีที่มีน้ำมันขาย ({availableStations.length})
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-lg"
              onClick={() => setShowAvailablePanel((v) => !v)}
              aria-label="toggle available stations slider"
            >
              {showAvailablePanel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>

          {showAvailablePanel && (
            <>
              {availableStations.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 rounded-xl bg-black/80 text-white dark:bg-white/10"
                    onClick={() => focusAvailableStation(availableIndex - 1)}
                    aria-label="previous available station"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <button
                    type="button"
                    onClick={() => zoomToStation(availableStations[availableIndex])}
                    className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/50 px-2.5 py-1.5 text-left hover:bg-white/70 dark:bg-white/10 dark:hover:bg-white/20"
                  >
                    <p className="truncate text-[15px] font-semibold">{availableStations[availableIndex]?.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {availableStations[availableIndex]?.address}
                    </p>
                  </button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 rounded-xl bg-black/80 text-white dark:bg-white/10"
                    onClick={() => focusAvailableStation(availableIndex + 1)}
                    aria-label="next available station"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-white/20 bg-white/40 px-3 py-1.5 text-[11px] text-muted-foreground dark:bg-white/5">
                  ไม่พบสถานีที่มีสถานะ &quot;มีขาย&quot; ตามเงื่อนไขค้นหาปัจจุบัน
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}

      <div className="fixed bottom-4 left-4 z-30 rounded-2xl border border-white/25 bg-white/20 px-3.5 py-2.5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/10">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-blue-500/20 p-1.5">
            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <p className="text-base font-semibold leading-none">{filteredStations.length}</p>
            <p className="text-[11px] text-muted-foreground">สถานีบริการ</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .brand-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-container {
          background: #0f172a;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 18px !important;
          backdrop-filter: blur(16px);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          min-width: 280px;
        }
        .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.88) !important;
        }
        .assistant-drop {
          animation: assistantFloat 2.8s ease-in-out infinite;
          transform-origin: center;
        }
        .assistant-drop svg {
          animation: assistantWobble 3.1s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes assistantFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes assistantWobble {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(-4deg) scale(1.02); }
          50% { transform: rotate(0deg) scale(0.98); }
          75% { transform: rotate(4deg) scale(1.02); }
        }
      `}</style>
    </div>
  );
}
