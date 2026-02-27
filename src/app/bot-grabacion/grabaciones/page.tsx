"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Video,
  ExternalLink,
  Download,
  FileText,
  Calendar,
  Loader2,
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

// --- Mock Data (fallback until real recordings exist) ---

const hostOptions = ["Todos", "Operaciones", "Andres", "Pablo", "Rafa", "Wisdom", "Biofleming", "Inbest"];

const mockRecordings: Recording[] = [
  {
    id: "r1",
    title: "Sync semanal equipo",
    date: "2026-02-24T09:00:00Z",
    duration: "45:12",
    host: "Wisdom",
    platform: "Google Meet",
    video_url: "#",
    transcript: [
      { timestamp: "00:00", speaker: "Wisdom", text: "Buenos días a todos, comencemos con la revisión de la semana pasada." },
      { timestamp: "00:45", speaker: "Pablo", text: "Perfecto. Del lado de diseño terminamos los mockups del módulo de reportes." },
      { timestamp: "01:30", speaker: "Wisdom", text: "Excelente, ¿algún bloqueante del equipo de desarrollo?" },
      { timestamp: "02:15", speaker: "Andres", text: "Estamos esperando las credenciales del API de pagos, sin eso no podemos avanzar con la integración." },
      { timestamp: "03:00", speaker: "Wisdom", text: "Entendido, lo escalo hoy mismo con el proveedor. Siguiente punto: métricas de la semana." },
    ],
  },
  {
    id: "r2",
    title: "Revisión pipeline Q1",
    date: "2026-02-24T11:30:00Z",
    duration: "32:07",
    host: "Wisdom",
    platform: "Google Meet",
    video_url: "#",
    transcript: [
      { timestamp: "00:00", speaker: "Wisdom", text: "Vamos a revisar el estado del pipeline del primer trimestre." },
      { timestamp: "00:30", speaker: "Biofleming", text: "Tenemos 12 oportunidades activas con un valor total de $450K." },
      { timestamp: "01:15", speaker: "Wisdom", text: "¿Cuántas están en etapa de propuesta?" },
      { timestamp: "01:45", speaker: "Biofleming", text: "Cinco están en propuesta y tres en negociación final." },
      { timestamp: "02:30", speaker: "Wisdom", text: "Bien, necesitamos cerrar al menos 3 este mes para cumplir el objetivo trimestral." },
    ],
  },
  {
    id: "r3",
    title: "Reunión con proveedor",
    date: "2026-02-23T13:00:00Z",
    duration: "28:34",
    host: "Biofleming",
    platform: "Zoom",
    video_url: "#",
    transcript: [
      { timestamp: "00:00", speaker: "Biofleming", text: "Gracias por conectarse. Queremos revisar los términos del contrato de servicio." },
      { timestamp: "00:40", speaker: "Proveedor", text: "Claro, hemos preparado una propuesta actualizada con los nuevos precios." },
      { timestamp: "01:20", speaker: "Biofleming", text: "Necesitamos mantener el SLA de 99.9% que teníamos en el contrato anterior." },
      { timestamp: "02:00", speaker: "Proveedor", text: "Eso es factible, lo incluimos en la propuesta revisada." },
    ],
  },
  {
    id: "r4",
    title: "Kick-off proyecto Alpha",
    date: "2026-02-22T10:00:00Z",
    duration: "1:05:20",
    host: "Inbest",
    platform: "Google Meet",
    video_url: "#",
    transcript: [
      { timestamp: "00:00", speaker: "Inbest", text: "Bienvenidos al kick-off del proyecto Alpha. Vamos a repasar el alcance y los entregables." },
      { timestamp: "01:00", speaker: "Pablo", text: "El diseño está listo. Tenemos 15 pantallas definidas para la primera fase." },
      { timestamp: "02:30", speaker: "Andres", text: "Del lado técnico, proponemos usar Next.js con Supabase para el backend." },
      { timestamp: "03:45", speaker: "Inbest", text: "Perfecto. El deadline para la primera entrega es el 15 de marzo." },
      { timestamp: "04:30", speaker: "Operaciones", text: "Ya tenemos el ambiente de staging listo para cuando necesiten hacer deploy." },
    ],
  },
  {
    id: "r5",
    title: "Demo producto v2",
    date: "2026-02-21T12:00:00Z",
    duration: "38:15",
    host: "Pablo",
    platform: "Google Meet",
    video_url: "#",
    transcript: [
      { timestamp: "00:00", speaker: "Pablo", text: "Les presento las nuevas funcionalidades de la versión 2 del producto." },
      { timestamp: "01:00", speaker: "Pablo", text: "Primero, el nuevo dashboard con widgets personalizables." },
      { timestamp: "02:30", speaker: "Wisdom", text: "Se ve muy bien. ¿Los usuarios pueden reorganizar los widgets?" },
      { timestamp: "03:00", speaker: "Pablo", text: "Sí, es completamente drag and drop. También agregamos modo oscuro." },
      { timestamp: "04:00", speaker: "Biofleming", text: "Los clientes van a estar muy contentos con estos cambios." },
    ],
  },
  {
    id: "r6",
    title: "1:1 con equipo de ventas",
    date: "2026-02-20T10:30:00Z",
    duration: "22:48",
    host: "Andres",
    platform: "Zoom",
    video_url: "#",
    transcript: [
      { timestamp: "00:00", speaker: "Andres", text: "Hola equipo, revisemos los números de la semana." },
      { timestamp: "00:30", speaker: "Vendedor 1", text: "Cerré dos cuentas nuevas esta semana, una de ellas enterprise." },
      { timestamp: "01:15", speaker: "Andres", text: "Excelente. ¿Cómo va la prospección para el próximo mes?" },
      { timestamp: "01:45", speaker: "Vendedor 2", text: "Tengo 8 reuniones agendadas con prospectos calificados." },
      { timestamp: "02:30", speaker: "Andres", text: "Muy bien, mantengamos ese ritmo. Vamos a revisar la estrategia de pricing." },
    ],
  },
];

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

// --- Components ---

function RecordingCard({
  recording,
  isExpanded,
  onToggle,
}: {
  recording: Recording;
  isExpanded: boolean;
  onToggle: () => void;
}) {
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
          </div>

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
  const [recordings, setRecordings] = useState<Recording[]>(mockRecordings);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedHost !== "Todos") params.set("host", selectedHost);

      const res = await fetch(`/api/recall/recordings?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.recordings && data.recordings.length > 0) {
          setRecordings(data.recordings);
        } else {
          // Use mock data if no real recordings yet
          const filtered = selectedHost === "Todos"
            ? mockRecordings
            : mockRecordings.filter((r) => r.host === selectedHost);
          setRecordings(filtered);
        }
      }
    } catch {
      // Fallback to mock data
      const filtered = selectedHost === "Todos"
        ? mockRecordings
        : mockRecordings.filter((r) => r.host === selectedHost);
      setRecordings(filtered);
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

  return (
    <div>
      {/* Top bar: title + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 md:mb-6">
        <div className="flex items-center gap-2">
          <Video size={18} className="text-[#2055e4]" />
          <h2 className="text-lg font-semibold text-gray-900">Grabaciones Realizadas</h2>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-[#2055e4] text-xs font-semibold">
            {recordings.length}
          </span>
        </div>

        <div className="relative sm:max-w-xs w-full sm:w-auto">
          <select
            value={selectedHost}
            onChange={(e) => {
              setSelectedHost(e.target.value);
              setExpandedId(null);
            }}
            className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2055e4]/30 focus:border-[#2055e4] transition-all cursor-pointer"
          >
            {hostOptions.map((host) => (
              <option key={host} value={host}>
                {host === "Todos" ? "Todos los anfitriones" : host}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[#2055e4]" />
        </div>
      ) : recordings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 mb-4">
            <Video size={24} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 font-medium">No hay grabaciones para este anfitrión</p>
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
  );
}
