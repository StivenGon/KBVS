'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BattleMasterPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");

  const handleEnter = () => {
    const code = roomCode.replace(/\D/g, "") || "battle";
    router.push(`/battle/arena?mode=master&room=${encodeURIComponent(code)}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-lg">
        <h1 className="mb-2 text-center text-2xl font-bold text-amber-400">
          Maestro de Batalla
        </h1>
        <p className="mb-6 text-center text-sm text-white/60">
          Creá una sala de batalla real. Elegí el texto, iniciá la cuenta regresiva y mirá competir a todos.
        </p>

        <input
          type="text"
          inputMode="numeric"
          placeholder="Código de sala (ej: 1234)"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleEnter();
          }}
          maxLength={10}
          className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-amber-400/50"
          autoFocus
        />

        <button
          type="button"
          onClick={handleEnter}
          className="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white transition hover:brightness-110"
        >
          Abrir sala de batalla
        </button>

        <p className="mt-4 text-center text-xs text-white/30">
          Compartí el mismo código con los jugadores para que se unan a tu sala
        </p>
      </div>
    </main>
  );
}
