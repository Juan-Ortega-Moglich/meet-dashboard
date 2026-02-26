"use client";

import { Plus, Calendar, Clock, Video, X, Link2, ChevronDown, Bot, Loader2, CheckCircle2, AlertCircle, LogIn, ExternalLink } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// --- Types ---

type BotStatus = "grabando" | "pendiente" | "finalizado";

interface Meeting {
  id: string;
  title: string;
  time: string;
  platform: string;
  botStatus: BotStatus;
  meetLink?: string | null;
}

interface Host {
  id: string;
  name: string;
  meetingsToday: Meeting[];
  upcomingMeetings: Meeting[];
}

interface ActiveBot {
  id: string;
  recall_bot_id: string;
  meeting_url: string;
  bot_name: string;
  host: string;
  status: string;
  meeting_title: string;
  created_at: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  meetLink: string | null;
  organizer: string;
  status: string;
}

// --- Mock Data (for hosts without calendar integration) ---

const hosts: { id: string; name: string; connected: boolean }[] = [
  { id: "operaciones", name: "Operaciones", connected: true },
  { id: "wisdom", name: "Wisdom", connected: true },
  { id: "biofleming", name: "Biofleming", connected: true },
  { id: "inbest", name: "Inbest", connected: true },
  { id: "andres", name: "Andres", connected: true },
  { id: "pablo", name: "Pablo", connected: true },
];

const mockHostData: Record<string, { meetingsToday: Meeting[]; upcomingMeetings: Meeting[] }> = {
  wisdom: {
    meetingsToday: [
      { id: "w1", title: "Sync semanal equipo", time: "09:00", platform: "Google Meet", botStatus: "finalizado" },
      { id: "w2", title: "Revisión pipeline Q1", time: "11:30", platform: "Google Meet", botStatus: "grabando" },
      { id: "w3", title: "Capacitación producto nuevo", time: "15:00", platform: "Zoom", botStatus: "pendiente" },
    ],
    upcomingMeetings: [
      { id: "w4", title: "Demo cliente Acme Corp", time: "2026-02-27 10:00", platform: "Google Meet", botStatus: "pendiente" },
      { id: "w5", title: "Planeación sprint 14", time: "2026-02-28 09:00", platform: "Zoom", botStatus: "pendiente" },
    ],
  },
  biofleming: {
    meetingsToday: [
      { id: "b1", title: "Standup diario", time: "08:30", platform: "Google Meet", botStatus: "finalizado" },
      { id: "b2", title: "Reunión con proveedor", time: "13:00", platform: "Zoom", botStatus: "grabando" },
    ],
    upcomingMeetings: [
      { id: "b3", title: "Presentación trimestral", time: "2026-02-27 14:00", platform: "Google Meet", botStatus: "pendiente" },
    ],
  },
  inbest: {
    meetingsToday: [
      { id: "i1", title: "Kick-off proyecto Alpha", time: "10:00", platform: "Google Meet", botStatus: "grabando" },
      { id: "i2", title: "Revisión de métricas", time: "14:30", platform: "Google Meet", botStatus: "pendiente" },
    ],
    upcomingMeetings: [
      { id: "i4", title: "Capacitación CRM", time: "2026-02-27 11:00", platform: "Zoom", botStatus: "pendiente" },
    ],
  },
  andres: {
    meetingsToday: [
      { id: "a1", title: "1:1 con equipo de ventas", time: "10:30", platform: "Zoom", botStatus: "grabando" },
    ],
    upcomingMeetings: [
      { id: "a2", title: "Entrevista candidato Sr.", time: "2026-02-27 15:00", platform: "Google Meet", botStatus: "pendiente" },
    ],
  },
  pablo: {
    meetingsToday: [
      { id: "p1", title: "Sync con diseño", time: "09:30", platform: "Google Meet", botStatus: "finalizado" },
      { id: "p2", title: "Demo producto v2", time: "12:00", platform: "Google Meet", botStatus: "grabando" },
    ],
    upcomingMeetings: [
      { id: "p4", title: "Workshop UX", time: "2026-02-27 09:00", platform: "Google Meet", botStatus: "pendiente" },
    ],
  },
};

// --- Recall status mapping ---

function recallStatusToLabel(status: string): string {
  const map: Record<string, string> = {
    joining_call: "Uniéndose…",
    in_waiting_room: "En sala de espera",
    in_call_not_recording: "En llamada",
    in_call_recording: "Grabando",
    call_ended: "Llamada terminada",
    done: "Finalizado",
    fatal: "Error",
  };
  return map[status] || status;
}

function recallStatusColor(status: string): { bg: string; text: string; dot: string; pulse?: boolean } {
  if (status === "in_call_recording") return { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", pulse: true };
  if (status === "joining_call" || status === "in_waiting_room" || status === "in_call_not_recording") return { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" };
  if (status === "done" || status === "call_ended") return { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" };
  if (status === "fatal") return { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" };
  return { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" };
}

function formatEventTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

function formatEventDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return isoString;
  }
}

// --- Components ---

function RecallBotBadge({ status }: { status: string }) {
  const colors = recallStatusColor(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
      {colors.pulse ? (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.dot} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${colors.dot}`} />
        </span>
      ) : (
        <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
      )}
      {recallStatusToLabel(status)}
    </span>
  );
}

function BotStatusBadge({ status }: { status: BotStatus }) {
  if (status === "grabando") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Grabando
      </span>
    );
  }
  if (status === "pendiente") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        <span className="h-2 w-2 rounded-full bg-yellow-500" />
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      <span className="h-2 w-2 rounded-full bg-gray-400" />
      Finalizado
    </span>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-blue-50 shrink-0">
            <Video size={18} className="text-[#2055e4]" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{meeting.title}</p>
            <p className="text-xs text-gray-500">{meeting.platform}</p>
          </div>
        </div>
        <BotStatusBadge status={meeting.botStatus} />
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock size={14} className="shrink-0" />
        <span>{meeting.time}</span>
      </div>
    </div>
  );
}

function CalendarMeetingCard({
  event,
  onSendBot,
  sendingBotId,
}: {
  event: CalendarEvent;
  onSendBot: (event: CalendarEvent) => void;
  sendingBotId: string | null;
}) {
  const hasEnded = new Date(event.end) < new Date();
  const isNow = new Date(event.start) <= new Date() && new Date(event.end) >= new Date();

  return (
    <div className={`bg-white rounded-xl border p-4 transition-all ${isNow ? "border-green-300 shadow-md ring-1 ring-green-100" : "border-gray-200 hover:shadow-md"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${isNow ? "bg-green-50" : "bg-blue-50"}`}>
            <Video size={18} className={isNow ? "text-green-600" : "text-[#2055e4]"} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{event.summary}</p>
            <p className="text-xs text-gray-500">Google Meet</p>
          </div>
        </div>
        {isNow && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            En curso
          </span>
        )}
        {hasEnded && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
            <span className="h-2 w-2 rounded-full bg-gray-400" />
            Finalizado
          </span>
        )}
        {!isNow && !hasEnded && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            Pendiente
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock size={14} className="shrink-0" />
          <span>{formatEventTime(event.start)} - {formatEventTime(event.end)}</span>
        </div>
        {event.meetLink && !hasEnded && (
          <button
            onClick={() => onSendBot(event)}
            disabled={sendingBotId === event.id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
          >
            {sendingBotId === event.id ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Bot size={12} />
            )}
            Enviar Bot
          </button>
        )}
      </div>
    </div>
  );
}

function ActiveBotCard({ bot }: { bot: ActiveBot }) {
  const time = new Date(bot.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-blue-50 shrink-0">
            <Bot size={18} className="text-[#2055e4]" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{bot.meeting_title}</p>
            <p className="text-xs text-gray-500 truncate">{bot.meeting_url}</p>
          </div>
        </div>
        <RecallBotBadge status={bot.status} />
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock size={14} className="shrink-0" />
        <span>{time}</span>
      </div>
    </div>
  );
}

function JoinBotModal({
  open,
  onClose,
  selectedHost,
}: {
  open: boolean;
  onClose: () => void;
  selectedHost: string;
}) {
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  if (!open) return null;

  const handleConfirm = async () => {
    if (!link.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/recall/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_url: link.trim(),
          host: selectedHost,
          meeting_title: title.trim() || "Reunión",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el bot");
      }
      setResult("success");
      setTimeout(() => {
        setLink("");
        setTitle("");
        setResult(null);
        onClose();
      }, 1500);
    } catch (err) {
      setResult("error");
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-white" style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}>
              <Bot size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Unir Bot a Reunión</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Pega el link de la reunión (Google Meet, Zoom, etc.) para que el bot se una y comience a grabar.
        </p>
        <div className="relative mb-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre de la reunión (opcional)"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2055e4]/30 focus:border-[#2055e4] transition-all" />
        </div>
        <div className="relative mb-5">
          <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2055e4]/30 focus:border-[#2055e4] transition-all"
            autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }} />
        </div>
        {result === "success" && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-green-50 text-green-700 text-sm">
            <CheckCircle2 size={16} />Bot enviado correctamente. Se está uniendo a la reunión.
          </div>
        )}
        {result === "error" && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
            <AlertCircle size={16} />{errorMsg}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} disabled={!link.trim() || sending}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}>
            {sending ? (<><Loader2 size={16} className="animate-spin" />Enviando…</>) : "Unir Bot"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Page ---

export default function BotGrabacionPage() {
  const [selectedHostId, setSelectedHostId] = useState(hosts[0].id);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeBots, setActiveBots] = useState<ActiveBot[]>([]);

  // Calendar state (for connected hosts like Operaciones)
  const [calendarAuthorized, setCalendarAuthorized] = useState<boolean | null>(null);
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [sendingBotId, setSendingBotId] = useState<string | null>(null);

  const selectedHost = hosts.find((h) => h.id === selectedHostId) ?? hosts[0];
  const isConnectedHost = selectedHost.connected;

  // Fetch active bots
  const fetchActiveBots = useCallback(async () => {
    try {
      const res = await fetch(`/api/recall/bot?host=${selectedHost.name}`);
      if (res.ok) {
        const data = await res.json();
        setActiveBots(data.bots || []);
      }
    } catch { /* silently fail */ }
  }, [selectedHost.name]);

  // Fetch calendar events for connected hosts
  const fetchCalendar = useCallback(async () => {
    if (!isConnectedHost) return;
    setCalendarLoading(true);
    try {
      const [todayRes, upcomingRes] = await Promise.all([
        fetch(`/api/calendar?host=${selectedHost.name}&range=today`),
        fetch(`/api/calendar?host=${selectedHost.name}&range=upcoming`),
      ]);
      const todayData = await todayRes.json();
      const upcomingData = await upcomingRes.json();

      if (todayData.authorized === false) {
        setCalendarAuthorized(false);
        setTodayEvents([]);
        setUpcomingEvents([]);
      } else {
        setCalendarAuthorized(true);
        setTodayEvents(todayData.events || []);
        setUpcomingEvents(upcomingData.events || []);
      }
    } catch {
      setCalendarAuthorized(false);
    } finally {
      setCalendarLoading(false);
    }
  }, [isConnectedHost, selectedHost.name]);

  useEffect(() => {
    fetchActiveBots();
    fetchCalendar();
    const interval = setInterval(fetchActiveBots, 10000);
    return () => clearInterval(interval);
  }, [fetchActiveBots, fetchCalendar]);

  const handleModalClose = () => {
    setModalOpen(false);
    setTimeout(fetchActiveBots, 1000);
  };

  // Send bot to a calendar event
  const handleSendBotToEvent = async (event: CalendarEvent) => {
    if (!event.meetLink) return;
    setSendingBotId(event.id);
    try {
      const res = await fetch("/api/recall/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_url: event.meetLink,
          host: selectedHost.name,
          meeting_title: event.summary,
        }),
      });
      if (res.ok) {
        setTimeout(fetchActiveBots, 1000);
      }
    } catch { /* silently fail */ }
    finally {
      setTimeout(() => setSendingBotId(null), 2000);
    }
  };

  const liveActiveBots = activeBots.filter((b) => !["done", "fatal", "call_ended"].includes(b.status));
  const completedBots = activeBots.filter((b) => ["done", "call_ended"].includes(b.status));

  // Mock data for non-connected hosts
  const mockData = !isConnectedHost ? mockHostData[selectedHostId] : null;

  return (
    <div>
      {/* Host Select + Unir Bot */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 md:mb-8">
        <div className="relative flex-1 sm:max-w-xs">
          <select
            value={selectedHostId}
            onChange={(e) => {
              setSelectedHostId(e.target.value);
              setCalendarAuthorized(null);
              setTodayEvents([]);
              setUpcomingEvents([]);
            }}
            className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2055e4]/30 focus:border-[#2055e4] transition-all cursor-pointer"
          >
            {hosts.map((host) => (
              <option key={host.id} value={host.id}>
                {host.name} {host.connected ? " (Conectado)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-xl transition-all hover:opacity-90 hover:shadow-lg w-full sm:w-auto"
          style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
        >
          <Plus size={16} />
          Unir Bot
        </button>
      </div>

      {/* Connect Calendar prompt (for connected hosts not yet authorized) */}
      {isConnectedHost && calendarAuthorized === false && (
        <div className="mb-6 md:mb-8 bg-white rounded-2xl border border-blue-200 p-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 mb-4">
            <Calendar size={24} className="text-[#2055e4]" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Conectar Calendario de {selectedHost.name}</h3>
          <p className="text-sm text-gray-500 mb-4">
            Autoriza el acceso al calendario de Google para ver las reuniones y enviar bots automáticamente.
          </p>
          <a
            href={`/api/auth/google?host=${selectedHost.name}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-xl transition-all hover:opacity-90 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
          >
            <LogIn size={16} />
            Conectar Google Calendar
          </a>
        </div>
      )}

      {/* Active Bots */}
      {liveActiveBots.length > 0 && (
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={18} className="text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Bots Activos</h2>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">{liveActiveBots.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveActiveBots.map((bot) => <ActiveBotCard key={bot.id} bot={bot} />)}
          </div>
        </div>
      )}

      {/* Completed Bots */}
      {completedBots.length > 0 && (
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Bots Finalizados</h2>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">{completedBots.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {completedBots.map((bot) => <ActiveBotCard key={bot.id} bot={bot} />)}
          </div>
        </div>
      )}

      {/* === CALENDAR EVENTS (connected host) === */}
      {isConnectedHost && calendarAuthorized && (
        <>
          {calendarLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[#2055e4]" />
            </div>
          ) : (
            <>
              {/* Today's meetings */}
              <div className="mb-6 md:mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={18} className="text-[#2055e4]" />
                  <h2 className="text-lg font-semibold text-gray-900">Reuniones de Hoy</h2>
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-[#2055e4] text-xs font-semibold">{todayEvents.length}</span>
                </div>
                {todayEvents.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <p className="text-sm text-gray-400">No hay reuniones para hoy</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {todayEvents.map((event) => (
                      <CalendarMeetingCard key={event.id} event={event} onSendBot={handleSendBotToEvent} sendingBotId={sendingBotId} />
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming meetings */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={18} className="text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900">Próximas Reuniones</h2>
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">{upcomingEvents.length}</span>
                </div>
                {upcomingEvents.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <p className="text-sm text-gray-400">No hay reuniones próximas</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {upcomingEvents.map((event) => (
                      <CalendarMeetingCard key={event.id} event={event} onSendBot={handleSendBotToEvent} sendingBotId={sendingBotId} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* === MOCK MEETINGS (non-connected hosts) === */}
      {!isConnectedHost && mockData && (
        <>
          <div className="mb-6 md:mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-[#2055e4]" />
              <h2 className="text-lg font-semibold text-gray-900">Reuniones de Hoy</h2>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-[#2055e4] text-xs font-semibold">{mockData.meetingsToday.length}</span>
            </div>
            {mockData.meetingsToday.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-400">No hay reuniones para hoy</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {mockData.meetingsToday.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} className="text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Próximas Reuniones</h2>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">{mockData.upcomingMeetings.length}</span>
            </div>
            {mockData.upcomingMeetings.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-400">No hay reuniones próximas</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {mockData.upcomingMeetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}
              </div>
            )}
          </div>
        </>
      )}

      <JoinBotModal open={modalOpen} onClose={handleModalClose} selectedHost={selectedHost.name} />
    </div>
  );
}
