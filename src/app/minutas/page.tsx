"use client";

import { FileText, Sparkles, Loader2, X, Pencil, Download, CloudUpload, Check, LayoutTemplate, RefreshCw, AlertCircle } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import DataTable from "@/components/DataTable";

// --- Types ---

interface ParticipationEntry {
  name: string;
  pct: number;
}

interface MinutaData {
  minutaReunion: string;
  fecha: string;
  asistentes: string;
  participacion: ParticipationEntry[];
  ordenDelDia: string[];
  pendientes: string[];
  resumen: string;
  conclusion: string;
}

interface AutoMinuta {
  id: string;
  recording_id: string;
  recall_bot_id: string;
  host: string;
  title: string;
  fecha: string;
  status: "generating" | "ready" | "saved" | "error";
  minuta_data: MinutaData | null;
  drive_link: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  logoDataUrl: string | null;
  createdAt: string;
}

// --- Constants ---

const HOST_TABS = ["Todos", "Operaciones", "Andres", "Pablo", "Rafa", "Wisdom", "Biofleming", "Inbest"];
const TEMPLATE_WIDTH = 794;

const DEFAULT_TEMPLATE: SavedTemplate = {
  id: "default",
  name: "Default",
  primary: "#2055e4",
  secondary: "#5980ff",
  logoDataUrl: null,
  createdAt: "",
};

// --- Helpers ---

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

// --- Pie chart SVG ---
function PieChart({ data, primary, secondary }: { data: ParticipationEntry[]; primary: string; secondary: string }) {
  const pieColors = [primary, secondary, `${primary}aa`, `${secondary}aa`, "#cbd5e1"];
  const total = data.reduce((s, d) => s + d.pct, 0) || 1;
  let cumAngle = -90;

  const slices = data.map((item, i) => {
    const angle = (item.pct / total) * 360;
    const startRad = (cumAngle * Math.PI) / 180;
    cumAngle += angle;
    const endRad = (cumAngle * Math.PI) / 180;
    const r = 50, cx = 60, cy = 60;
    const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad), y2 = cy + r * Math.sin(endRad);
    return <path key={i} d={`M${cx} ${cy}L${x1} ${y1}A${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2}Z`} fill={pieColors[i % pieColors.length]} />;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
      <svg viewBox="0 0 120 120" style={{ width: "150px", height: "150px", flexShrink: 0 }}>{slices}</svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {data.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "2px", flexShrink: 0, backgroundColor: pieColors[i % pieColors.length] }} />
            <span style={{ fontSize: "13px", color: "#374151" }}>{item.name}</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827", marginLeft: "4px" }}>{item.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Card wrapper ---
function TemplateCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", overflow: "hidden", display: "flex", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ width: "6px", flexShrink: 0, backgroundColor: color }} />
      <div style={{ padding: "20px", flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color, marginBottom: "12px" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// --- Editable field ---
function EditableField({ label, value, onChange, rows = 1 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all resize-y leading-relaxed" />
    </div>
  );
}

// --- Status badge ---
function StatusBadge({ status }: { status: AutoMinuta["status"] }) {
  const config = {
    generating: { label: "Generando...", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400 animate-pulse" },
    ready: { label: "Lista", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
    saved: { label: "En Drive", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
    error: { label: "Error", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${config.bg} ${config.text} ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// --- Minuta Modal ---
function AutoMinutaModal({
  autoMinuta,
  template,
  onClose,
  onSaved,
  onRetry,
}: {
  autoMinuta: AutoMinuta;
  template: SavedTemplate;
  onClose: () => void;
  onSaved: () => void;
  onRetry: (id: string) => void;
}) {
  const templateRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ link: string } | null>(
    autoMinuta.drive_link ? { link: autoMinuta.drive_link } : null
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState<MinutaData>(autoMinuta.minuta_data!);
  const [saving, setSaving] = useState(false);

  const { primary, secondary, logoDataUrl } = template;
  const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" };
  const textStyle: React.CSSProperties = { fontSize: "13px", color: "#1f2937", lineHeight: 1.5 };
  const listItemStyle: React.CSSProperties = { fontSize: "13px", color: "#374151", lineHeight: 1.6 };

  const updateField = (key: keyof MinutaData, value: string | string[]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const updateListItem = (key: "ordenDelDia" | "pendientes", index: number, value: string) => {
    setData((prev) => {
      const list = [...prev[key]];
      list[index] = value;
      return { ...prev, [key]: list };
    });
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      await fetch(`/api/auto-minutas/${autoMinuta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minuta_data: data }),
      });
      setEditing(false);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!templateRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(templateRef.current, { scale: 2, useCORS: true, backgroundColor: "#eef1f5", width: TEMPLATE_WIDTH, windowWidth: TEMPLATE_WIDTH });
      const imgData = canvas.toDataURL("image/png");
      const pdfW = 210, pdfH = (canvas.height * pdfW) / canvas.width;
      const pdf = new jsPDF("p", "mm", [pdfW, pdfH]);
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`minuta-${data.minutaReunion.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveToDrive = async () => {
    if (!templateRef.current) return;
    setUploading(true);
    setUploadError(null);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(templateRef.current, { scale: 1.5, useCORS: true, backgroundColor: "#eef1f5", width: TEMPLATE_WIDTH, windowWidth: TEMPLATE_WIDTH });
      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const pdfW = 210, pdfH = (canvas.height * pdfW) / canvas.width;
      const pdf = new jsPDF("p", "mm", [pdfW, pdfH]);
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);

      const pdfBase64 = pdf.output("datauristring").split(",")[1];
      const fileName = `minuta-${data.minutaReunion.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.pdf`;

      const res = await fetch(`/api/auto-minutas/${autoMinuta.id}/save-to-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64,
          fileName,
          meetingTitle: data.minutaReunion,
          cliente: autoMinuta.host,
          fecha: data.fecha,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let errorMsg = "Error al subir";
        try { errorMsg = JSON.parse(text).error || errorMsg; } catch { errorMsg = res.status === 413 ? "El archivo es demasiado grande" : `Error ${res.status}`; }
        throw new Error(errorMsg);
      }
      const result = await res.json();
      setUploadResult({ link: result.link });
      onSaved();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al guardar en Drive");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[900px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-[#2055e4]" />
            <h3 className="font-semibold text-gray-900">Minuta generada</h3>
            <StatusBadge status={autoMinuta.status} />
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <button
                onClick={handleSaveEdits}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 transition-all hover:bg-emerald-100"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Guardar cambios
              </button>
            ) : null}
            <button
              onClick={() => setEditing(!editing)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                editing
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Pencil size={14} />
              {editing ? "Vista previa" : "Editar"}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading || editing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              PDF
            </button>
            {uploadResult ? (
              <a
                href={uploadResult.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
              >
                <Check size={14} /> En Drive
              </a>
            ) : (
              <button
                onClick={handleSaveToDrive}
                disabled={uploading || editing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
                {uploading ? "Guardando..." : "Guardar en Drive"}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            {uploadError}
          </div>
        )}

        {editing ? (
          /* Edit mode */
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <EditableField label="Reunion" value={data.minutaReunion} onChange={(v) => updateField("minutaReunion", v)} />
                <EditableField label="Fecha" value={data.fecha} onChange={(v) => updateField("fecha", v)} />
                <EditableField label="Asistentes" value={data.asistentes} onChange={(v) => updateField("asistentes", v)} rows={2} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Participacion</label>
                <div className="space-y-2">
                  {data.participacion.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={p.name} onChange={(e) => {
                        const list = [...data.participacion]; list[i] = { ...list[i], name: e.target.value };
                        setData((prev) => ({ ...prev, participacion: list }));
                      }} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" placeholder="Nombre" />
                      <div className="flex items-center gap-1">
                        <input type="number" value={p.pct} onChange={(e) => {
                          const list = [...data.participacion]; list[i] = { ...list[i], pct: Number(e.target.value) };
                          setData((prev) => ({ ...prev, participacion: list }));
                        }} className="w-16 px-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Orden del dia</label>
                <div className="space-y-2">
                  {data.ordenDelDia.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
                      <input value={item} onChange={(e) => updateListItem("ordenDelDia", i, e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Pendientes</label>
                <div className="space-y-2">
                  {data.pendientes.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 shrink-0">&mdash;</span>
                      <input value={item} onChange={(e) => updateListItem("pendientes", i, e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <EditableField label="Resumen" value={data.resumen} onChange={(v) => updateField("resumen", v)} rows={4} />
            <EditableField label="Conclusion" value={data.conclusion} onChange={(v) => updateField("conclusion", v)} rows={3} />
          </div>
        ) : (
          /* Preview mode — template render */
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mx-auto" style={{ width: `${TEMPLATE_WIDTH}px` }}>
              <div ref={templateRef} style={{ width: `${TEMPLATE_WIDTH}px`, backgroundColor: "#eef1f5", overflow: "hidden" }}>
                {/* Logo header */}
                <div style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, padding: "24px 20px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                  {logoDataUrl ? (
                    <img src={logoDataUrl} alt="Logo" style={{ height: "56px", width: "auto", objectFit: "contain" }} />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.6 }}>
                      <LayoutTemplate size={28} color="#ffffff" />
                      <span style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>MINUTA</span>
                    </div>
                  )}
                </div>

                <div style={{ padding: "20px 20px 32px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Row 1: Info + Participacion */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <TemplateCard title="Minuta de Reunion" color={primary}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div><p style={labelStyle}>Reunion</p><p style={textStyle}>{data.minutaReunion}</p></div>
                        <div><p style={labelStyle}>Fecha</p><p style={textStyle}>{data.fecha}</p></div>
                        <div><p style={labelStyle}>Asistentes</p><p style={textStyle}>{data.asistentes}</p></div>
                      </div>
                    </TemplateCard>
                    <TemplateCard title="Participacion" color={primary}>
                      <PieChart data={data.participacion} primary={primary} secondary={secondary} />
                    </TemplateCard>
                  </div>

                  {/* Row 2: Orden del dia + Pendientes */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <TemplateCard title="Orden del dia" color={primary}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {data.ordenDelDia.map((item, i) => (<p key={i} style={listItemStyle}>{i + 1}. {item}</p>))}
                      </div>
                    </TemplateCard>
                    <TemplateCard title="Pendientes" color={primary}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {data.pendientes.map((item, i) => (<p key={i} style={listItemStyle}>&mdash; {item}</p>))}
                      </div>
                    </TemplateCard>
                  </div>

                  {/* Resumen */}
                  <TemplateCard title="Resumen" color={primary}>
                    <p style={{ ...textStyle, lineHeight: 1.7 }}>{data.resumen}</p>
                  </TemplateCard>

                  {/* Conclusion */}
                  <TemplateCard title="Conclusion" color={primary}>
                    <p style={{ ...textStyle, lineHeight: 1.7 }}>{data.conclusion}</p>
                  </TemplateCard>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Auto Minutas Section ---

async function fetchAllTemplates(): Promise<SavedTemplate[]> {
  try {
    const res = await fetch("/api/plantillas");
    if (!res.ok) return [];
    const data = await res.json();
    return data.plantillas || [];
  } catch {
    return [];
  }
}

function getTemplateForHost(host: string, templates: SavedTemplate[]): SavedTemplate {
  const hostLower = host.toLowerCase();
  const match = templates.find((t) => t.name.toLowerCase() === hostLower);
  if (match) return match;
  const moglich = templates.find((t) => t.name.toLowerCase().includes("möglich") || t.name.toLowerCase().includes("moglich"));
  if (moglich) return moglich;
  return templates[0] || DEFAULT_TEMPLATE;
}

function AutoMinutasSection() {
  const [minutas, setMinutas] = useState<AutoMinuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("Todos");
  const [selectedMinuta, setSelectedMinuta] = useState<AutoMinuta | null>(null);
  const [allTemplates, setAllTemplates] = useState<SavedTemplate[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchMinutas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTab !== "Todos") params.set("host", selectedTab);
      const res = await fetch(`/api/auto-minutas?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMinutas(data.minutas || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedTab]);

  useEffect(() => {
    fetchAllTemplates().then(setAllTemplates);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchMinutas();
  }, [fetchMinutas]);

  // Poll every 5s while there are minutas in "generating" status
  useEffect(() => {
    const hasGenerating = minutas.some((m) => m.status === "generating");
    if (!hasGenerating) return;

    const interval = setInterval(fetchMinutas, 5000);
    return () => clearInterval(interval);
  }, [minutas, fetchMinutas]);

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      await fetch(`/api/auto-minutas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry: true }),
      });
      await fetchMinutas();
    } catch {
      // silent
    } finally {
      setRetrying(null);
    }
  };

  const handleCardClick = (m: AutoMinuta) => {
    if (m.status === "ready" || m.status === "saved") {
      setSelectedMinuta(m);
    }
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-[#2055e4]" />
          <h2 className="text-lg font-semibold text-gray-900">Minutas Automaticas</h2>
          {!loading && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#2055e4] text-xs font-semibold">
              {minutas.length}
            </span>
          )}
        </div>
        <button
          onClick={() => { setLoading(true); fetchMinutas(); }}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Host tabs — always visible */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {HOST_TABS.map((tab) => {
          const isActive = selectedTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                isActive
                  ? "text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-white border border-gray-200"
              }`}
              style={isActive ? { background: "linear-gradient(135deg, #2055e4, #5980ff)" } : undefined}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[#2055e4]" />
        </div>
      ) : minutas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Sparkles size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {selectedTab === "Todos"
              ? "No hay minutas automaticas aun"
              : `No hay minutas para ${selectedTab}`}
          </p>
          <p className="text-xs text-gray-400 mt-1">Se generaran automaticamente al terminar cada reunion</p>
        </div>
      ) : (
      /* Grid of cards */
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {minutas.map((m) => (
          <button
            key={m.id}
            onClick={() => handleCardClick(m)}
            className={`text-left bg-white rounded-xl border p-4 transition-all duration-150 ${
              m.status === "ready" || m.status === "saved"
                ? "border-gray-200 hover:border-[#2055e4]/30 hover:shadow-md cursor-pointer"
                : "border-gray-200 cursor-default"
            }`}
          >
            <p className="font-medium text-sm text-gray-900 truncate mb-1.5">{m.title}</p>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs text-gray-500">{formatDate(m.fecha || m.created_at)}</span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500">{m.host}</span>
            </div>
            <div className="flex items-center justify-between">
              <StatusBadge status={m.status} />
              {m.status === "error" && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRetry(m.id); }}
                  disabled={retrying === m.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {retrying === m.id ? <Loader2 size={11} className="animate-spin" /> : <AlertCircle size={11} />}
                  Reintentar
                </button>
              )}
              {m.status === "saved" && m.drive_link && (
                <a
                  href={m.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  Abrir Drive
                </a>
              )}
            </div>
            {m.status === "error" && m.error_message && (
              <p className="mt-2 text-[11px] text-red-400 truncate">{m.error_message}</p>
            )}
          </button>
        ))}
      </div>
      )}

      {/* Modal */}
      {selectedMinuta && selectedMinuta.minuta_data && (
        <AutoMinutaModal
          autoMinuta={selectedMinuta}
          template={getTemplateForHost(selectedMinuta.host, allTemplates)}
          onClose={() => setSelectedMinuta(null)}
          onSaved={fetchMinutas}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}

// --- Existing table columns ---

const columns = [
  { key: "cliente", label: "Cliente" },
  { key: "nombre", label: "Nombre de la Reunion" },
  {
    key: "link",
    label: "Link",
    render: (value: string) =>
      value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2055e4] hover:text-[#5980ff] font-medium underline underline-offset-2 transition-colors"
        >
          Abrir
        </a>
      ) : (
        <span className="text-gray-400">&mdash;</span>
      ),
  },
  { key: "fecha", label: "Fecha" },
];

// --- Page ---

export default function MinutasPage() {
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("meeting_minutes")
      .select("cliente, nombre, link, fecha")
      .order("fecha", { ascending: false });

    if (!error && rows) {
      setData(
        rows.map((r) => ({
          cliente: r.cliente || "",
          nombre: r.nombre || "",
          link: r.link || "",
          fecha: r.fecha || "",
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <div className="p-2 rounded-lg text-white shrink-0" style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}>
          <FileText size={24} />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-[#212529]">Minutas</h1>
      </div>

      {/* New: Auto-generated minutas section */}
      <AutoMinutasSection />

      {/* Existing: Saved minutas table */}
      <div className="flex items-center gap-2 mb-4">
        <FileText size={16} className="text-gray-400" />
        <h2 className="text-base font-semibold text-gray-700">Minutas Guardadas</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-[#2055e4] rounded-full animate-spin" />
        </div>
      ) : (
        <DataTable columns={columns} data={data} onRefresh={fetchData} />
      )}
    </div>
  );
}
