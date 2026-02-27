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

// --- Constants ---

const hostOptions = ["Todos", "Operaciones", "Andres", "Pablo", "Rafa", "Wisdom", "Biofleming", "Inbest"];

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

function HostSidebar({
  selectedHost,
  onSelect,
}: {
  selectedHost: string;
  onSelect: (host: string) => void;
}) {
  return (
    <div className="w-full md:w-56 shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Users size={15} className="text-gray-400" />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Anfitriones</h3>
      </div>
      <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
        {hostOptions.map((host) => {
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
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedHost !== "Todos") params.set("host", selectedHost);

      const res = await fetch(`/api/recall/recordings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecordings(data.recordings || []);
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
      {/* Left sidebar — host selection */}
      <HostSidebar selectedHost={selectedHost} onSelect={handleHostSelect} />

      {/* Right panel — recordings */}
      <div className="flex-1 min-w-0">
        {/* Header */}
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
