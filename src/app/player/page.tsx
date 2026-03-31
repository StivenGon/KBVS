'use client';

import Link from "next/link";
import { useMemo, useState } from "react";

export default function PlayerJoinPage() {
  const [roomCode, setRoomCode] = useState("");
  const normalizedRoom = useMemo(() => roomCode.trim().toUpperCase(), [roomCode]);
  const encodedRoom = encodeURIComponent(normalizedRoom);
  const joinEnabled = normalizedRoom.length > 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <section className="space-y-6 rounded-4xl border border-white/10 bg-(--surface) p-6 shadow-[0_30px_100px_rgba(1,8,18,0.45)] backdrop-blur-xl sm:p-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Jugador</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Entrar a la sala</h1>
          <p className="text-sm leading-6 text-slate-300">Pega el código y elige tu plaza.</p>
        </div>

        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Código de sala</span>
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            placeholder="SALA-1234"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-white/30"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <JoinLink href={joinEnabled ? `/player/A?room=${encodedRoom}` : "#"} label="Entrar como A" disabled={!joinEnabled} />
          <JoinLink href={joinEnabled ? `/player/B?room=${encodedRoom}` : "#"} label="Entrar como B" disabled={!joinEnabled} />
        </div>
      </section>
    </main>
  );
}

function JoinLink({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      className={`rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
        disabled
          ? "pointer-events-none border-white/10 bg-white/5 text-slate-500"
          : "border-emerald-300/30 bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/25"
      }`}
    >
      {label}
    </Link>
  );
}
