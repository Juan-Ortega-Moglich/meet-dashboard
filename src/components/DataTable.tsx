"use client";

import { Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 30;

interface Column {
  key: string;
  label: string;
  render?: (value: string, row: Record<string, string>) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, string>[];
  onRefresh?: () => void;
  extraActions?: React.ReactNode;
}

export default function DataTable({ columns, data, onRefresh, extraActions }: DataTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = data.filter((row) =>
    columns.some((col) =>
      row[col.key]?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Reset to first page when search changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2055e4] focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          {extraActions}
          <button
            onClick={onRefresh}
            className="flex items-center justify-center gap-2 px-4 py-2 text-white text-sm rounded-lg transition-colors hover:opacity-90"
            style={{ background: "#1a1d23" }}
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {paged.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 p-6 text-center text-gray-400">
            No se encontraron resultados
          </div>
        ) : (
          paged.map((row, i) => (
            <div
              key={i}
              className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 p-4 space-y-2"
            >
              {columns.map((col) => (
                <div key={col.key} className="flex justify-between items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase shrink-0">
                    {col.label}
                  </span>
                  <span className="text-sm text-gray-700 text-right">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No se encontraron resultados
                  </td>
                </tr>
              ) : (
                paged.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 text-gray-700 whitespace-nowrap"
                      >
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer with pagination */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          {filtered.length === 0
            ? "0 registros"
            : `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length} registros`}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={safePage === 0}
              className="px-2 py-1 text-xs rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Primera
            </button>
            <button
              onClick={() => setPage(safePage - 1)}
              disabled={safePage === 0}
              className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i)
              .filter(
                (i) =>
                  i === 0 ||
                  i === totalPages - 1 ||
                  (i >= safePage - 1 && i <= safePage + 1)
              )
              .reduce<(number | "dots")[]>((acc, i, idx, arr) => {
                if (idx > 0 && i - (arr[idx - 1] as number) > 1) {
                  acc.push("dots");
                }
                acc.push(i);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "dots" ? (
                  <span key={`dots-${idx}`} className="px-1 text-xs text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`w-8 h-8 text-xs rounded-md transition-colors ${
                      item === safePage
                        ? "bg-[#2055e4] text-white font-bold"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {item + 1}
                  </button>
                )
              )}

            <button
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= totalPages - 1}
              className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
              className="px-2 py-1 text-xs rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Última
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
