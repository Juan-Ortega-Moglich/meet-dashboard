"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

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

interface MinutaData {
  minutaReunion: string;
  fecha: string;
  asistentes: string;
  participacion: string;
  ordenDelDia: string;
  pendientes: string;
  resumen: string;
  compromisos: string;
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

// --- PDF Generation ---

async function generateMinutaPDF(data: MinutaData) {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  // Load the template PDF
  const templateUrl = "/templates/operaciones.pdf";
  const templateBytes = await fetch(templateUrl).then((res) => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const page2 = pages[1];

  const { height: h1 } = page1.getSize();
  const { height: h2 } = page2.getSize();

  const textColor = rgb(0.15, 0.15, 0.15);
  const fontSize = 8.5;
  const lineHeight = 12;

  // Helper: draw wrapped text in a bounding box
  function drawWrappedText(
    page: typeof page1,
    text: string,
    x: number,
    yStart: number,
    maxWidth: number,
    maxLines: number,
    font: typeof helvetica,
    size: number = fontSize
  ) {
    const words = text.split(/\s+/);
    let line = "";
    let y = yStart;
    let linesDrawn = 0;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth > maxWidth && line) {
        if (linesDrawn >= maxLines) return;
        page.drawText(line, { x, y, size, font, color: textColor });
        y -= lineHeight;
        linesDrawn++;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line && linesDrawn < maxLines) {
      page.drawText(line, { x, y, size, font, color: textColor });
    }
  }

  // Helper: draw multiline text (respects \n)
  function drawMultilineText(
    page: typeof page1,
    text: string,
    x: number,
    yStart: number,
    maxWidth: number,
    maxLines: number,
    font: typeof helvetica,
    size: number = fontSize
  ) {
    const paragraphs = text.split("\n");
    let y = yStart;
    let totalLines = 0;

    for (const para of paragraphs) {
      if (totalLines >= maxLines) return;
      const words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        y -= lineHeight;
        totalLines++;
        continue;
      }
      let line = "";
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth && line) {
          if (totalLines >= maxLines) return;
          page.drawText(line, { x, y, size, font, color: textColor });
          y -= lineHeight;
          totalLines++;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line && totalLines < maxLines) {
        page.drawText(line, { x, y, size, font, color: textColor });
        y -= lineHeight;
        totalLines++;
      }
    }
  }

  // ========== PAGE 1 ==========
  // Coordinates based on the template layout (y from bottom)

  // --- Top left box: Minuta de Reunión, Fecha, Asistentes ---
  const topBoxY = h1 - 160;
  page1.drawText(data.minutaReunion, { x: 62, y: topBoxY, size: 9, font: helveticaBold, color: textColor });
  page1.drawText(data.fecha, { x: 62, y: topBoxY - 22, size: fontSize, font: helvetica, color: textColor });
  drawWrappedText(page1, data.asistentes, 62, topBoxY - 44, 210, 5, helvetica);

  // --- Top right box: Participación ---
  drawMultilineText(page1, data.participacion, 320, topBoxY, 220, 8, helvetica);

  // --- Middle left box: Orden del día ---
  const midBoxY = h1 - 330;
  drawMultilineText(page1, data.ordenDelDia, 62, midBoxY, 210, 12, helvetica);

  // --- Middle right box: Pendientes ---
  drawMultilineText(page1, data.pendientes, 320, midBoxY, 220, 12, helvetica);

  // --- Bottom box: Resumen ---
  const bottomBoxY = h1 - 530;
  drawMultilineText(page1, data.resumen, 62, bottomBoxY, 480, 16, helvetica);

  // ========== PAGE 2 ==========

  // --- Top box: Compromisos y tareas pendientes ---
  const compBoxY = h2 - 165;
  drawMultilineText(page2, data.compromisos, 62, compBoxY, 480, 18, helvetica);

  // --- Bottom box: Conclusión ---
  const concBoxY = h2 - 440;
  drawMultilineText(page2, data.conclusion, 62, concBoxY, 480, 18, helvetica);

  // Save and download
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `minuta-${data.minutaReunion.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
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

function MinutaEditableField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#2055e4] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2055e4]/20 focus:border-[#2055e4] transition-all resize-y leading-relaxed"
      />
    </div>
  );
}

function MinutaModal({
  minuta,
  onClose,
}: {
  minuta: MinutaData;
  onClose: () => void;
}) {
  const [data, setData] = useState<MinutaData>(minuta);
  const [downloading, setDownloading] = useState(false);

  const update = (key: keyof MinutaData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      await generateMinutaPDF(data);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#2055e4]" />
            <h3 className="font-semibold text-gray-900">Minuta generada</h3>
            <span className="text-xs text-gray-400 ml-2">Edita los campos antes de descargar</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
            >
              {downloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Descargar PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content — editable fields */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Row 1: Minuta + Fecha side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <MinutaEditableField label="Minuta de Reunión" value={data.minutaReunion} onChange={(v) => update("minutaReunion", v)} rows={1} />
              <MinutaEditableField label="Fecha" value={data.fecha} onChange={(v) => update("fecha", v)} rows={1} />
              <MinutaEditableField label="Asistentes" value={data.asistentes} onChange={(v) => update("asistentes", v)} rows={3} />
            </div>
            <MinutaEditableField label="Participación" value={data.participacion} onChange={(v) => update("participacion", v)} rows={7} />
          </div>

          {/* Row 2: Orden del día + Pendientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MinutaEditableField label="Orden del día" value={data.ordenDelDia} onChange={(v) => update("ordenDelDia", v)} rows={6} />
            <MinutaEditableField label="Pendientes" value={data.pendientes} onChange={(v) => update("pendientes", v)} rows={6} />
          </div>

          {/* Row 3: Resumen */}
          <MinutaEditableField label="Resumen" value={data.resumen} onChange={(v) => update("resumen", v)} rows={5} />

          {/* Row 4: Compromisos */}
          <MinutaEditableField label="Compromisos y tareas pendientes" value={data.compromisos} onChange={(v) => update("compromisos", v)} rows={5} />

          {/* Row 5: Conclusión */}
          <MinutaEditableField label="Conclusión" value={data.conclusion} onChange={(v) => update("conclusion", v)} rows={5} />
        </div>
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

  const handleGenerateMinuta = async () => {
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
            {recording.transcript.length > 0 && (
              <button
                onClick={handleGenerateMinuta}
                disabled={generatingMinuta}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
              >
                {generatingMinuta ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Generando minuta...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Generar minuta
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

          {/* Minuta modal */}
          {minuta && (
            <MinutaModal
              minuta={minuta}
              onClose={() => setMinuta(null)}
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
