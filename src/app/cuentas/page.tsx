"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn,
  RefreshCw,
  Mail,
  Calendar,
  Clock,
  Shield,
} from "lucide-react";

interface Account {
  id: string;
  name: string;
  calendarType: "google" | "ics";
  connected: boolean;
  email: string | null;
  status: "valid" | "expired" | "error" | "no_token" | "ics";
  lastUpdated: string | null;
  tokenExpiry: string | null;
  error: string | null;
}

function StatusBadge({ status }: { status: Account["status"] }) {
  if (status === "valid") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <CheckCircle2 size={12} />
        Conectado
      </span>
    );
  }
  if (status === "ics") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
        <Calendar size={12} />
        ICS (Outlook)
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <AlertCircle size={12} />
        Token expirado
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <AlertCircle size={12} />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      <AlertCircle size={12} />
      No conectado
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CuentasPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [successHost, setSuccessHost] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cuentas");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    const authSuccess = searchParams.get("auth_success");
    if (authSuccess) {
      setSuccessHost(authSuccess);
      // Clear URL params
      window.history.replaceState({}, "", "/cuentas");
      setTimeout(() => setSuccessHost(null), 5000);
    }
  }, [fetchAccounts, searchParams]);

  const handleReauth = (hostName: string) => {
    setRefreshingId(hostName);
    // Redirect to Google OAuth — use cuentas: prefix so callback returns here
    window.location.href = `/api/auth/google?host=cuentas:${hostName}`;
  };

  const validCount = accounts.filter((a) => a.status === "valid" || a.status === "ics").length;
  const expiredCount = accounts.filter((a) => a.status === "expired" || a.status === "error").length;
  const noTokenCount = accounts.filter((a) => a.status === "no_token").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Cuentas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Administra las conexiones de Google Calendar de cada host.
        </p>
      </div>

      {/* Success banner */}
      {successHost && (
        <div className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm">
          <CheckCircle2 size={16} />
          <span><strong>{successHost}</strong> se reautenticó correctamente.</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
              <CheckCircle2 size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{loading ? "—" : validCount}</p>
              <p className="text-xs text-gray-500">Conectadas</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30">
              <AlertCircle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{loading ? "—" : expiredCount}</p>
              <p className="text-xs text-gray-500">Expiradas / Error</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
              <Shield size={20} className="text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{loading ? "—" : noTokenCount}</p>
              <p className="text-xs text-gray-500">Sin conectar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh all button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={fetchAccounts}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Verificar todas
        </button>
      </div>

      {/* Account list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#2055e4]" />
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`bg-white dark:bg-gray-900 rounded-xl border p-5 transition-all ${
                account.status === "expired" || account.status === "error"
                  ? "border-red-200 dark:border-red-800 ring-1 ring-red-100 dark:ring-red-900/30"
                  : account.status === "valid" || account.status === "ics"
                    ? "border-gray-200 dark:border-gray-700"
                    : "border-yellow-200 dark:border-yellow-800 ring-1 ring-yellow-100 dark:ring-yellow-900/30"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left side: info */}
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`p-3 rounded-xl shrink-0 ${
                      account.status === "valid"
                        ? "bg-green-50 dark:bg-green-900/30"
                        : account.status === "ics"
                          ? "bg-blue-50 dark:bg-blue-900/30"
                          : account.status === "expired" || account.status === "error"
                            ? "bg-red-50 dark:bg-red-900/30"
                            : "bg-gray-50 dark:bg-gray-800"
                    }`}
                  >
                    <KeyRound
                      size={22}
                      className={
                        account.status === "valid"
                          ? "text-green-600"
                          : account.status === "ics"
                            ? "text-blue-600"
                            : account.status === "expired" || account.status === "error"
                              ? "text-red-500"
                              : "text-gray-400"
                      }
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {account.name}
                      </h3>
                      <StatusBadge status={account.status} />
                    </div>
                    {account.email && (
                      <p className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-1">
                        <Mail size={13} className="shrink-0" />
                        {account.email}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                      {account.calendarType === "ics" && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          Outlook ICS (no requiere OAuth)
                        </span>
                      )}
                      {account.lastUpdated && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          Actualizado: {formatDate(account.lastUpdated)}
                        </span>
                      )}
                      {account.error && (
                        <span className="text-red-500">
                          {account.error}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: action button */}
                {account.calendarType === "google" && (
                  <div className="shrink-0 sm:ml-4">
                    {account.status === "valid" ? (
                      <button
                        onClick={() => handleReauth(account.name)}
                        disabled={refreshingId === account.name}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
                      >
                        {refreshingId === account.name ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        Reautenticar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReauth(account.name)}
                        disabled={refreshingId === account.name}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-50 w-full sm:w-auto justify-center"
                        style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
                      >
                        {refreshingId === account.name ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <LogIn size={14} />
                        )}
                        {account.status === "no_token" ? "Conectar" : "Reautenticar"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
