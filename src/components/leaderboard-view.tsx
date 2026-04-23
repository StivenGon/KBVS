'use client';

import Image from "next/image";

import flisolLogo from "../../images/addons/Flisol 2026 rectangular.png";
import auspicioDicosta from "../../images/auspicios/dicosta.png";
import auspicioKaaSoft from "../../images/auspicios/kaa soft.png";
import auspicioLaFortuna from "../../images/auspicios/la fortuna.png";
import auspicioSGCreaciones from "../../images/auspicios/sg creaciones.png";

import { buildLeaderboard, type HistoryEntry, type SkillTier } from "@/lib/typing-room";

const featuredHistory: HistoryEntry[] = [
  {
    name: "Stiven Gonzalez",
    time: "00:58.12",
    errors: 0,
    accuracy: 99,
    wpm: 124,
    winner: true,
    score: 412,
  },
];

const sponsorAssets = [
  { name: "Dicosta", image: auspicioDicosta },
  { name: "Kaa Soft", image: auspicioKaaSoft },
  { name: "La Fortuna", image: auspicioLaFortuna },
  { name: "SG Creaciones", image: auspicioSGCreaciones },
];

export default function LeaderboardView() {
  const leaderboard = buildLeaderboard(featuredHistory);
  const podium = leaderboard.slice(0, 3);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-400 gap-4 px-3 py-4 sm:px-4 lg:px-6">
      <aside className="hidden w-72 shrink-0 xl:block">
        <SidebarBrand align="left" />
      </aside>

      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[36px] border border-white/60 bg-white/88 p-4 shadow-[0_24px_80px_rgba(15,34,64,0.18)] backdrop-blur-xl sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))]" />

        <div className="mb-4 space-y-2 lg:hidden">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/70 bg-white/80 px-4 py-4 shadow-[0_18px_50px_rgba(15,34,64,0.12)] backdrop-blur-md">
            <Image src={flisolLogo} alt="FLISOL 2026" className="h-auto w-full" priority />
          </div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Clasificación</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Tabla clasificatoria</h1>
        </div>

        <div className="hidden lg:block">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Clasificación</p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 xl:text-5xl">Tabla clasificatoria</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              El ranking ocupa la altura completa para verse más llamativo y destacar mejor a los primeros puestos.
            </p>
          </div>
        </div>

        {podium.length > 0 ? (
          <div className="mt-4 grid flex-wrap gap-3 sm:grid-cols-3">
            {podium.map((entry, index) => {
              const style =
                index === 0
                  ? "order-2 min-h-32 border-emerald-300/30 bg-emerald-300/10 sm:min-h-40"
                  : index === 1
                    ? "order-1 min-h-24 border-sky-300/30 bg-sky-300/10 sm:mt-8 sm:min-h-32"
                    : "order-3 min-h-24 border-amber-300/30 bg-amber-300/10 sm:mt-8 sm:min-h-32";

              return (
                <div
                  key={entry.name}
                  className={`flex flex-col justify-between rounded-[28px] border p-4 shadow-[0_14px_40px_rgba(15,34,64,0.08)] ${style}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Puesto {index + 1}</span>
                    <SkillBadge tier={entry.skillTier} />
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="truncate text-lg font-semibold text-slate-950 sm:text-xl">{entry.name}</p>
                    <p className="text-sm text-slate-600">{entry.skillScore} puntos · {entry.averageWpm} WPM · {entry.averageAccuracy}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-[28px] border border-slate-200 bg-white/82 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-4">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 flex-1 min-h-0">
            <div className="max-h-full overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-[11px] sm:text-xs">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Jugador</th>
                <th className="px-3 py-2 font-medium">Nivel</th>
                <th className="px-3 py-2 font-medium">Puntos</th>
                <th className="px-3 py-2 font-medium">Victorias</th>
                <th className="px-3 py-2 font-medium">WPM</th>
                <th className="px-3 py-2 font-medium">Precisión</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr key={entry.name} className="bg-white text-slate-950">
                  <td className="px-3 py-2 align-middle font-semibold text-slate-700">{index + 1}</td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="max-w-32 truncate font-medium text-slate-950">{entry.name}</span>
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-700">
                        Récord
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <SkillBadge tier={entry.skillTier} />
                  </td>
                  <td className="px-3 py-2 align-middle font-semibold text-slate-900">{entry.skillScore}</td>
                  <td className="px-3 py-2 align-middle text-slate-700">
                    {entry.wins}/{entry.matches}
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-700">{entry.averageWpm}</td>
                  <td className="px-3 py-2 align-middle text-slate-700">{entry.averageAccuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          </div>
        </div>

      </section>

      <aside className="hidden w-72 shrink-0 xl:block">
        <SidebarBrand align="right" />
      </aside>
    </main>
  );
}

function SidebarBrand({ align }: { align: "left" | "right" }) {
  return (
    <div className="sticky top-4 flex min-h-[calc(100dvh-2rem)] items-center justify-center overflow-hidden rounded-[34px] border border-white/70 bg-white/88 p-4 shadow-[0_24px_80px_rgba(15,34,64,0.16)] backdrop-blur-xl">
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_18px_50px_rgba(15,34,64,0.1)]">
        <div className={`w-full ${align === "right" ? "rotate-1" : "-rotate-1"}`}>
          <Image src={flisolLogo} alt="FLISOL 2026" className="h-auto w-full scale-[1.18] object-contain" priority />
        </div>

        <div className="grid w-full gap-3">
          {sponsorAssets.map((sponsor) => (
            <div
              key={sponsor.name}
              className="flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_30px_rgba(15,34,64,0.06)]"
            >
              <Image src={sponsor.image} alt={sponsor.name} className="h-auto w-full max-w-40 object-contain" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillBadge({ tier }: { tier: SkillTier }) {
  const toneClasses: Record<SkillTier, string> = {
    novato: "border-slate-300 bg-slate-100 text-slate-700",
    aprendiz: "border-amber-300/30 bg-amber-300/10 text-amber-700",
    competente: "border-emerald-300/30 bg-emerald-300/10 text-emerald-700",
    experto: "border-sky-300/30 bg-sky-300/10 text-sky-700",
    maestro: "border-(--accent-strong)/20 bg-(--accent-strong)/10 text-(--accent-strong)",
    leyenda: "border-rose-300/30 bg-rose-300/10 text-rose-700",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] ${toneClasses[tier]}`}>
      {tier}
    </span>
  );
}