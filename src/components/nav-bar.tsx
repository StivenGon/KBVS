'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/master", label: "Maestro" },
  { href: "/player", label: "Jugador" },
  { href: "/battle", label: "Batalla" },
  { href: "/clasificacion", label: "Ranking" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-center gap-1 border-b border-white/10 bg-black/50 px-2 py-1.5 backdrop-blur-lg">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              isActive
                ? "bg-(--accent) text-white"
                : "text-white/50 hover:bg-white/10 hover:text-white/80"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
