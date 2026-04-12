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

  function joinRandomSeat() {
    if (!joinEnabled) {
      return;
    }

    const seat = Math.random() < 0.5 ? "A" : "B";
    router.push(`/player/${seat}?room=${encodedRoom}${playerQuery}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-3 py-4 sm:px-4 lg:px-6">
      <section className="relative grid w-full gap-5 overflow-hidden rounded-[36px] border border-white/60 bg-white/85 p-5 shadow-[0_24px_80px_rgba(15,34,64,0.18)] backdrop-blur-xl sm:p-7 lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent-strong),var(--accent))]" />
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.45em] text-(--accent-strong)">Jugador</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Entrar a la sala
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Ingresa el código de la sala para ingresar.
            </p>
          </div>

        </div>

        <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-5">
          <label className="block space-y-2">
            <span className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Código numérico de sala</span>
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
              placeholder="Ej. Juan Pérez"
              maxLength={32}
              className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-(--accent)"
            />
          </label>


          <button
            type="button"
            onClick={joinRandomSeat}
            disabled={!joinEnabled}
            className="w-full rounded-[22px] border border-(--accent)/20 bg-(--accent) px-4 py-3 text-center text-sm font-semibold text-white transition hover:brightness-105 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            Entrar
          </button>
        </div>
      </section>
    </main>
  );
}
