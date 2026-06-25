'use client';

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BattleArena from "@/components/battle-arena";

function BattleArenaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "";
  const mode = searchParams.get("mode") || "player";
  const roomCode = searchParams.get("room") || "battle";
  const ready = Boolean(name.trim() || mode === "master");

  useEffect(() => {
    if (!ready) {
      router.push("/battle");
    }
  }, [ready, router]);

  if (!ready) return null;

  return <BattleArena playerName={name} isMaster={mode === "master"} roomCode={roomCode} />;
}

export default function BattleArenaPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white">Cargando...</div>}>
      <BattleArenaContent />
    </Suspense>
  );
}
