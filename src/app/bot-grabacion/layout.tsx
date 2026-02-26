"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Video, Users } from "lucide-react";

const tabs = [
  { label: "Reuniones", href: "/bot-grabacion", icon: Users },
  { label: "Grabaciones", href: "/bot-grabacion/grabaciones", icon: Video },
];

export default function BotGrabacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
          >
            <Bot size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#212529]">
              Bot de Grabación
            </h1>
            <p className="text-xs md:text-sm text-gray-500">
              Gestiona reuniones y graba automáticamente por anfitrión
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 md:mb-8">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/bot-grabacion"
              ? pathname === "/bot-grabacion"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
              style={
                isActive
                  ? { background: "linear-gradient(135deg, #2055e4, #5980ff)" }
                  : undefined
              }
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
