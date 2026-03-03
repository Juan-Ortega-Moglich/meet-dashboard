"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Clock,
  User,
  ChevronUp,
  Video,
  ExternalLink,
  Download,
  FileText,
  Calendar,
  Loader2,
  ChevronDown,
  Users,
  Sparkles,
  X,
  LayoutTemplate,
  Check,
  Pencil,
  CloudUpload,
} from "lucide-react";

// --- Saved template type (matches plantillas page) ---

interface SavedTemplate {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  logoDataUrl: string | null;
  createdAt: string;
}

const PLANTILLAS_KEY = "plantillas-minutas";

function loadSavedTemplates(): SavedTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLANTILLAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// --- Types ---

interface TranscriptBlock {
  timestamp: string;
  speaker: string;
  text: string;
}

interface Recording {
  id: string;
  title: string;
  date: string;
  duration: string;
  host: string;
  platform: string;
  video_url: string | null;
  transcript: TranscriptBlock[];
}

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

// --- Constants ---

const defaultHosts = ["Operaciones", "Andres", "Pablo", "Rafa", "Wisdom", "Biofleming", "Inbest"];

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

function downloadTranscript(recording: Recording) {
  const lines = recording.transcript.map(
    (b) => `[${b.timestamp}] ${b.speaker}: ${b.text}`
  );
  const header = `Transcripción: ${recording.title}\nFecha: ${formatDate(recording.date)}\nAnfitrión: ${recording.host}\nDuración: ${recording.duration}\n${"─".repeat(50)}\n\n`;
  const content = header + lines.join("\n\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transcripcion-${recording.title.toLowerCase().replace(/\s+/g, "-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Template width (matches plantillas page) ---
const TEMPLATE_WIDTH = 794;

// --- Pie chart SVG (matches plantillas page) ---
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

// --- Card wrapper (matches plantillas page) ---
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

// --- Components ---

function HostSidebar({
  hosts,
  selectedHost,
  onSelect,
}: {
  hosts: string[];
  selectedHost: string;
  onSelect: (host: string) => void;
}) {
  const allOptions = ["Todos", ...hosts];
  return (
    <div className="w-full md:w-56 shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Users size={15} className="text-gray-400" />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Anfitriones</h3>
      </div>
      <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
        {allOptions.map((host) => {
          const isActive = selectedHost === host;
          return (
            <button
              key={host}
              onClick={() => onSelect(host)}
              className={`whitespace-nowrap text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-white border border-gray-200 md:border-0 md:bg-transparent"
              }`}
              style={
                isActive
                  ? { background: "linear-gradient(135deg, #2055e4, #5980ff)" }
                  : undefined
              }
            >
              {host === "Todos" ? "Todos" : host}
            </button>
          );
        })}
      </nav>
    </div>
  );
}


function EditableField({ label, value, onChange, rows = 1 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all resize-y leading-relaxed" />
    </div>
  );
}

function MinutaModal({
  minuta,
  template,
  host,
  onClose,
  onUpdate,
}: {
  minuta: MinutaData;
  template: SavedTemplate;
  host: string;
  onClose: () => void;
  onUpdate: (data: MinutaData) => void;
}) {
  const templateRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ link: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState<MinutaData>(minuta);

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

      // Get base64 without the data:application/pdf;base64, prefix
      const pdfBase64 = pdf.output("datauristring").split(",")[1];
      const fileName = `minuta-${data.minutaReunion.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.pdf`;

      const res = await fetch("/api/minuta/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64,
          fileName,
          meetingTitle: data.minutaReunion,
          cliente: host,
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
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al guardar en Drive");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    onUpdate(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[900px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-[#2055e4]" />
            <h3 className="font-semibold text-gray-900">Minuta generada</h3>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100">
              <div className="w-3 h-3 rounded shrink-0" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }} />
              <span className="text-xs font-medium text-gray-600">{template.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(!editing)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                editing
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Pencil size={14} />
              {editing ? "Ver vista previa" : "Editar"}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading || editing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Descargar PDF
            </button>
            {uploadResult ? (
              <a
                href={uploadResult.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
              >
                <Check size={14} /> Guardada en Drive
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
            <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
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
                <EditableField label="Reunión" value={data.minutaReunion} onChange={(v) => updateField("minutaReunion", v)} />
                <EditableField label="Fecha" value={data.fecha} onChange={(v) => updateField("fecha", v)} />
                <EditableField label="Asistentes" value={data.asistentes} onChange={(v) => updateField("asistentes", v)} rows={2} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Participación</label>
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
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Orden del día</label>
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
                      <span className="text-xs text-gray-400 shrink-0">—</span>
                      <input value={item} onChange={(e) => updateListItem("pendientes", i, e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <EditableField label="Resumen" value={data.resumen} onChange={(v) => updateField("resumen", v)} rows={4} />
            <EditableField label="Conclusión" value={data.conclusion} onChange={(v) => updateField("conclusion", v)} rows={3} />
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
                  {/* Row 1: Info + Participación */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <TemplateCard title="Minuta de Reunión" color={primary}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div><p style={labelStyle}>Reunión</p><p style={textStyle}>{data.minutaReunion}</p></div>
                        <div><p style={labelStyle}>Fecha</p><p style={textStyle}>{data.fecha}</p></div>
                        <div><p style={labelStyle}>Asistentes</p><p style={textStyle}>{data.asistentes}</p></div>
                      </div>
                    </TemplateCard>
                    <TemplateCard title="Participación" color={primary}>
                      <PieChart data={data.participacion} primary={primary} secondary={secondary} />
                    </TemplateCard>
                  </div>

                  {/* Row 2: Orden del día + Pendientes */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <TemplateCard title="Orden del día" color={primary}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {data.ordenDelDia.map((item, i) => (<p key={i} style={listItemStyle}>{i + 1}. {item}</p>))}
                      </div>
                    </TemplateCard>
                    <TemplateCard title="Pendientes" color={primary}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {data.pendientes.map((item, i) => (<p key={i} style={listItemStyle}>— {item}</p>))}
                      </div>
                    </TemplateCard>
                  </div>

                  {/* Resumen */}
                  <TemplateCard title="Resumen" color={primary}>
                    <p style={{ ...textStyle, lineHeight: 1.7 }}>{data.resumen}</p>
                  </TemplateCard>

                  {/* Conclusión */}
                  <TemplateCard title="Conclusión" color={primary}>
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

function TemplateSelectModal({
  onSelect,
  onClose,
}: {
  onSelect: (template: SavedTemplate) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setTemplates(loadSavedTemplates());
  }, []);

  const selected = templates.find((t) => t.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={18} className="text-[#2055e4]" />
            <h3 className="font-semibold text-gray-900">Seleccionar plantilla</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Template list */}
        <div className="p-5 flex-1 overflow-y-auto max-h-80">
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <LayoutTemplate size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No hay plantillas guardadas</p>
              <p className="text-xs text-gray-400 mt-1">Crea una plantilla en la sección de Plantillas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => {
                const isSelected = selectedId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-[#2055e4] bg-blue-50/50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg shrink-0" style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})` }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                      <p className="text-[11px] text-gray-400">{t.createdAt}</p>
                    </div>
                    {t.logoDataUrl && <img src={t.logoDataUrl} alt="" className="h-6 w-auto object-contain opacity-50" />}
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}>
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {templates.length > 0 && (
          <div className="p-5 border-t border-gray-100 flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => { if (selected) onSelect(selected); }}
              disabled={!selected}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
            >
              <Sparkles size={14} />
              Generar minuta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RecordingCard({
  recording,
  isExpanded,
  onToggle,
}: {
  recording: Recording;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [generatingMinuta, setGeneratingMinuta] = useState(false);
  const [minuta, setMinuta] = useState<MinutaData | null>(null);
  const [minutaError, setMinutaError] = useState<string | null>(null);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [showMinutaModal, setShowMinutaModal] = useState(false);

  const handleGenerateMinuta = async (template: SavedTemplate) => {
    setShowTemplateSelect(false);
    setSelectedTemplate(template);
    setGeneratingMinuta(true);
    setMinutaError(null);
    try {
      const res = await fetch("/api/minuta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recording.title,
          date: recording.date,
          host: recording.host,
          duration: recording.duration,
          transcript: recording.transcript,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar la minuta");
      setMinuta(data.minuta);
      setShowMinutaModal(true);
    } catch (err) {
      setMinutaError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGeneratingMinuta(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-200 ${
        isExpanded
          ? "border-[#2055e4]/20 shadow-xl ring-1 ring-[#2055e4]/10"
          : "border-gray-200 hover:shadow-md hover:border-gray-300"
      }`}
    >
      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 md:p-5 flex items-center gap-4 cursor-pointer group"
      >
        <div
          className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
            isExpanded ? "shadow-md" : ""
          }`}
          style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
        >
          <Video size={20} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate group-hover:text-[#2055e4] transition-colors">
            {recording.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Calendar size={11} />
              {formatDate(recording.date)}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={11} />
              {recording.duration}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-gray-100 text-gray-500">
              {recording.platform}
            </span>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-[#2055e4] border border-blue-100">
          <User size={12} />
          {recording.host}
        </span>

        <div
          className={`shrink-0 p-1 rounded-lg transition-colors ${
            isExpanded ? "bg-blue-50 text-[#2055e4]" : "text-gray-400 group-hover:text-gray-600"
          }`}
        >
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-5 md:px-5 md:pb-6 border-t border-gray-100">
          <div className="sm:hidden mt-3 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-[#2055e4] border border-blue-100">
              <User size={12} />
              {recording.host}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mt-4 mb-5">
            {recording.video_url && (
              <a
                href={recording.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
              >
                <ExternalLink size={15} />
                Ver video
              </a>
            )}
            {recording.transcript.length > 0 && (
              <button
                onClick={() => downloadTranscript(recording)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <Download size={15} />
                Descargar transcripción
              </button>
            )}
            {recording.transcript.length > 0 && minuta && selectedTemplate && (
              <button
                onClick={() => setShowMinutaModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
              >
                <FileText size={15} />
                Ver minuta
              </button>
            )}
            {recording.transcript.length > 0 && (
              <button
                onClick={() => setShowTemplateSelect(true)}
                disabled={generatingMinuta}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  minuta
                    ? "border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                    : "text-white hover:opacity-90 hover:shadow-lg"
                }`}
                style={!minuta ? { background: "linear-gradient(135deg, #10b981, #059669)" } : undefined}
              >
                {generatingMinuta ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Generando minuta...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    {minuta ? "Nueva minuta" : "Generar minuta"}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Minuta error */}
          {minutaError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              {minutaError}
            </div>
          )}

          {/* Template selection modal */}
          {showTemplateSelect && (
            <TemplateSelectModal
              onSelect={handleGenerateMinuta}
              onClose={() => setShowTemplateSelect(false)}
            />
          )}

          {/* Minuta modal */}
          {showMinutaModal && minuta && selectedTemplate && (
            <MinutaModal
              minuta={minuta}
              template={selectedTemplate}
              host={recording.host}
              onClose={() => setShowMinutaModal(false)}
              onUpdate={(updated) => setMinuta(updated)}
            />
          )}

          {/* Transcript */}
          {recording.transcript.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText size={15} className="text-[#2055e4]" />
                <h4 className="text-sm font-semibold text-gray-900">Transcripción</h4>
              </div>
              <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-100 p-4 md:p-5 space-y-3 max-h-72 overflow-y-auto">
                {recording.transcript.map((block, idx) => (
                  <div key={idx} className="flex gap-3 text-sm group/line hover:bg-blue-50/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                    <span className="shrink-0 font-mono text-xs text-[#2055e4] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md h-fit mt-0.5">
                      {block.timestamp}
                    </span>
                    <div className="leading-relaxed">
                      <span className="font-semibold text-gray-800">{block.speaker}: </span>
                      <span className="text-gray-600">{block.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recording.transcript.length === 0 && (
            <div className="mt-4 p-6 rounded-xl bg-gray-50 text-center">
              <FileText size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Transcripción no disponible</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Page ---

export default function GrabacionesPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedHost, setSelectedHost] = useState("Todos");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [hosts, setHosts] = useState<string[]>(defaultHosts);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedHost !== "Todos") params.set("host", selectedHost);

      const res = await fetch(`/api/recall/recordings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecordings(data.recordings || []);
        if (data.hosts && data.hosts.length > 0) {
          const merged = [...new Set([...data.hosts, ...defaultHosts])].sort();
          setHosts(merged);
        }
      } else {
        setRecordings([]);
      }
    } catch {
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHost]);

  useEffect(() => {
    setLoading(true);
    fetchRecordings();
  }, [fetchRecordings]);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleHostSelect = (host: string) => {
    setSelectedHost(host);
    setExpandedId(null);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <HostSidebar hosts={hosts} selectedHost={selectedHost} onSelect={handleHostSelect} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-5">
          <Video size={18} className="text-[#2055e4]" />
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedHost === "Todos" ? "Todas las grabaciones" : `Grabaciones de ${selectedHost}`}
          </h2>
          {!loading && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-[#2055e4] text-xs font-semibold">
              {recordings.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#2055e4]" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 mb-4">
              <Video size={24} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">
              {selectedHost === "Todos"
                ? "No hay grabaciones registradas"
                : `No hay grabaciones para ${selectedHost}`}
            </p>
            <p className="text-xs text-gray-400 mt-1">Las grabaciones aparecerán aquí cuando se completen</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {recordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                isExpanded={expandedId === recording.id}
                onToggle={() => handleToggle(recording.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
