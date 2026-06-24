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

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const typingInputRef = useRef<HTMLTextAreaElement | null>(null);
  const mountedRef = useRef(false);
  const localTypingVersionRef = useRef(0);
  const typingSendRafRef = useRef<number | null>(null);
  const queuedTypingRef = useRef<{ input: string; typingVersion: number } | null>(null);
  const challengeTextRef = useRef<HTMLParagraphElement | null>(null);

  const displayName = isMaster ? "Maestro" : (playerName?.trim() || "Jugador");

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const response = await fetch("/api/text-catalog", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as { texts?: CatalogText[] };
        if (payload.texts?.length) {
          setTextCatalog(payload.texts);
        }
      }
    } catch {
      setTextCatalog(buildFallbackCatalog());
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    mountedRef.current = true;
    const resolvedSocketUrl = resolveTypingWebSocketUrl();
    let reconnectDelay = 1000;
    const maxReconnectDelay = 30000;

    const connect = () => {
      if (!mountedRef.current) return;

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        if (!joined) {
          send(socketRef.current, {
            type: "join-battle",
            name: displayName,
          });
          setJoined(true);
        }
        return;
      }

      setConnectionState("connecting");
      const socket = new WebSocket(resolvedSocketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectDelay = 1000;
        setConnectionState("connected");
        send(socket, {
          type: "join-battle",
          name: displayName,
        });
        setJoined(true);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string);

          if (payload.type === "battle-snapshot") {
            setRoom(payload.room);
          }

          if (payload.type === "battle-typing-update") {
            setRoom((current) => {
              if (!current) return current;
              return {
                ...current,
                players: current.players.map((p) =>
                  p.id === payload.playerId
                    ? {
                        ...p,
                        input: payload.input,
                        typingVersion: payload.typingVersion,
                      }
                    : p,
                ),
                updatedAt: payload.updatedAt,
              };
            });
          }

          if (payload.type === "error") {
            setConnectionState("error");
          }
        } catch {
          setConnectionState("error");
        }
      };

      socket.onerror = () => setConnectionState("error");

      socket.onclose = () => {
        if (!mountedRef.current) return;
        setConnectionState("disconnected");
        setJoined(false);

        if (reconnectTimerRef.current !== null) {
          window.clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      socketRef.current?.close();
    };
  }, [displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (room?.matchState !== "countdown" && room?.matchState !== "live") return;
    const timer = window.setInterval(() => setClockTick(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [room?.matchState, room?.countdownEndsAt]);

  useEffect(() => {
    if (!room || room.matchState !== "live" || isMaster) return;
    const cursorEl = challengeTextRef.current?.querySelector<HTMLSpanElement>('[data-battle-cursor="true"]');
    if (cursorEl) {
      cursorEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [room?.updatedAt, room?.matchState, isMaster]);

  function send(socket: WebSocket, message: Record<string, unknown>) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ ...message, roomCode }));
    }
  }

  function sendToServer(message: Record<string, unknown>) {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ ...message, roomCode }));
    }
  }

  function flushQueuedTyping() {
    typingSendRafRef.current = null;
    const pendingTyping = queuedTypingRef.current;
    if (!pendingTyping) return;
    queuedTypingRef.current = null;
    sendToServer({
      type: "battle-typing",
      input: pendingTyping.input,
      typingVersion: pendingTyping.typingVersion,
    });
  }

  function handleTypingChange(value: string) {
    const challenge = textCatalog[room?.selectedTextIndex ?? 0]?.text ?? "";
    const clamped = value.slice(0, challenge.length + 24);
    setLocalInput(clamped);

    const version = localTypingVersionRef.current + 1;
    localTypingVersionRef.current = version;
    queuedTypingRef.current = { input: clamped, typingVersion: version };

    if (typingSendRafRef.current === null) {
      typingSendRafRef.current = window.requestAnimationFrame(flushQueuedTyping);
    }
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
        const stats = calculatePlayerStats(
          p.input,
          challenge,
          room.startedAt ?? 0,
          now,
          p.finishedAt,
        );
        return {
          name: p.name,
          position: 0,
          wpm: stats.wpm,
          accuracy: stats.accuracy,
          errors: stats.mistakes,
          elapsed: stats.elapsed,
          elapsedText: stats.elapsedText,
          progress: stats.progress,
          score: Math.max(0, Math.round(stats.wpm * 2.2 + stats.accuracy * 1.15 - stats.mistakes * 4 + stats.progress * 0.25)),
        };
      })
      .sort((a, b) => {
        if (b.progress >= 100 && a.progress >= 100) return a.elapsed - b.elapsed;
        return b.progress - a.progress;
      })
      .map((entry, i) => ({
        ...entry,
        position: i + 1,
      }));
  }

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/50">
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

  const myPlayer = room.players.find((p) => p.name === displayName);
  const myStats = myPlayer
    ? calculatePlayerStats(
        myPlayer.input,
        challenge.text,
        room.startedAt ?? 0,
        isFinished ? (room.finishedAt ?? Date.now()) : Date.now(),
        myPlayer.finishedAt,
      )
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-5 py-3 backdrop-blur">
          <div>
            <span className="text-sm font-bold text-(--accent)">Batalla #{roomCode}</span>
            {isMaster && (
              <span className="ml-2 text-xs text-amber-400">(Maestro)</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-white/40">{connectionState}</span>
            <span className={`h-2 w-2 rounded-full ${
              connectionState === "connected" ? "bg-emerald-400" :
              connectionState === "connecting" ? "bg-amber-400" : "bg-red-400"
            }`} />
          </div>
        </div>

        {/* Players list */}
        <div className="mb-4 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur">
          <h2 className="mb-2 text-sm font-semibold text-white/70">
            Jugadores ({room.players.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {room.players.map((p) => (
              <span
                key={p.id}
                className={`rounded-full px-3 py-1 text-xs ${
                  p.finished
                    ? "bg-emerald-500/20 text-emerald-300"
                    : p.connected
                      ? "bg-(--accent)/20 text-(--accent)"
                      : "bg-red-500/20 text-red-300 line-through"
                }`}
              >
                {p.name}
                {p.finished ? " ✓" : ""}
              </span>
            ))}
            {room.players.length === 0 && (
              <span className="text-xs text-white/30">Esperando jugadores...</span>
            )}
          </div>
        </div>

        {/* Master controls */}
        {isMaster && isLobby && (
          <div className="mb-4 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={room.selectedTextIndex}
                onChange={(e) => {
                  sendToServer({
                    type: "battle-set-text",
                    selectedTextIndex: Number(e.target.value),
                  });
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                {textCatalog.map((t, i) => (
                  <option key={t.id} value={i}>
                    {t.title} ({t.difficulty.label})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => sendToServer({ type: "battle-start-countdown" })}
                disabled={room.players.length === 0 || catalogLoading}
                className="rounded-lg bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Iniciar batalla
              </button>
            </div>
          </div>
        )}

        {/* Countdown */}
        {showCountdown && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center backdrop-blur">
            <span className="text-4xl font-bold text-amber-300">
              {room.countdownEndsAt
                ? Math.max(1, Math.ceil((room.countdownEndsAt - clockTick) / 1000))
                : "..."}
            </span>
            <p className="mt-1 text-sm text-amber-200/70">Preparate para escribir...</p>
          </div>
        )}

        {/* Challenge text */}
        {(isLive || isFinished) && (
          <div className="mb-4 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-white/50">{challenge.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                challenge.difficulty.tone === "emerald"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : challenge.difficulty.tone === "amber"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-rose-500/20 text-rose-300"
              }`}>
                {challenge.difficulty.label}
              </span>
            </div>
            <p
              ref={challengeTextRef}
              className="max-h-[28vh] overflow-y-auto text-lg leading-relaxed text-white/90 select-none scroll-smooth"
              style={{ wordBreak: "break-word", scrollBehavior: "smooth" }}
            >
              {challenge.text.split("").map((char, i) => {
                const isCorrect = myStats && i < myStats.correctCharacters;
                const isError = myStats && i < (myStats.typedCharacters) && i >= myStats.correctCharacters;
                const isCursor = myStats && i === (myStats.typedCharacters ?? 0);
                let color = "text-white/30";
                if (isCorrect) color = "text-emerald-400";
                else if (isError) color = "text-rose-400 bg-rose-500/30";
                else if (isCursor) color = "text-(--accent)";

                return (
                  <span
                    key={i}
                    className={color}
                    data-battle-cursor={isCursor ? "true" : undefined}
                  >
                    {char}
                  </span>
                );
              })}
            </p>
          </div>
        )}

        {/* Typing input */}
        {isLive && !isMaster && (
          <div className="mb-4">
            <textarea
              ref={typingInputRef}
              value={localInput}
              onChange={(e) => handleTypingChange(e.target.value)}
              disabled={myPlayer?.finished}
              placeholder={myPlayer?.finished ? "¡Terminaste! Esperá a los demás..." : "Escribí el texto aquí..."}
              className="w-full rounded-xl border border-(--accent)/30 bg-black/50 px-4 py-3 text-lg text-white placeholder-white/20 outline-none backdrop-blur resize-none"
              rows={2}
              autoFocus
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
            />
            {myStats && (
              <div className="mt-2 flex gap-4 text-xs text-white/50">
                <span>{myStats.correctCharacters}/{myStats.targetCharacters} car.</span>
                <span>{myStats.wpm} PPM</span>
                <span>{myStats.accuracy}% prec.</span>
                <span>{myStats.mistakes} errores</span>
              </div>
            )}
          </div>
        )}

        {isLive && isMaster && (
          <div className="mb-4 rounded-xl border border-(--accent)/20 bg-black/30 p-4 text-center backdrop-blur">
            <p className="text-sm text-white/50">Batalla en curso — observá el progreso abajo</p>
          </div>
        )}

        {/* Live progress */}
        {isLive && (
          <div className="mb-4 space-y-2">
            {room.players.map((p) => {
              const stats = calculatePlayerStats(
                p.input,
                challenge.text,
                room.startedAt ?? 0,
                Date.now(),
                p.finishedAt,
              );
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-white/5 bg-black/30 px-4 py-2 backdrop-blur"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-white/80">{p.name}</span>
                    <span className="text-xs text-white/40">
                      {p.finished ? `✓ ${formatClock(stats.elapsed)}` : `${stats.progress}%`}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        p.finished ? "bg-emerald-400" : "bg-(--accent)"
                      }`}
                      style={{ width: `${Math.min(100, stats.progress)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ranking */}
        {isFinished && ranking.length > 0 && (
          <div className="rounded-xl border border-(--accent)/20 bg-black/40 p-5 backdrop-blur">
            <h2 className="mb-4 text-center text-xl font-bold text-(--accent)">
              Clasificación Final
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Jugador</th>
                    <th className="px-3 py-2 text-right">PPM</th>
                    <th className="px-3 py-2 text-right">Prec.</th>
                    <th className="px-3 py-2 text-right">Errores</th>
                    <th className="px-3 py-2 text-right">Tiempo</th>
                    <th className="px-3 py-2 text-right">Puntaje</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((entry) => (
                    <tr
                      key={entry.name}
                      className={`border-b border-white/5 ${
                        entry.position === 1 ? "bg-amber-400/10" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-bold">
                        {entry.position === 1 && "🥇"}
                        {entry.position === 2 && "🥈"}
                        {entry.position === 3 && "🥉"}
                        {entry.position > 3 && entry.position}
                      </td>
                      <td className={`px-3 py-2 ${entry.position === 1 ? "font-bold text-amber-300" : "text-white/80"}`}>
                        {entry.name}
                      </td>
                      <td className="px-3 py-2 text-right text-white/70">{entry.wpm}</td>
                      <td className="px-3 py-2 text-right text-white/70">{entry.accuracy}%</td>
                      <td className="px-3 py-2 text-right text-white/70">{entry.errors}</td>
                      <td className="px-3 py-2 text-right text-white/70">{entry.elapsedText}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-(--accent)">
                        {entry.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isMaster && (
              <button
                type="button"
                onClick={() => sendToServer({ type: "battle-reset" })}
                className="mt-4 w-full rounded-xl bg-(--accent) px-4 py-3 font-semibold text-white transition hover:brightness-110"
              >
                Nueva batalla
              </button>
            )}
          </div>
        )}

        {/* Activity feed */}
        <div className="mt-4 rounded-xl border border-white/5 bg-black/30 p-3 backdrop-blur">
          <h3 className="mb-2 text-xs font-semibold text-white/30">Actividad</h3>
          <div className="space-y-1">
            {room.feed.slice(0, 8).map((msg, i) => (
              <p key={i} className="text-xs text-white/40">{msg}</p>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
