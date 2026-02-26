"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserCircle,
  FileText,
  Phone,
  Bot,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

const menuItems = [
  {
    label: "Perfil de Cliente",
    href: "/perfil-cliente",
    icon: UserCircle,
  },
  {
    label: "Minutas",
    href: "/minutas",
    icon: FileText,
  },
  {
    label: "Números de Teléfono",
    href: "/numeros-telefono",
    icon: Phone,
  },
  {
    label: "Bot de Grabación",
    href: "/bot-grabacion",
    icon: Bot,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center px-4 shadow-lg" style={{ background: "linear-gradient(135deg, #1a1d23, #2d3748)" }}>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
        >
          <Menu size={24} />
        </button>
        <Link href="/" className="flex items-center gap-2 ml-3">
          <span className="text-base font-bold text-white">
            Möglich Asociados
          </span>
        </Link>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          h-screen text-white flex flex-col shadow-2xl
          fixed top-0 z-50 transition-all duration-300

          ${mobileOpen ? "left-0" : "-left-72"}
          w-72

          md:left-0
          ${collapsed ? "md:w-20" : "md:w-64"}
        `}
        style={{ background: "linear-gradient(135deg, #1a1d23 0%, #2d3748 100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                Möglich Asociados
              </h1>
            </Link>
          )}

          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors md:hidden ml-auto"
          >
            <X size={20} />
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors ml-auto hidden md:block"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-2">
          {menuItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "text-white shadow-lg"
                    : "text-gray-400 hover:bg-white/10 hover:text-white hover:translate-x-1"
                }`}
                style={isActive ? { background: "linear-gradient(135deg, #2055e4, #5980ff)" } : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={22} className="shrink-0" />
                <span className={`text-sm font-medium ${collapsed ? "md:hidden" : ""}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <p className={`text-xs text-gray-500 ${collapsed ? "md:hidden" : ""}`}>v1.0.0</p>
        </div>
      </aside>
    </>
  );
}
