"use client";

import { DollarSign, Clock, TrendingUp, Calendar, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// --- Types ---

interface Recording {
  id: string;
  title: string;
  host: string;
  date: string;
  duration: string;
}

interface CostSummary {
  totalMinutes: number;
  totalCostUSD: number;
  totalCostMXN: number;
  count: number;
}

// --- Constants ---

const COST_PER_HOUR_USD = 0.65;
const USD_TO_MXN = 18;
const COST_PER_MINUTE_USD = COST_PER_HOUR_USD / 60;

const HOST_TABS = ["Todos", "Operaciones", "Andres", "Pablo", "Rafa", "Wisdom", "Biofleming", "Inbest", "Blindaje360"];

// --- Helpers ---

function parseDurationToMinutes(duration: string): number {
  if (!duration) return 0;
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  }
  if (parts.length === 2) {
    return parts[0] + parts[1] / 60;
  }
  return 0;
}

function formatMoney(amount: number, currency: "USD" | "MXN"): string {
  return currency === "USD"
    ? `$${amount.toFixed(2)} USD`
    : `$${amount.toFixed(2)} MXN`;
}

function formatMinutes(totalMin: number): string {
  const hours = Math.floor(totalMin / 60);
  const mins = Math.round(totalMin % 60);
  if (hours === 0) return `${mins} min`;
  return `${hours}h ${mins}m`;
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isInRange(dateStr: string, start: Date, end: Date): boolean {
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

function calcSummary(recordings: Recording[]): CostSummary {
  const totalMinutes = recordings.reduce((sum, r) => sum + parseDurationToMinutes(r.duration), 0);
  const totalCostUSD = totalMinutes * COST_PER_MINUTE_USD;
  const totalCostMXN = totalCostUSD * USD_TO_MXN;
  return { totalMinutes, totalCostUSD, totalCostMXN, count: recordings.length };
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// --- Component ---

export default function CostosPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeHost, setActiveHost] = useState("Todos");

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("recordings")
      .select("id, title, host, date, duration")
      .order("date", { ascending: false });

    if (!error && data) {
      setRecordings(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // Filter by host
  const filtered = activeHost === "Todos"
    ? recordings
    : recordings.filter((r) => r.host.toLowerCase() === activeHost.toLowerCase());

  // Period calculations
  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekRange(now);
  const { start: monthStart, end: monthEnd } = getMonthRange(now);

  const todayRecs = filtered.filter((r) => isToday(r.date));
  const weekRecs = filtered.filter((r) => isInRange(r.date, weekStart, weekEnd));
  const monthRecs = filtered.filter((r) => isInRange(r.date, monthStart, monthEnd));

  const todaySummary = calcSummary(todayRecs);
  const weekSummary = calcSummary(weekRecs);
  const monthSummary = calcSummary(monthRecs);
  const totalSummary = calcSummary(filtered);

  // Per-host breakdown for the month
  const hostBreakdown = HOST_TABS.filter((h) => h !== "Todos").map((host) => {
    const hostRecs = recordings.filter(
      (r) => r.host.toLowerCase() === host.toLowerCase() && isInRange(r.date, monthStart, monthEnd)
    );
    return { host, ...calcSummary(hostRecs) };
  }).filter((h) => h.count > 0).sort((a, b) => b.totalCostMXN - a.totalCostMXN);

  const cards = [
    { label: "Hoy", icon: Clock, summary: todaySummary, color: "#10b981" },
    { label: "Esta semana", icon: Calendar, summary: weekSummary, color: "#2055e4" },
    { label: "Este mes", icon: TrendingUp, summary: monthSummary, color: "#8b5cf6" },
    { label: "Total histórico", icon: DollarSign, summary: totalSummary, color: "#f59e0b" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
            Costos de Grabación
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            ${COST_PER_HOUR_USD} USD/hora &middot; $1 USD = ${USD_TO_MXN} MXN
          </p>
        </div>
        <button
          onClick={fetchRecordings}
          disabled={loading}
          className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Refrescar"
        >
          <RefreshCw size={18} className={loading ? "animate-spin text-[#2055e4]" : "text-gray-500"} />
        </button>
      </div>

      {/* Host tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        {HOST_TABS.map((host) => (
          <button
            key={host}
            onClick={() => setActiveHost(host)}
            className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
              activeHost === host
                ? "bg-[#2055e4] text-white shadow-md"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-[#2055e4]/30"
            }`}
          >
            {host}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#2055e4]" size={32} />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="relative overflow-hidden bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
                >
                  <div
                    className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10"
                    style={{ background: card.color }}
                  />
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="p-2 rounded-lg text-white"
                      style={{ background: card.color }}
                    >
                      <Icon size={18} />
                    </div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {card.label}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatMoney(card.summary.totalCostMXN, "MXN")}
                  </p>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatMoney(card.summary.totalCostUSD, "USD")}</span>
                    <span>{card.summary.count} reuniones</span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatMinutes(card.summary.totalMinutes)} grabadas
                  </p>
                </div>
              );
            })}
          </div>

          {/* Host breakdown (month) */}
          {activeHost === "Todos" && hostBreakdown.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Desglose por host — este mes
              </h2>
              <div className="space-y-3">
                {hostBreakdown.map((h) => {
                  const maxCost = hostBreakdown[0].totalCostMXN || 1;
                  const pct = (h.totalCostMXN / maxCost) * 100;
                  return (
                    <div key={h.host}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {h.host}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span>{h.count} reuniones</span>
                          <span>{formatMinutes(h.totalMinutes)}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {formatMoney(h.totalCostMXN, "MXN")}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: "linear-gradient(135deg, #2055e4, #5980ff)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent recordings table */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Últimas grabaciones {activeHost !== "Todos" && `— ${activeHost}`}
            </h2>
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Sin grabaciones</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                      <th className="pb-3 font-medium">Reunión</th>
                      <th className="pb-3 font-medium">Host</th>
                      <th className="pb-3 font-medium">Fecha</th>
                      <th className="pb-3 font-medium">Duración</th>
                      <th className="pb-3 font-medium text-right">Costo USD</th>
                      <th className="pb-3 font-medium text-right">Costo MXN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 50).map((r) => {
                      const mins = parseDurationToMinutes(r.duration);
                      const costUSD = mins * COST_PER_MINUTE_USD;
                      const costMXN = costUSD * USD_TO_MXN;
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-gray-50 dark:border-gray-800 last:border-0"
                        >
                          <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                            {r.title}
                          </td>
                          <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                            {r.host}
                          </td>
                          <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                            {formatDate(r.date)}
                          </td>
                          <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                            {r.duration || "—"}
                          </td>
                          <td className="py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                            ${costUSD.toFixed(2)}
                          </td>
                          <td className="py-3 text-right font-semibold text-gray-900 dark:text-white font-mono">
                            ${costMXN.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
