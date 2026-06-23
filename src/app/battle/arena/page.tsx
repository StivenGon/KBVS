'use client';

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BattleArena from "@/components/battle-arena";

function BattleArenaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "";
  const mode = searchParams.get("mode") || "player";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!name.trim() && mode !== "master") {
      router.push("/battle");
      return;
    }
    setReady(true);
  }, [name, mode, router]);

  if (!ready) return null;

  return <BattleArena playerName={name} isMaster={mode === "master"} />;
}

export default function BattleArenaPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white">Cargando...</div>}>
      <BattleArenaContent />
    </Suspense>
  );
}
