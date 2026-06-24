'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import {
  calculatePlayerStats,
  formatClock,
} from "@/lib/typing-room";
import { resolveTypingWebSocketUrl } from "@/lib/typing-ws-url";
import {
  type BattlePlayer,
  type BattleRoom,
  type BattleRankingEntry,
} from "@/lib/typing-battle";
import { buildFallbackCatalog, type CatalogText } from "@/lib/text-catalog";
import TextCatalogModal from "@/components/text-catalog-modal";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export default function BattleArena({
  playerName,
  isMaster,
  roomCode,
}: {
  playerName: string;
  isMaster: boolean;
  roomCode: string;
}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [room, setRoom] = useState<BattleRoom | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [localInput, setLocalInput] = useState("");
  const [textCatalog, setTextCatalog] = useState<CatalogText[]>(() => buildFallbackCatalog());
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const typingInputRef = useRef<HTMLTextAreaElement | null>(null);
  const mountedRef = useRef(false);
  const localTypingVersionRef = useRef(0);
  const typingSendRafRef = useRef<number | null>(null);
  const queuedTypingRef = useRef<{ input: string; typingVersion: number } | null>(null);
  const challengeTextRef = useRef<HTMLParagraphElement | null>(null);
  const iFinishedRef = useRef(false);
  const localFinishedAtRef = useRef<number | null>(null);
  const myPlayerIdRef = useRef<string | null>(null);

  const displayName = isMaster ? "Maestro" : (playerName?.trim() || "Jugador");

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const response = await fetch("/api/text-catalog", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as { texts?: CatalogText[] };
        if (payload.texts?.length) setTextCatalog(payload.texts);
      }
    } catch { setTextCatalog(buildFallbackCatalog()); }
    finally { setCatalogLoading(false); }
  }, []);

  useEffect(() => { void refreshCatalog(); }, [refreshCatalog]);

  useEffect(() => {
    mountedRef.current = true;
    const resolvedSocketUrl = resolveTypingWebSocketUrl();
    let reconnectDelay = 1000;
    const maxReconnectDelay = 30000;

    const connect = () => {
      if (!mountedRef.current) return;
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        if (!joined) { send(socketRef.current, { type: "join-battle", name: displayName, role: isMaster ? "master" : "player" }); setJoined(true); }
        return;
      }
      setConnectionState("connecting");
      const socket = new WebSocket(resolvedSocketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectDelay = 1000;
        setConnectionState("connected");
        send(socket, { type: "join-battle", name: displayName, role: isMaster ? "master" : "player" });
        setJoined(true);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string);
          if (payload.type === "battle-snapshot") setRoom(payload.room);
          if (payload.type === "battle-typing-update") {
            setRoom((current) => {
              if (!current) return current;
              return {
                ...current,
                players: current.players.map((p) =>
                  p.id === payload.playerId
                    ? { ...p, input: payload.input, typingVersion: payload.typingVersion }
                    : p),
                updatedAt: payload.updatedAt,
              };
            });
          }
          if (payload.type === "server-note") {
            const msg = payload.message as string;
            if (msg.startsWith("joined:") && !msg.startsWith("joined:master:")) {
              myPlayerIdRef.current = msg.slice(7);
            }
          }
          if (payload.type === "error") setConnectionState("error");
        } catch { setConnectionState("error"); }
      };

      socket.onerror = () => setConnectionState("error");
      socket.onclose = () => {
        if (!mountedRef.current) return;
        setConnectionState("disconnected"); setJoined(false);
        if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);
      };
    };
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
    };
  }, [displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (room?.matchState !== "countdown" && room?.matchState !== "live") return;
    if (iFinishedRef.current && room?.matchState !== "finished") {
      setClockTick(localFinishedAtRef.current ?? Date.now());
      return;
    }
    const timer = window.setInterval(() => setClockTick(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [room?.matchState, room?.countdownEndsAt]);

  useEffect(() => {
    if (!room) return;
    const myP = room.players.find((p) => p.id === myPlayerIdRef.current) || room.players.find((p) => p.name === displayName);
    if (myP?.finished) {
      setLocalInput("");
      queuedTypingRef.current = null;
      localTypingVersionRef.current = 0;
    }
  }, [room?.players, displayName]);

  useEffect(() => {
    if (!room || room.matchState !== "live" || isMaster) return;
    const cursorEl = challengeTextRef.current?.querySelector<HTMLSpanElement>('[data-battle-cursor="true"]');
    if (cursorEl) cursorEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [room?.updatedAt, room?.matchState, isMaster]);

  function send(socket: WebSocket, message: Record<string, unknown>) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ ...message, roomCode }));
  }

  function sendToServer(message: Record<string, unknown>) {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ ...message, roomCode }));
  }

  function flushQueuedTyping() {
    typingSendRafRef.current = null;
    if (iFinishedRef.current) return;
    const pendingTyping = queuedTypingRef.current;
    if (!pendingTyping) return;
    queuedTypingRef.current = null;
    sendToServer({ type: "battle-typing", input: pendingTyping.input, typingVersion: pendingTyping.typingVersion });
  }

  function handleTypingChange(value: string) {
    if (iFinishedRef.current) return;
    const challenge = textCatalog[room?.selectedTextIndex ?? 0]?.text ?? "";
    if (!challenge) return;
    const normalizedValue = value.normalize("NFC");
    const normalizedTarget = challenge.normalize("NFC");

    if (normalizedValue.length >= normalizedTarget.length) {
      const typedPrefix = normalizedValue.slice(0, normalizedTarget.length);
      if (typedPrefix === normalizedTarget) {
        iFinishedRef.current = true;
        localFinishedAtRef.current = Date.now();
        setLocalInput(challenge);
        sendToServer({ type: "battle-typing", input: challenge, typingVersion: localTypingVersionRef.current + 1 });
        return;
      }
    }

    const clamped = value.slice(0, challenge.length + 24);
    setLocalInput(clamped);
    const version = localTypingVersionRef.current + 1;
    localTypingVersionRef.current = version;
    queuedTypingRef.current = { input: clamped, typingVersion: version };
    if (typingSendRafRef.current === null) typingSendRafRef.current = window.requestAnimationFrame(flushQueuedTyping);
  }

  function getActiveChallenge() {
    const idx = room?.selectedTextIndex ?? 0;
    return textCatalog[Math.min(idx, textCatalog.length - 1)] ?? textCatalog[0];
  }

  function buildRanking(): BattleRankingEntry[] {
    if (!room) return [];
    const challenge = getActiveChallenge().text;
    const now = room.finishedAt ?? Date.now();
    return room.players
      .map((p) => {
        const stats = calculatePlayerStats(p.input, challenge, room.startedAt ?? 0, now, p.finishedAt);
        return {
          name: p.name, position: 0, wpm: stats.wpm, accuracy: stats.accuracy,
          errors: stats.mistakes, elapsed: stats.elapsed, elapsedText: stats.elapsedText,
          progress: stats.progress,
          score: Math.max(0, Math.round(stats.wpm * 2.2 + stats.accuracy * 1.15 - stats.mistakes * 4 + stats.progress * 0.25)),
        };
      })
      .sort((a, b) => {
        if (b.progress >= 100 && a.progress >= 100) return a.elapsed - b.elapsed;
        return b.progress - a.progress;
      })
      .map((entry, i) => ({ ...entry, position: i + 1 }));
  }

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Conectando a la sala de batalla...
      </div>
    );
  }

  const challenge = getActiveChallenge();
  const isLive = room.matchState === "live";
  const isFinished = room.matchState === "finished";
  const isLobby = room.matchState === "lobby";
  const showCountdown = room.matchState === "countdown";
  const ranking = isFinished ? buildRanking() : [];

  const myPlayer = room.players.find((p) => p.id === myPlayerIdRef.current) || room.players.find((p) => p.name === displayName);
  const effectiveFinishedAt = myPlayer?.finishedAt ?? localFinishedAtRef.current;
  const myStats = myPlayer
    ? calculatePlayerStats(myPlayer.input, challenge.text, room.startedAt ?? 0, isFinished ? (room.finishedAt ?? Date.now()) : effectiveFinishedAt ?? Date.now(), effectiveFinishedAt)
    : null;
  const iFinished = myPlayer?.finished ?? false;
  iFinishedRef.current = iFinished;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 py-3 sm:px-4 sm:py-4">
      {/* Header bar */}
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-(--accent)">Batalla #{roomCode}</span>
          {isMaster && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Maestro</span>}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            isLobby ? "bg-emerald-50 text-emerald-700" :
            showCountdown ? "bg-amber-50 text-amber-700" :
            isLive ? "bg-sky-50 text-sky-700" :
            "bg-purple-50 text-purple-700"
          }`}>
            {isLobby ? "Lobby" : showCountdown ? "Cuenta regresiva" : isLive ? "En vivo" : "Terminada"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>{room.players.length} jugadores</span>
          <span className={`h-1.5 w-1.5 rounded-full ${
            connectionState === "connected" ? "bg-emerald-500" : connectionState === "connecting" ? "bg-amber-500" : "bg-red-500"
          }`} />
        </div>
      </header>

      {/* Master controls */}
      {isMaster && isLobby && (
        <div className="mb-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCatalogModalOpen(true)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition"
            >
              {challenge.title} ({challenge.difficulty.label})
            </button>
            <button
              type="button"
              onClick={() => sendToServer({ type: "battle-start-countdown" })}
              disabled={room.players.length === 0 || catalogLoading}
              className="rounded-xl bg-(--accent) px-4 py-1.5 text-xs font-semibold text-white hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Iniciar batalla
            </button>
          </div>
        </div>
      )}

      {isMaster && (showCountdown || isLive) && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 shadow-sm backdrop-blur">
          <span className="text-xs text-slate-500">
            {showCountdown
              ? `Iniciando en ${room.countdownEndsAt ? Math.max(1, Math.ceil((room.countdownEndsAt - clockTick) / 1000)) : "..."}s`
              : `⏱ ${room.startedAt ? formatClock(clockTick - room.startedAt) : "00:00.00"}`}
          </span>
          <button
            type="button"
            onClick={() => sendToServer({ type: "battle-reset" })}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-medium text-rose-600 hover:bg-rose-100 transition"
          >
            Cancelar
          </button>
        </div>
      )}

      {isMaster && isFinished && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 shadow-sm backdrop-blur">
          <span className="text-xs font-medium text-emerald-600">Batalla finalizada</span>
          <button
            type="button"
            onClick={() => sendToServer({ type: "battle-reset" })}
            className="rounded-lg bg-(--accent) px-4 py-1.5 text-xs font-semibold text-white hover:brightness-105 transition"
          >
            Nueva batalla
          </button>
        </div>
      )}

      {/* Countdown */}
      {showCountdown && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <span className="text-4xl font-bold text-amber-600">
            {room.countdownEndsAt ? Math.max(1, Math.ceil((room.countdownEndsAt - clockTick) / 1000)) : "..."}
          </span>
          <p className="mt-1 text-xs text-amber-500">Preparate para escribir...</p>
        </div>
      )}

      {/* Two-column layout for live/finished */}
      {(isLive || isFinished || isLobby || showCountdown) && (
        <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
          {/* Left column: challenge + input */}
          <div className="space-y-3">
            {/* Challenge text */}
            {(isLive || isFinished) && (
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">{challenge.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    challenge.difficulty.tone === "emerald" ? "bg-emerald-50 text-emerald-600" :
                    challenge.difficulty.tone === "amber" ? "bg-amber-50 text-amber-600" :
                    "bg-rose-50 text-rose-600"
                  }`}>{challenge.difficulty.label}</span>
                </div>
                {isMaster ? (
                  <p className="text-lg leading-relaxed text-slate-700">{challenge.text}</p>
                ) : (
                  <p
                    ref={challengeTextRef}
                    className="max-h-[30vh] overflow-y-auto text-lg leading-relaxed select-none scroll-smooth"
                    style={{ wordBreak: "break-word" }}
                  >
                    {challenge.text.split("").map((char, i) => {
                      if (!myStats) return <span key={i} className="text-slate-300">{char}</span>;
                      const isCorrect = i < myStats.correctCharacters;
                      const isError = i < myStats.typedCharacters && i >= myStats.correctCharacters;
                      const isCursor = i === myStats.typedCharacters;
                      let c = "text-slate-300";
                      if (isCorrect) c = "text-emerald-600 font-medium";
                      else if (isError) c = "text-rose-600 bg-rose-100 rounded-sm";
                      else if (isCursor) c = "text-(--accent) font-bold underline decoration-(--accent) underline-offset-2";
                      return <span key={i} className={c} data-battle-cursor={isCursor ? "true" : undefined}>{char}</span>;
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Typing input */}
            {isLive && !isMaster && (
              <div>
                {iFinished ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                    <p className="text-sm font-medium text-emerald-700">¡Terminaste! 🎉</p>
                    <p className="mt-1 text-xs text-emerald-500">Esperá a que todos terminen para ver los resultados...</p>
                  </div>
                ) : (
                  <textarea
                    ref={typingInputRef}
                    value={localInput}
                    onChange={(e) => handleTypingChange(e.target.value)}
                    placeholder="Escribí el texto aquí..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg text-slate-900 placeholder-slate-300 outline-none focus:border-(--accent)/40 focus:ring-2 focus:ring-(--accent)/10 resize-none shadow-sm"
                    rows={2}
                    autoFocus
                    onPaste={(e) => e.preventDefault()}
                    onDrop={(e) => e.preventDefault()}
                  />
                )}
                {myStats && (
                  <div className="mt-2 flex gap-4 text-[10px] text-slate-400">
                    <span>{myStats.correctCharacters}/{myStats.targetCharacters} caracteres</span>
                    <span>{myStats.wpm} PPM</span>
                    <span>{myStats.accuracy}% precisión</span>
                    <span>{myStats.mistakes} errores</span>
                  </div>
                )}
              </div>
            )}

            {/* Empty state hint */}
            {isLobby && !isMaster && (
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm">
                <p className="text-sm text-slate-500">Esperando que el maestro inicie la batalla...</p>
                <p className="mt-1 text-xs text-slate-300">Código de sala: <span className="font-mono font-bold text-(--accent)">{roomCode}</span></p>
              </div>
            )}

            {/* Final ranking */}
            {isFinished && ranking.length > 0 && (
              <div className="rounded-2xl border border-(--accent)/10 bg-white/90 p-5 shadow-sm">
                <h2 className="mb-3 text-center text-lg font-bold text-slate-800">Clasificación Final</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] uppercase tracking-[0.15em] text-slate-400">
                        <th className="px-2 py-1.5 text-left">#</th>
                        <th className="px-2 py-1.5 text-left">Jugador</th>
                        <th className="px-2 py-1.5 text-right">PPM</th>
                        <th className="px-2 py-1.5 text-right">Prec.</th>
                        <th className="px-2 py-1.5 text-right">Err.</th>
                        <th className="px-2 py-1.5 text-right">Tiempo</th>
                        <th className="px-2 py-1.5 text-right">Puntaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((entry) => (
                        <tr key={entry.name} className={`border-b border-slate-50 ${entry.position === 1 ? "bg-amber-50/60" : ""}`}>
                          <td className="px-2 py-2 font-bold text-slate-700">
                            {entry.position === 1 ? "🥇" : entry.position === 2 ? "🥈" : entry.position === 3 ? "🥉" : entry.position}
                          </td>
                          <td className={`px-2 py-2 ${entry.position === 1 ? "font-bold text-amber-700" : "text-slate-700"}`}>{entry.name}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-slate-500">{entry.wpm}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-slate-500">{entry.accuracy}%</td>
                          <td className="px-2 py-2 text-right tabular-nums text-slate-500">{entry.errors}</td>
                          <td className="px-2 py-2 text-right tabular-nums font-mono text-slate-500">{entry.elapsedText}</td>
                          <td className="px-2 py-2 text-right font-mono font-bold text-(--accent)">{entry.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Activity */}
            <div className="rounded-2xl border border-slate-100 bg-white/50 p-3">
              <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300">Actividad</h3>
              <div className="space-y-0.5">
                {room.feed.slice(0, 5).map((msg, i) => (
                  <p key={i} className="text-[10px] text-slate-400">{msg}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: player progress sidebar */}
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur lg:sticky lg:top-20 lg:self-start">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
              {isLive ? "Progreso en vivo" : isFinished ? "Resultados" : `Jugadores (${room.players.length})`}
            </h2>
            {room.players.length > 0 ? (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {room.players.filter(p => p.name !== "Maestro").map((p) => {
                  const pFinishedAt = p.finishedAt ?? (p.id === myPlayerIdRef.current ? localFinishedAtRef.current : null);
                  const stats = calculatePlayerStats(p.input, challenge.text, room.startedAt ?? 0, pFinishedAt ?? Date.now(), pFinishedAt);
                  return (
                    <div key={p.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-medium truncate max-w-[100px] ${p.finished ? "text-emerald-700" : "text-slate-700"}`}>
                          {p.name} {p.finished ? "✓" : ""}
                        </span>
                        <span className="text-[10px] tabular-nums text-slate-400">
                          {p.finished ? formatClock(stats.elapsed) : `${stats.progress}%`}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${p.finished ? "bg-emerald-500" : "bg-(--accent)"}`}
                          style={{ width: `${Math.min(100, stats.progress)}%` }}
                        />
                      </div>
                      <div className="mt-1 flex gap-3 text-[9px] text-slate-400">
                        <span>{stats.wpm} ppm</span>
                        <span>{stats.accuracy}%</span>
                        <span>{stats.mistakes} err</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-300">Sin jugadores aún</p>
                <p className="mt-1 text-[10px] text-slate-200">
                  Código: <span className="font-mono font-bold text-(--accent)">{roomCode}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {isMaster && (
        <TextCatalogModal
          open={isCatalogModalOpen}
          texts={textCatalog}
          selectedIndex={room.selectedTextIndex}
          onSelect={(index) => { sendToServer({ type: "battle-set-text", selectedTextIndex: index }); setIsCatalogModalOpen(false); }}
          onClose={() => setIsCatalogModalOpen(false)}
          loading={catalogLoading}
          canManage={isMaster}
          onCatalogRefresh={refreshCatalog}
        />
      )}
    </main>
  );
}
