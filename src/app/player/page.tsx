'use client';

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function PlayerJoinPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const normalizedRoom = useMemo(() => roomCode.replace(/\D/g, ""), [roomCode]);
  const normalizedName = useMemo(() => playerName.trim(), [playerName]);
  const encodedRoom = encodeURIComponent(normalizedRoom);
  const encodedName = encodeURIComponent(normalizedName);
  const joinEnabled = normalizedRoom.length > 0;
  const playerQuery = normalizedName.length > 0 ? `&name=${encodedName}` : "";

  function joinSeat(seat: "A" | "B") {
    if (!joinEnabled) {
      return;
    }

    router.push(`/player/${seat}?room=${encodedRoom}${playerQuery}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-3 py-4 sm:px-4 lg:px-6">
      <section className="relative grid w-full gap-5 overflow-hidden rounded-[36px] border border-white/60 bg-white/85 p-5 shadow-[0_24px_80px_rgba(15,34,64,0.18)] backdrop-blur-xl sm:p-7 lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent-strong),var(--accent))]" />
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.45em] text-(--accent-strong)">Jugador</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Entrar a la sala</h1>
            <p className="text-sm leading-6 text-slate-600">Ingresa el codigo de la sala para ingresar.</p>
          </div>
        </div>

        <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-5">
          <label className="block space-y-2">
            <span className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Codigo numerico de sala</span>
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1234"
              className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-(--accent-strong)"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Tu nombre y apellido</span>
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Ej. Juan Perez"
              maxLength={32}
              className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-(--accent)"
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => joinSeat("A")}
              disabled={!joinEnabled}
              className="rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm font-medium text-sky-700 transition enabled:hover:bg-sky-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Entrar como jugador A
            </button>
            <button
              type="button"
              onClick={() => joinSeat("B")}
              disabled={!joinEnabled}
              className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-700 transition enabled:hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Entrar como jugador B
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
