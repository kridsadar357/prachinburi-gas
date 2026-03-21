'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Fuel, MapPin, Navigation, AlertTriangle, Check, X, 
  Wifi, WifiOff, Plus, Minus,
  RefreshCw, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';

// Types
interface Station {
  id: string;
  name: string;
  brand: string;
  address: string;
  fuels: string[];
  hours: string;
  lat: number;
  lng: number;
}

interface OutOfStockStatus {
  stationId: string;
  outOfStock: string[];
  lastUpdated: string;
}

interface StationFeature {
  type: string;
  properties: {
    id: string;
    name: string;
    brand: string;
    address: string;
    fuels: string[];
    hours: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number];
  };
}

// Prachinburi center coordinates
const PRACHINBURI_CENTER = { lat: 14.0509, lng: 101.3689 };
const MAX_DISTANCE_METERS = 200;

// ประเภทน้ำมันทั้งหมด
const FUEL_TYPES: Record<string, { label: string; color: string }> = {
  '95': { label: 'แก๊สโซฮอล์ 95', color: 'bg-green-500' },
  '91': { label: 'แก๊สโซฮอล์ 91', color: 'bg-blue-500' },
  'E20': { label: 'แก๊สโซฮอล์ E20', color: 'bg-yellow-500' },
  'E85': { label: 'แก๊สโซฮอล์ E85', color: 'bg-orange-500' },
  'B7': { label: 'ไบโอดีเซล B7', color: 'bg-amber-600' },
  'B20': { label: 'ไบโอดีเซล B20', color: 'bg-amber-700' },
  'ดีเซล': { label: 'ดีเซล', color: 'bg-gray-600' },
};

// Dynamic import of MapContainer (no SSR)
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

// Map component with markers
function MapComponent({ 
  stations, 
  outOfStockStatus, 
  onStationSelect 
}: { 
  stations: Station[]; 
  outOfStockStatus: OutOfStockStatus[];
  onStationSelect: (station: Station) => void;
}) {
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkersLayer 
        stations={stations} 
        outOfStockStatus={outOfStockStatus} 
        onStationSelect={onStationSelect}
      />
    </>
  );
}

// Dynamic imports for react-leaflet components
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

// Markers layer component
function MarkersLayer({ 
  stations, 
  outOfStockStatus, 
  onStationSelect 
}: { 
  stations: Station[]; 
  outOfStockStatus: OutOfStockStatus[];
  onStationSelect: (station: Station) => void;
}) {
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    import('leaflet').then((mod) => {
      const leaflet = mod.default;
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setL(leaflet);
    });
  }, []);

  if (!L) return null;

  // Create custom icon
  const createIcon = (hasWarning: boolean) => {
    const html = `
      <div class="relative" style="transform: translate(-50%, -100%);">
        <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${hasWarning ? 'bg-red-500' : 'bg-emerald-500'}">
          <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"/>
          </svg>
        </div>
        ${hasWarning ? '<div class="absolute -top-1 -right-3 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center"><span class="text-xs font-bold text-black">!</span></div>' : ''}
      </div>
    `;
    
    return L.divIcon({
      html,
      className: 'custom-marker',
      iconSize: [40, 50],
      iconAnchor: [20, 50],
    });
  };

  return (
    <>
      {stations.map((station) => {
        const hasWarning = outOfStockStatus.some(
          status => status.stationId === station.id && status.outOfStock.length > 0
        );
        const outOfStockInfo = outOfStockStatus.find(s => s.stationId === station.id);

        return (
          <Marker 
            key={station.id} 
            position={[station.lat, station.lng]}
            icon={createIcon(hasWarning)}
          >
            <Popup className="custom-popup">
              <div className="p-3 min-w-[220px]">
                <h3 className="font-bold text-lg text-gray-800">{station.name}</h3>
                <p className="text-sm text-gray-500">{station.brand}</p>
                <p className="text-xs text-gray-400 mt-1">{station.address}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {station.fuels.map(f => {
                    const fuelInfo = FUEL_TYPES[f] || { label: f, color: 'bg-gray-400' };
                    const isOutOfStock = outOfStockInfo?.outOfStock.includes(f);
                    return (
                      <span 
                        key={f} 
                        className={`px-2 py-0.5 text-xs rounded-full ${isOutOfStock ? 'bg-red-100 text-red-600 line-through' : fuelInfo.color + ' text-white'}`}
                      >
                        {f}
                      </span>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">🕐 {station.hours}</p>
                {outOfStockInfo && outOfStockInfo.outOfStock.length > 0 && (
                  <div className="mt-2 p-2 bg-red-50 rounded-lg">
                    <p className="text-xs font-semibold text-red-600">⚠️ น้ำมันหมด:</p>
                    <p className="text-xs text-red-500">{outOfStockInfo.outOfStock.map(f => FUEL_TYPES[f]?.label || f).join(', ')}</p>
                  </div>
                )}
                <button 
                  onClick={() => onStationSelect(station)}
                  className="w-full mt-3 px-3 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  แจ้งน้ำมันหมด
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default function Home() {
  const [stations, setStations] = useState<Station[]>([]);
  const [outOfStockStatus, setOutOfStockStatus] = useState<OutOfStockStatus[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedFuelType, setSelectedFuelType] = useState<string>('');
  const [isReporting, setIsReporting] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  
  // Initialize
  useEffect(() => {
    // Load stations and status
    fetchStations();
    fetchStatus();

    // Online/offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }

    // Set map ready after client-side mount
    setMapReady(true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Fetch stations from API
  const fetchStations = async () => {
    try {
      const response = await fetch('/api/stations');
      const data = await response.json();
      
      const stationList: Station[] = data.features.map((feature: StationFeature) => ({
        id: feature.properties.id,
        name: feature.properties.name,
        brand: feature.properties.brand,
        address: feature.properties.address,
        fuels: feature.properties.fuels,
        hours: feature.properties.hours,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0]
      }));
      
      setStations(stationList);
    } catch (error) {
      console.error('Failed to fetch stations:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลปั๊มน้ำมันได้',
        variant: 'destructive'
      });
    }
  };

  // Fetch out of stock status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setOutOfStockStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  // Get user location
  const getUserLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          resolve(location);
        },
        (error) => {
          let message = 'ไม่สามารถระบุตำแหน่งของคุณได้';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'คุณปฏิเสธการเข้าถึงตำแหน่ง กรุณาอนุญาตการเข้าถึงตำแหน่ง';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'ข้อมูลตำแหน่งไม่พร้อมใช้งาน';
              break;
            case error.TIMEOUT:
              message = 'หมดเวลาในการขอตำแหน่ง';
              break;
          }
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Handle station selection for report
  const handleStationSelect = (station: Station) => {
    setSelectedStation(station);
    setShowReportDialog(true);
  };

  // Handle report submission
  const handleReport = async () => {
    if (!selectedStation || !selectedFuelType) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'กรุณาเลือกประเภทน้ำมัน',
        variant: 'destructive'
      });
      return;
    }

    setIsReporting(true);

    try {
      // Get user location
      const location = await getUserLocation();
      
      // Calculate distance to station
      const distance = calculateDistance(
        location.lat, location.lng,
        selectedStation.lat, selectedStation.lng
      );

      // Check if within 200 meters
      if (distance > MAX_DISTANCE_METERS) {
        toast({
          title: 'อยู่ไกลเกินไป',
          description: `คุณอยู่ห่างจากปั๊ม ${Math.round(distance)} เมตร ต้องอยู่ในรัศมี ${MAX_DISTANCE_METERS} เมตรจึงจะสามารถแจ้งได้`,
          variant: 'destructive'
        });
        setIsReporting(false);
        return;
      }

      // Submit report
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: selectedStation.id,
          fuelType: selectedFuelType
        })
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.thresholdReached) {
        toast({
          title: 'ขอบคุณครับ/ค่ะ!',
          description: `${FUEL_TYPES[selectedFuelType]?.label || selectedFuelType} ที่ ${selectedStation.name} ถูกระบุว่าหมดแล้ว`,
        });
      } else {
        toast({
          title: 'ส่งรายงานสำเร็จ',
          description: `ต้องการรายงานอีก ${result.reportsNeeded} ครั้งเพื่อยืนยัน`,
        });
      }

      // Refresh status
      fetchStatus();
      setShowReportDialog(false);
      setSelectedFuelType('');

    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถส่งรายงานได้',
        variant: 'destructive'
      });
    }

    setIsReporting(false);
  };

  // Center on user location
  const centerOnUser = async () => {
    try {
      const location = await getUserLocation();
      if (mapInstance) {
        mapInstance.setView([location.lat, location.lng], 16);
      }
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาดในการระบุตำแหน่ง',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Zoom controls
  const zoomIn = () => mapInstance?.zoomIn();
  const zoomOut = () => mapInstance?.zoomOut();

  // Install PWA
  const installPWA = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* 3D Floating Header */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 right-0 z-50 p-4"
      >
        <div className="max-w-lg mx-auto">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Fuel className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">ค้นหาปั๊มน้ำมัน</h1>
                  <p className="text-xs text-gray-400">ปราจีนบุรี ประเทศไทย</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Online/Offline indicator */}
                <Badge 
                  variant={isOnline ? "default" : "destructive"}
                  className="rounded-full px-3"
                >
                  {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                  {isOnline ? 'ออนไลน์' : 'ออฟไลน์'}
                </Badge>
                {/* Refresh button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full bg-white/10 hover:bg-white/20"
                  onClick={() => { fetchStations(); fetchStatus(); }}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Map Container */}
      <div className="absolute inset-0 z-0">
        {mapReady && (
          <MapContainer
            center={[PRACHINBURI_CENTER.lat, PRACHINBURI_CENTER.lng]}
            zoom={13}
            className="h-full w-full"
            zoomControl={false}
            ref={(ref: any) => setMapInstance(ref)}
          >
            <MapComponent 
              stations={stations}
              outOfStockStatus={outOfStockStatus}
              onStationSelect={handleStationSelect}
            />
          </MapContainer>
        )}
      </div>

      {/* 3D Map Controls */}
      <motion.div 
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2"
      >
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-2 shadow-2xl">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-xl bg-white/10 hover:bg-white/20 text-white w-12 h-12"
            onClick={zoomIn}
          >
            <Plus className="w-5 h-5" />
          </Button>
          <div className="h-px bg-white/10 my-1" />
          <Button
            size="icon"
            variant="ghost"
            className="rounded-xl bg-white/10 hover:bg-white/20 text-white w-12 h-12"
            onClick={zoomOut}
          >
            <Minus className="w-5 h-5" />
          </Button>
          <div className="h-px bg-white/10 my-1" />
          <Button
            size="icon"
            variant="ghost"
            className="rounded-xl bg-white/10 hover:bg-white/20 text-white w-12 h-12"
            onClick={centerOnUser}
          >
            <Navigation className="w-5 h-5" />
          </Button>
        </div>
      </motion.div>

      {/* Station Count Badge */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-32 left-4 z-40"
      >
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 px-4 py-3 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stations.length}</p>
              <p className="text-xs text-gray-400">สถานีบริการ</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Out of Stock Summary */}
      {outOfStockStatus.length > 0 && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="fixed bottom-32 right-4 z-40"
        >
          <div className="bg-red-500/20 backdrop-blur-xl rounded-2xl border border-red-500/30 px-4 py-3 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{outOfStockStatus.length}</p>
                <p className="text-xs text-red-300">น้ำมันหมด</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 3D Bottom Info Panel */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="fixed bottom-0 left-0 right-0 z-40 p-4"
      >
        <div className="max-w-lg mx-auto">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">ประเภทน้ำมันที่จำหน่าย</h3>
              <Badge variant="secondary" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                อัปเดตสด
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FUEL_TYPES).map(([key, value]) => (
                <div 
                  key={key}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium text-white ${value.color}`}
                >
                  {value.label}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              แตะที่ตัวปั๊มน้ำมันเพื่อแจ้งน้ำมันหมด
            </p>
          </div>
        </div>
      </motion.div>

      {/* PWA Install Prompt */}
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed top-20 left-4 right-4 z-50"
          >
            <div className="max-w-lg mx-auto">
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl shadow-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <Fuel className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">ติดตั้งแอป</p>
                      <p className="text-white/70 text-xs">เพิ่มลงหน้าจอหลักเพื่อเข้าถึงง่าย</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={() => setShowInstallPrompt(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-white text-emerald-600 hover:bg-white/90"
                      onClick={installPWA}
                    >
                      ติดตั้ง
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              แจ้งน้ำมันหมด
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              แจ้งน้ำมันหมดที่ <span className="text-emerald-400 font-medium">{selectedStation?.name}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-gray-400 mb-4">
              เลือกประเภทน้ำมันที่หมด คุณต้องอยู่ในรัศมี 200 เมตรจากปั๊มจึงจะสามารถแจ้งได้
            </p>
            
            <Select value={selectedFuelType} onValueChange={setSelectedFuelType}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="เลือกประเภทน้ำมัน" />
              </SelectTrigger>
              <SelectContent>
                {selectedStation?.fuels.map(fuel => (
                  <SelectItem key={fuel} value={fuel}>
                    {FUEL_TYPES[fuel]?.label || fuel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-400">
                <Navigation className="w-3 h-3 inline mr-1" />
                ตำแหน่งของคุณจะถูกตรวจสอบก่อนส่งรายงาน
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => setShowReportDialog(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600"
              onClick={handleReport}
              disabled={isReporting || !selectedFuelType}
            >
              {isReporting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  ส่งรายงาน
                </>
                )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSS for custom markers and popups */}
      <style jsx global>{`
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        .user-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 16px !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          min-width: 200px !important;
        }
        .leaflet-popup-tip {
          background: white !important;
        }
        .leaflet-container {
          background: #1e293b !important;
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .animate-ping {
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>

      <Toaster />
    </div>
  );
}
