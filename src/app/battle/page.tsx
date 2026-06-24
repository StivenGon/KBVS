'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BattleLobbyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const handleJoin = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const code = roomCode.replace(/\D/g, "") || "battle";
    router.push(`/battle/arena?name=${encodeURIComponent(trimmed)}&room=${encodeURIComponent(code)}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-lg">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Batalla Real
        </h1>
        <p className="mb-6 text-center text-sm text-white/60">
          Escribí tu nombre y el código de sala para entrar a la arena.
        </p>

        <input
          type="text"
          inputMode="numeric"
          placeholder="Código de sala (el mismo del maestro)"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          maxLength={10}
          className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-(--accent)/50"
        />

        <input
          type="text"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleJoin();
          }}
          maxLength={32}
          className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-(--accent)/50"
          autoFocus
        />

        <button
          type="button"
          onClick={handleJoin}
          disabled={!name.trim()}
          className="w-full rounded-xl bg-(--accent) px-4 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Entrar a la batalla
        </button>

        <p className="mt-4 text-center text-xs text-white/30">
          Usá el mismo código de sala que el maestro para unirte a la misma partida
        </p>

        <div className="mt-4 text-center">
          <a
            href="/battle/master"
            className="text-xs text-amber-400/70 hover:text-amber-300 underline underline-offset-2"
          >
            Soy el maestro — abrir sala de batalla
          </a>
        </div>
      </div>
    </main>
  );
}
