import { UserCircle, FileText, Phone, Bot } from "lucide-react";
import Link from "next/link";

const cards = [
  {
    title: "Perfil de Cliente",
    description: "Gestiona la información de tus clientes",
    href: "/perfil-cliente",
    icon: UserCircle,
  },
  {
    title: "Minutas",
    description: "Revisa las minutas de tus reuniones",
    href: "/minutas",
    icon: FileText,
  },
  {
    title: "Números de Teléfono",
    description: "Directorio de contactos telefónicos",
    href: "/numeros-telefono",
    icon: Phone,
  },
  {
    title: "Bot de Grabación",
    description: "Configura y controla el bot de transcripción",
    href: "/bot-grabacion",
    icon: Bot,
  },
];

export default function Home() {
  return (
    <div>
      <div className="mb-6 md:mb-10">
        <h1 className="text-2xl md:text-4xl font-extrabold shimmer-text mb-2 md:mb-3">
          Bienvenido al Dashboard
        </h1>
        <p className="text-gray-500 text-sm md:text-lg">
          Selecciona una sección para comenzar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="card-hover relative overflow-hidden bg-white/70 backdrop-blur-sm rounded-2xl border border-[rgba(32,85,228,0.1)] p-5 md:p-7 hover:shadow-xl hover:shadow-[rgba(32,85,228,0.1)] transition-all duration-300 group active:scale-[0.98]"
            >
              {/* Decorative gradient blob */}
              <div
                className="absolute -top-10 -right-10 w-24 md:w-32 h-24 md:h-32 rounded-full opacity-15 group-hover:opacity-25 group-hover:scale-125 transition-all duration-500"
                style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
              />

              <div className="relative flex items-start gap-4 md:gap-5">
                <div
                  className="p-3 md:p-4 rounded-xl md:rounded-2xl text-white shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300"
                  style={{ background: "linear-gradient(135deg, #2055e4, #5980ff)" }}
                >
                  <Icon size={24} className="md:w-7 md:h-7" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base md:text-xl font-bold text-[#212529] group-hover:text-[#2055e4] transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-xs md:text-sm text-[#6c757d] mt-1 md:mt-2 leading-relaxed">
                    {card.description}
                  </p>
                  <span className="inline-block mt-2 md:mt-3 text-xs font-semibold text-[#2055e4] md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    Explorar →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
