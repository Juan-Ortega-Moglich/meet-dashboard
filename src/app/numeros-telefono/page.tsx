"use client";

import { Phone, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import DataTable from "@/components/DataTable";

const columns = [
  { key: "kam", label: "KAM" },
  {
    key: "linkedin",
    label: "LinkedIn",
    render: (value: string) =>
      value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2055e4] hover:text-[#5980ff] font-medium underline underline-offset-2 transition-colors"
        >
          Ver perfil
        </a>
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
  { key: "numero", label: "Número" },
  { key: "fecha", label: "Fecha" },
];

export default function NumerosTelefonoPage() {
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("kam_directory")
      .select("kam, linkedin, numero, created_at")
      .order("created_at", { ascending: false });

    if (!error && rows) {
      setData(
        rows.map((r) => ({
          kam: r.kam || "",
          linkedin: r.linkedin || "",
          numero: r.numero || "",
          fecha: r.created_at ? new Date(r.created_at).toLocaleDateString("es-MX") : "",
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
          <Phone size={24} />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-[#212529]">
          Números de Teléfono
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-[#2055e4] rounded-full animate-spin" />
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
              Solicitar Número
            </a>
          }
        />
      )}
    </div>
  );
}
