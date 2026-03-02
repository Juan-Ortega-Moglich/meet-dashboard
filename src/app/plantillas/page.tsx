"use client";

import {
  LayoutTemplate,
  Upload,
  Palette,
  Download,
  ImageIcon,
  X,
  FileText,
  UserCircle,
  Loader2,
  Save,
  Trash2,
  Check,
  Pencil,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

// --- Types ---

type ActiveTab = "minutas" | "perfil";

interface SavedTemplate {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  logoDataUrl: string | null;
  createdAt: string;
}

// --- Example data ---

const exampleData = {
  meetingName: "Revisión de Estrategia Comercial Q2 2026",
  date: "2 de Marzo, 2026 — 10:00 AM",
  attendees: "Andrés López, María González, Pablo Herrera, Sofía Ramírez, Rafael Torres (ausente)",
  participation: [
    { name: "Andrés L.", pct: 35 },
    { name: "María G.", pct: 28 },
    { name: "Pablo H.", pct: 20 },
    { name: "Sofía R.", pct: 12 },
    { name: "Rafael T.", pct: 5 },
  ],
  agenda: [
    "Revisión de resultados Q1 y KPIs alcanzados",
    "Análisis del pipeline actual y oportunidades clave",
    "Estrategia de penetración en nuevos mercados",
    "Asignación de cuentas y redistribución de territorios",
  ],
  pending: [
    "Enviar propuesta actualizada a Acme Corp — María G. — 5 Mar",
    "Preparar análisis competitivo sector fintech — Sofía R. — 7 Mar",
    "Agendar demo de producto con Innova SA — Pablo H. — 10 Mar",
    "Revisar contratos de renovación — Andrés L. — 12 Mar",
  ],
  summary:
    "Se revisaron los resultados del Q1 alcanzando el 92% de la meta comercial. El pipeline muestra 47 oportunidades activas con valor estimado de $2.3M MXN. Se priorizará el sector fintech y salud para Q2 con enfoque en upselling a clientes existentes.",
  commitments: [
    "Presentar nueva estrategia de pricing al board — 8 Mar",
    "Lanzar campaña de outreach sector fintech — 10 Mar",
    "Reunión de seguimiento cuentas estratégicas — 15 Mar",
    "Workshop capacitación nuevo CRM — 20 Mar",
  ],
  conclusion:
    "El equipo tiene claridad sobre las prioridades de Q2 y los recursos necesarios. Se espera un incremento del 15% en el pipeline para finales de marzo. Próxima reunión de seguimiento: 15 de marzo, 10:00 AM.",
};

// --- Color presets ---

const colorPresets = [
  { name: "Azul Corporativo", primary: "#1a4b8c", secondary: "#2d7dd2" },
  { name: "Azul Möglich", primary: "#1b3a5c", secondary: "#3a7bd5" },
  { name: "Verde Esmeralda", primary: "#065f46", secondary: "#10b981" },
  { name: "Violeta Elegante", primary: "#5b21b6", secondary: "#8b5cf6" },
  { name: "Rojo Ejecutivo", primary: "#991b1b", secondary: "#ef4444" },
  { name: "Teal Moderno", primary: "#115e59", secondary: "#14b8a6" },
];

// --- localStorage helpers ---

const STORAGE_KEY = "plantillas-minutas";

function loadTemplates(): SavedTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTemplates(templates: SavedTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

// --- Pie chart SVG ---

function PieChart({ data, primary, secondary }: { data: typeof exampleData.participation; primary: string; secondary: string }) {
  const pieColors = [primary, secondary, `${primary}aa`, `${secondary}aa`, "#cbd5e1"];
  const total = data.reduce((s, d) => s + d.pct, 0);
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

// --- Card wrapper (static) ---

function Card({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
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

// --- Template width ---
const TEMPLATE_WIDTH = 794;

// --- Page ---

export default function PlantillasPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("minutas");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [colors, setColors] = useState(colorPresets[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customPrimary, setCustomPrimary] = useState(colorPresets[0].primary);
  const [customSecondary, setCustomSecondary] = useState(colorPresets[0].secondary);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);

  // Saved templates
  const [saved, setSaved] = useState<SavedTemplate[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [justUpdated, setJustUpdated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setSaved(loadTemplates());
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoUrl(URL.createObjectURL(file));
      setLogoDataUrl(await fileToDataUrl(file));
    }
  };

  const handlePresetSelect = (preset: typeof colorPresets[0]) => {
    setColors(preset);
    setCustomPrimary(preset.primary);
    setCustomSecondary(preset.secondary);
    setShowColorPicker(false);
    setActiveTemplateId(null);
  };

  const applyCustomColors = () => {
    setColors({ name: "Personalizado", primary: customPrimary, secondary: customSecondary });
    setShowColorPicker(false);
    setActiveTemplateId(null);
  };

  const handleSaveTemplate = () => {
    if (!saveName.trim()) return;
    const newTemplate: SavedTemplate = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      primary: colors.primary,
      secondary: colors.secondary,
      logoDataUrl,
      createdAt: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
    };
    const updated = [...saved, newTemplate];
    setSaved(updated);
    saveTemplates(updated);
    setActiveTemplateId(newTemplate.id);
    setSaveName("");
    setShowSaveInput(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleLoadTemplate = (t: SavedTemplate) => {
    setColors({ name: t.name, primary: t.primary, secondary: t.secondary });
    setCustomPrimary(t.primary);
    setCustomSecondary(t.secondary);
    if (t.logoDataUrl) {
      setLogoUrl(t.logoDataUrl);
      setLogoDataUrl(t.logoDataUrl);
    } else {
      setLogoUrl(null);
      setLogoDataUrl(null);
    }
    setActiveTemplateId(t.id);
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = saved.filter((t) => t.id !== id);
    setSaved(updated);
    saveTemplates(updated);
    if (activeTemplateId === id) setActiveTemplateId(null);
    setDeleteConfirm(null);
  };

  const handleStartEdit = (t: SavedTemplate) => {
    setEditingId(t.id);
    setEditName(t.name);
  };

  const handleUpdateTemplate = () => {
    if (!editingId) return;
    const updated = saved.map((t) =>
      t.id === editingId
        ? { ...t, name: editName.trim() || t.name, primary: colors.primary, secondary: colors.secondary, logoDataUrl }
        : t
    );
    setSaved(updated);
    saveTemplates(updated);
    setEditingId(null);
    setEditName("");
    setJustUpdated(true);
    setTimeout(() => setJustUpdated(false), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!templateRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(templateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#eef1f5",
        width: TEMPLATE_WIDTH,
        windowWidth: TEMPLATE_WIDTH,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageH = 297;
      const pdf = new jsPDF("p", "mm", "a4");
      let y = 0, left = pdfHeight;

      while (left > 0) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -y, pdfWidth, pdfHeight);
        y += pageH;
        left -= pageH;
      }

      const fileName = activeTemplateId
        ? `${saved.find((t) => t.id === activeTemplateId)?.name || "minuta"}.pdf`
        : "minuta-plantilla.pdf";
      pdf.save(fileName);
    } catch (err) {
      console.error("Error generating PDF:", err);
    } finally {
      setDownloading(false);
    }
  };

  const label: React.CSSProperties = { fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" };
  const text: React.CSSProperties = { fontSize: "13px", color: "#1f2937", lineHeight: 1.5 };
  const listItem: React.CSSProperties = { fontSize: "13px", color: "#374151", lineHeight: 1.6 };

  return (
    <div>
      {/* Header + Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl text-white shrink-0" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}>
            <LayoutTemplate size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#212529]">Plantillas</h1>
            <p className="text-sm text-gray-400">Personaliza el diseño de tus documentos</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab("minutas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "minutas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <FileText size={16} /> Minutas
          </button>
          <button
            onClick={() => setActiveTab("perfil")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "perfil" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <UserCircle size={16} /> Perfil de Cliente
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            {logoUrl ? <ImageIcon size={16} /> : <Upload size={16} />}
            {logoUrl ? "Cambiar Logo" : "Subir Logo"}
          </button>
          {logoUrl && (
            <button onClick={() => { setLogoUrl(null); setLogoDataUrl(null); }} className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors">
              <X size={14} /> Quitar
            </button>
          )}
          <div className="w-px h-7 bg-gray-200 mx-1 hidden sm:block" />
          <Palette size={16} className="text-gray-400" />
          {colorPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePresetSelect(preset)}
              title={preset.name}
              className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${colors.primary === preset.primary && !activeTemplateId ? "border-gray-900 scale-110 shadow-md" : "border-white shadow-sm"}`}
              style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }}
            />
          ))}
          <div className="w-px h-7 bg-gray-200 mx-1 hidden sm:block" />
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${showColorPicker ? "border-gray-900 bg-gray-50 text-gray-900" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
          >
            <Palette size={16} /> Personalizado
          </button>
          <div className="w-px h-7 bg-gray-200 mx-1 hidden sm:block" />

          {/* Save button */}
          {!showSaveInput ? (
            <button
              onClick={() => setShowSaveInput(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {justSaved ? <Check size={16} className="text-green-500" /> : <Save size={16} />}
              {justSaved ? "Guardada" : "Guardar"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); if (e.key === "Escape") setShowSaveInput(false); }}
                placeholder="Nombre de la plantilla..."
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 w-52"
                autoFocus
              />
              <button
                onClick={handleSaveTemplate}
                disabled={!saveName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
              >
                <Save size={14} /> Guardar
              </button>
              <button onClick={() => { setShowSaveInput(false); setSaveName(""); }} className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>
          )}

          <div className="w-px h-7 bg-gray-200 mx-1 hidden sm:block" />
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-5 py-2 text-white text-sm font-medium rounded-xl transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {downloading ? "Generando…" : "Descargar PDF"}
          </button>
        </div>
        {showColorPicker && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Primario</label>
              <div className="flex items-center gap-2">
                <input type="color" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                <input type="text" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Secundario</label>
              <div className="flex items-center gap-2">
                <input type="color" value={customSecondary} onChange={(e) => setCustomSecondary(e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                <input type="text" value={customSecondary} onChange={(e) => setCustomSecondary(e.target.value)} className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 font-mono" />
              </div>
            </div>
            <button onClick={applyCustomColors} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90" style={{ background: `linear-gradient(135deg, ${customPrimary}, ${customSecondary})` }}>
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* Saved templates list */}
      {saved.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Mis plantillas guardadas</p>
          <div className="flex flex-wrap gap-3">
            {saved.map((t) => {
              const isActive = activeTemplateId === t.id;
              const isEditing = editingId === t.id;

              return (
                <div
                  key={t.id}
                  className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                    isActive ? "border-gray-900 shadow-md bg-white" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  onClick={() => { if (!isEditing) handleLoadTemplate(t); }}
                >
                  {/* Color preview */}
                  <div className="w-8 h-8 rounded-lg shrink-0" style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})` }} />

                  {/* Name — editable or static */}
                  {isEditing ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleUpdateTemplate(); if (e.key === "Escape") setEditingId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-1 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 w-40"
                      autoFocus
                    />
                  ) : (
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                      <p className="text-[11px] text-gray-400">{t.createdAt}</p>
                    </div>
                  )}

                  {/* Logo indicator */}
                  {t.logoDataUrl && !isEditing && (
                    <img src={t.logoDataUrl} alt="" className="h-6 w-auto object-contain opacity-50 ml-1" />
                  )}

                  {/* Action buttons */}
                  {isEditing ? (
                    <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={handleUpdateTemplate}
                        className="p-1.5 rounded-lg text-white transition-colors"
                        style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
                        title="Guardar cambios"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        title="Cancelar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : isActive ? (
                    <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                      {justUpdated ? (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600">
                          <Check size={14} /> Guardada
                        </span>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(t)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                          title="Editar plantilla"
                        >
                          <Pencil size={13} /> Editar
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteConfirm(t.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(t.id); }}
                      className="ml-2 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-50"><Trash2 size={20} className="text-red-500" /></div>
              <h3 className="text-lg font-bold text-gray-900">Eliminar plantilla</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">Se eliminará permanentemente &quot;{saved.find((t) => t.id === deleteConfirm)?.name}&quot;.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={() => handleDeleteTemplate(deleteConfirm)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MINUTAS TEMPLATE ===== */}
      {activeTab === "minutas" && (
        <div className="overflow-x-auto pb-4">
          <div className="mx-auto" style={{ width: `${TEMPLATE_WIDTH}px` }}>
            <div
              ref={templateRef}
              style={{ width: `${TEMPLATE_WIDTH}px`, backgroundColor: "#eef1f5", borderRadius: "16px", overflow: "hidden" }}
            >
              <div style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`, padding: "24px 20px", display: "flex", justifyContent: "center", alignItems: "center", borderRadius: "16px 16px 0 0" }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" style={{ height: "56px", width: "auto", objectFit: "contain" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.6 }}>
                    <LayoutTemplate size={28} color="#ffffff" />
                    <span style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>TU LOGO AQUÍ</span>
                  </div>
                )}
              </div>

              <div style={{ padding: "20px 20px 32px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <Card title="Minuta de Reunión" color={colors.primary}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div><p style={label}>Reunión</p><p style={text}>{exampleData.meetingName}</p></div>
                      <div><p style={label}>Fecha</p><p style={text}>{exampleData.date}</p></div>
                      <div><p style={label}>Asistentes</p><p style={text}>{exampleData.attendees}</p></div>
                    </div>
                  </Card>
                  <Card title="Participación" color={colors.primary}>
                    <PieChart data={exampleData.participation} primary={colors.primary} secondary={colors.secondary} />
                  </Card>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <Card title="Orden del día" color={colors.primary}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {exampleData.agenda.map((item, i) => (<p key={i} style={listItem}>{i + 1}. {item}</p>))}
                    </div>
                  </Card>
                  <Card title="Pendientes" color={colors.primary}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {exampleData.pending.map((item, i) => (<p key={i} style={listItem}>— {item}</p>))}
                    </div>
                  </Card>
                </div>

                <Card title="Resumen" color={colors.primary}>
                  <p style={{ ...text, lineHeight: 1.7 }}>{exampleData.summary}</p>
                </Card>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <Card title="Próximos pasos" color={colors.primary}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {exampleData.commitments.map((item, i) => (<p key={i} style={listItem}>{i + 1}. {item}</p>))}
                    </div>
                  </Card>
                  <Card title="Conclusión" color={colors.primary}>
                    <p style={{ ...text, lineHeight: 1.7 }}>{exampleData.conclusion}</p>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== PERFIL TEMPLATE (placeholder) ===== */}
      {activeTab === "perfil" && (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center" style={{ backgroundColor: "#eef1f5" }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white mb-4">
            <UserCircle size={32} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-400 mb-2">Perfil de Cliente</h3>
          <p className="text-sm text-gray-400">Esta plantilla se configurará próximamente</p>
        </div>
      )}
    </div>
  );
}
