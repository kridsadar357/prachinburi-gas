"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type StationRow = {
  id: string;
  name: string;
  district: string;
  brandId: string;
};

export default function BlocklistAdminPage() {
  const [secret, setSecret] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (secret.trim()) h["x-admin-secret"] = secret.trim();
    return h;
  }, [secret]);

  const loadData = useCallback(async () => {
    if (!secret.trim()) {
      toast({
        title: "กรอกรหัสผู้ดูแล",
        description: "ตั้งค่า STATION_BLOCKLIST_ADMIN_SECRET ใน Vercel แล้ววางที่นี่",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const [stRes, hidRes] = await Promise.all([
        fetch("/api/admin/stations", { headers }),
        fetch("/api/admin/hidden-stations", { headers }),
      ]);
      if (!stRes.ok || !hidRes.ok) {
        const failed = !stRes.ok ? stRes : hidRes;
        const errJson = await failed.json().catch(() => ({}));
        const hint =
          typeof errJson?.hint === "string"
            ? errJson.hint
            : failed.status === 401
              ? "ตั้ง STATION_BLOCKLIST_ADMIN_SECRET ใน .env แล้วรีสตาร์ท dev server"
              : undefined;
        const detail =
          typeof errJson?.detail === "string" ? errJson.detail : undefined;
        toast({
          title: "โหลดไม่สำเร็จ",
          description: [hint, detail].filter(Boolean).join(" — ") || `HTTP ${failed.status}`,
          variant: "destructive",
        });
        return;
      }
      const stJson = await stRes.json();
      const hidJson = await hidRes.json();
      setStations(stJson.stations || []);
      const ids = new Set<string>(
        (hidJson.stations || []).map((r: { stationId: string }) => r.stationId)
      );
      setBlocked(ids);
      setLoaded(true);
      toast({ title: "โหลดแล้ว", description: `${stJson.stations?.length ?? 0} สถานี` });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [headers, secret]);

  const save = useCallback(async () => {
    if (!secret.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/hidden-stations", {
        method: "PUT",
        headers,
        body: JSON.stringify({ stationIds: Array.from(blocked) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "บันทึกไม่สำเร็จ",
          description: data?.error || `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "บันทึกแล้ว",
        description: `บล็อก ${data.count ?? blocked.size} สถานี (ในฐานข้อมูล)`,
      });
    } catch {
      toast({ title: "บันทึกไม่สำเร็จ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [blocked, headers, secret]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.district.toLowerCase().includes(q)
    );
  }, [stations, filter]);

  const toggle = (id: string, checked: boolean) => {
    setBlocked((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setBlocked((prev) => {
      const next = new Set(prev);
      for (const s of filtered) next.add(s.id);
      return next;
    });
  };

  const clearFiltered = () => {
    setBlocked((prev) => {
      const next = new Set(prev);
      for (const s of filtered) next.delete(s.id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="text-slate-300">
            <Link href="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              กลับแผนที่
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">บล็อกปั๊มที่ไม่แสดงบนแผนที่</h1>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <p className="mb-3 text-sm text-slate-400">
            ใส่รหัสเดียวกับ <code className="rounded bg-white/10 px-1">STATION_BLOCKLIST_ADMIN_SECRET</code> ใน
            Vercel แล้วกดโหลด — ติ๊กปั๊มที่ต้องการซ่อน แล้วกดบันทึก
          </p>
          <p className="mb-3 text-xs text-amber-200/90">
            หมายเหตุ: รายการใน env <code className="rounded bg-white/10 px-1">HIDDEN_STATION_IDS</code> ยังซ่อนอยู่
            แต่ไม่แสดงในตารางนี้ — แก้ได้ที่ Environment เท่านั้น
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              type="password"
              placeholder="รหัสผู้ดูแล"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="max-w-xs border-white/20 bg-white/10"
            />
            <Button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "โหลดรายการ"}
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={!loaded || saving}
              variant="secondary"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              บันทึกการบล็อก
            </Button>
          </div>
        </div>

        {loaded && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Input
                placeholder="ค้นหาชื่อ / อำเภอ / ID..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="max-w-md border-white/20 bg-white/10"
              />
              <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered} className="border-white/20">
                เลือกทั้งหมดที่ค้นเจอ
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearFiltered} className="border-white/20">
                ยกเลิกในที่ค้นเจอ
              </Button>
              <span className="text-sm text-slate-400">
                แสดง {filtered.length} / {stations.length} — บล็อก {blocked.size} แห่ง
              </span>
            </div>

            <div className="max-h-[65vh] overflow-auto rounded-2xl border border-white/10">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
                  <tr className="border-b border-white/10">
                    <th className="w-10 p-2" />
                    <th className="p-2 font-medium">ชื่อสถานี</th>
                    <th className="p-2 font-medium">ยี่ห้อ</th>
                    <th className="p-2 font-medium">อำเภอ</th>
                    <th className="p-2 font-mono text-xs text-slate-400">stationId</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-2 align-top">
                        <Checkbox
                          checked={blocked.has(s.id)}
                          onCheckedChange={(v) => toggle(s.id, v === true)}
                        />
                      </td>
                      <td className="p-2 align-top">{s.name}</td>
                      <td className="p-2 align-top">{s.brandId}</td>
                      <td className="p-2 align-top">{s.district}</td>
                      <td className="p-2 align-top font-mono text-xs text-slate-500">{s.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
