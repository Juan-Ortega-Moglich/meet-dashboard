"use client";

import { UserCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import DataTable from "@/components/DataTable";

const columns = [
  { key: "cliente", label: "Cliente" },
  { key: "empresa", label: "Empresa" },
  { key: "contacto", label: "Contacto" },
  { key: "kam", label: "KAM" },
  { key: "fecha", label: "Fecha" },
  {
    key: "perfil_url",
    label: "Perfil",
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
];

export default function PerfilClientePage() {
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("client_profiles")
      .select("cliente, empresa, contacto, kam, fecha, perfil_url")
      .order("fecha", { ascending: false });

    if (!error && rows) {
      setData(
        rows.map((r) => ({
          cliente: r.cliente || "",
          empresa: (r.empresa || "").trim(),
          contacto: (r.contacto || "").trim(),
          kam: r.kam || "",
          fecha: r.fecha || "",
          perfil_url: r.perfil_url || "",
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
          <UserCircle size={24} />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-[#212529]">
          Perfil de Cliente
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
              href="https://tally.so/r/w8Ayok"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 text-white text-sm rounded-lg transition-colors hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
            >
              <Plus size={16} />
              Generar perfil
            </a>
          }
        />
      )}
    </div>
  );
}
