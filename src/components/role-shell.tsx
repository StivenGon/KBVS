'use client';

import { useEffect } from "react";

import TypingArena from "@/components/typing-arena";
import { type ClientRole } from "@/lib/typing-room";

export default function RoleShell({
  role,
  title,
  description,
  roomCode,
  playerName,
  showIntro = true,
}: {
  role: ClientRole;
  title: string;
  description: string;
  roomCode: string;
  playerName?: string;
  showIntro?: boolean;
}) {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("role", role);

    url.searchParams.set("room", roomCode);

    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, [role, roomCode]);

  useEffect(() => {
    if (role !== "master") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [role]);

  const shellClassName =
    role === "master"
      ? "mx-auto flex h-dvh w-full max-w-none flex-col overflow-hidden px-3 py-3 sm:px-4 lg:px-5"
      : "mx-auto flex h-dvh min-h-0 w-full max-w-screen-2xl flex-col overflow-hidden px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4";

  return (
    <main className={shellClassName}>
      {role === "master" || !showIntro ? null : (
        <section className="mb-3 rounded-[28px] border border-white/10 bg-(--surface) p-3 text-slate-100 shadow-[0_20px_60px_rgba(1,8,18,0.3)] backdrop-blur-xl sm:p-4">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-400">{title}</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
        </section>
      )}

      <TypingArena key={`${roomCode}:${role}:${playerName ?? ""}`} roomCode={roomCode} initialRole={role} playerName={playerName} />
    </main>
  );
}