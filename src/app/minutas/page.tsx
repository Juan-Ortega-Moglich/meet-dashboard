"use client";

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import DataTable from "@/components/DataTable";

const columns = [
  { key: "cliente", label: "Cliente" },
  { key: "nombre", label: "Nombre de la Reunión" },
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
        <span className="text-gray-400">—</span>
      ),
  },
  { key: "fecha", label: "Fecha" },
];

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
