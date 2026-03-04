"use client";

import { Phone, Plus, Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import DataTable from "@/components/DataTable";

const columns = [
  { key: "kam", label: "KAM" },
  {
    key: "linkedin",
    label: "LinkedIn",
    render: (value: string) =>
      value ? (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2055e4] hover:text-[#5980ff] font-medium underline underline-offset-2 transition-colors"
        >
          Ver perfil
        </a>
      ) : (
        <span className="text-gray-400">&mdash;</span>
      ),
  },
  { key: "numero", label: "Numero" },
  { key: "fecha", label: "Fecha" },
];

export default function NumerosTelefonoPage() {
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clay");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al leer datos");
      }
      const { data: rows } = await res.json();
      setData(
        (rows || []).map((r: Record<string, string>) => ({
          kam: r["kam"] || "",
          linkedin: r["linkedin"] || "",
          numero: r["número"] || r["numero"] || "",
          fecha: r["fecha"] || "",
        }))
      );
    } catch (err) {
      console.error("[NumerosTelefono] Error:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <div className="p-2 rounded-lg text-white shrink-0" style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}>
          <Phone size={24} />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-[#212529]">
          Numeros de Telefono
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#2055e4]" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onRefresh={fetchData}
          extraActions={
            <a
              href="https://tally.so/r/kdllVJ"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 text-white text-sm rounded-lg transition-colors hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
            >
              <Plus size={16} />
              Solicitar Numero
            </a>
          }
        />
      )}
    </div>
  );
}
