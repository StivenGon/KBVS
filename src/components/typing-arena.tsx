'use client';

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import flisolLogo from "../../images/addons/Flisol 2026 rectangular.png";
import auspicioDicosta from "../../images/auspicios/dicosta.png";
import auspicioKaaSoft from "../../images/auspicios/kaa soft.png";
import auspicioLaFortuna from "../../images/auspicios/la fortuna.png";
import auspicioSGCreaciones from "../../images/auspicios/sg creaciones.png";

import {
  calculatePlayerStats,
  createInitialRoomSnapshot,
  buildLeaderboard,
  formatClock,
  type ClientRole,
  type PlayerId,
  type RoomSnapshot,
  type SkillTier,
  updateRoomFeed,
} from "@/lib/typing-room";
import TextCatalogModal from "@/components/text-catalog-modal";
import { buildFallbackCatalog, type CatalogText } from "@/lib/text-catalog";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

const sponsorAssets = [
  { name: "Dicosta", image: auspicioDicosta },
  { name: "Kaa Soft", image: auspicioKaaSoft },
  { name: "La Fortuna", image: auspicioLaFortuna },
  { name: "SG Creaciones", image: auspicioSGCreaciones },
];

function resolveWebSocketUrl() {
  const envUrl = process.env.NEXT_PUBLIC_TYPING_WS_URL;

  if (envUrl) {
    return envUrl;
  }

  if (typeof window === "undefined") {
    return "ws://localhost:8787";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8787`;
}

export default function TypingArena({
  roomCode,
  initialRole,
  playerName,
}: {
  roomCode: string;
  initialRole: ClientRole;
  playerName?: string;
}) {
  const [room, setRoom] = useState(() => createInitialRoomSnapshot(roomCode));
  const clientRole = initialRole;
  const controlledPlayer: PlayerId = initialRole === "master" ? "A" : initialRole;
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [socketUrl] = useState(() => resolveWebSocketUrl());
  const [textCatalog, setTextCatalog] = useState<CatalogText[]>(() => buildFallbackCatalog());
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const typingInputRef = useRef<HTMLTextAreaElement | null>(null);
  const mountedRef = useRef(false);
  const playerMetricsRef = useRef<Array<{ label: string; value: string }>>([]);

  const activeCatalogIndex = Math.min(room.selectedTextIndex, Math.max(0, textCatalog.length - 1));
  const challengeMeta = textCatalog[activeCatalogIndex] ?? textCatalog[0];
  const challengeText = challengeMeta.text;
  const challengeDifficulty = challengeMeta.difficulty;
  const activePlayerId = clientRole === "master" ? controlledPlayer : clientRole;
  const otherPlayerId: PlayerId = activePlayerId === "A" ? "B" : "A";

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);

    try {
      const response = await fetch("/api/text-catalog", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("No se pudo cargar el catálogo de textos.");
      }

      const payload = (await response.json()) as { texts?: CatalogText[] };

      if (payload.texts?.length) {
        setTextCatalog(payload.texts);
      }
    } catch {
      setTextCatalog(buildFallbackCatalog());
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      if (!mountedRef.current) {
        return;
      }

      setConnectionState("connecting");
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionState("connected");
        sendMessage(socket, {
          type: "join-room",
          roomCode,
          role: clientRole,
          ...(playerName ? { name: playerName } : {}),
        });
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as
            | { type: "room-snapshot"; room: RoomSnapshot }
            | { type: "server-note"; message: string }
            | { type: "error"; message: string };

          if (payload.type === "room-snapshot") {
            setRoom(payload.room);
          }

          if (payload.type === "error") {
            setConnectionState("error");
            setRoom((current) => ({
              ...current,
              feed: updateRoomFeed(current.feed, `WebSocket: ${payload.message}`),
            }));
          }
        } catch {
          setConnectionState("error");
        }
      };

      socket.onerror = () => {
        setConnectionState("error");
      };

      socket.onclose = () => {
        if (!mountedRef.current) {
          return;
        }

        setConnectionState("disconnected");

        if (reconnectTimerRef.current !== null) {
          window.clearTimeout(reconnectTimerRef.current);
        }

        reconnectTimerRef.current = window.setTimeout(connect, 1500);
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
  }, [clientRole, playerName, roomCode, socketUrl]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (room.matchState !== "countdown" && room.matchState !== "live") {
      return;
    }

    const timer = window.setInterval(() => {
      setClockTick(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, [room.matchState, room.countdownEndsAt]);

  useEffect(() => {
    if (room.matchState !== "live" || clientRole !== activePlayerId) {
      return;
    }

    const timer = window.setTimeout(() => {
      typingInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activePlayerId, clientRole, room.matchState, room.players[activePlayerId].input]);

  const statsA = calculatePlayerStats(
    room.players.A.input,
    challengeText,
    room.startedAt,
    clockTick,
    room.finishedAt,
  );
  const statsB = calculatePlayerStats(
    room.players.B.input,
    challengeText,
    room.startedAt,
    clockTick,
    room.finishedAt,
  );
  const isMasterView = clientRole === "master";
  const activeStats = activePlayerId === "A" ? statsA : statsB;
  const otherStats = otherPlayerId === "A" ? statsA : statsB;
  const leaderboard = buildLeaderboard(room.history);
  const topLeaderboardEntry = leaderboard[0] ?? null;
  const playerMetrics = [
    { label: "Progreso", value: `${activeStats.progress}%` },
    { label: "Errores", value: String(activeStats.mistakes) },
    { label: "Precisión", value: `${activeStats.accuracy}%` },
    { label: "WPM", value: String(activeStats.wpm) },
  ];
  const masterPlayerViews = [
    { playerId: "A" as const, stats: statsA, accent: "emerald" as const },
    { playerId: "B" as const, stats: statsB, accent: "amber" as const },
  ];
  const canLaunch = room.players.A.ready && room.players.B.ready;
  const countdownRemaining =
    room.matchState === "countdown" && room.countdownEndsAt
      ? Math.max(0, Math.ceil((room.countdownEndsAt - clockTick) / 1000))
      : null;
  const roleLabel = isMasterView ? "Vista maestro" : `Vista jugador ${activePlayerId}`;
  const roleDescription = isMasterView
    ? "Control total de la sala, preparación de la ronda y seguimiento de ambos jugadores."
    : "Interfaz reducida para competir, escribir y vigilar sólo la información esencial de la partida.";
  const connectionLabel =
    connectionState === "connected"
      ? "Conectado"
      : connectionState === "connecting"
        ? "Conectando a la sala WebSocket"
        : connectionState === "error"
          ? "Conexión con error"
          : "Desconectado; intentando reconectar";

  useEffect(() => {
    playerMetricsRef.current = playerMetrics;
  }, [playerMetrics]);

  function send(message: Record<string, unknown>) {
    const socket = socketRef.current;

    if (socket?.readyState === WebSocket.OPEN) {
      sendMessage(socket, message);
    }
  }

  function updateRoom(nextRoom: RoomSnapshot) {
    setRoom(nextRoom);
  }

  function mutateRoom(mutator: (current: RoomSnapshot) => RoomSnapshot) {
    setRoom((current) => mutator(current));
  }

  function updatePlayerName(playerId: PlayerId, value: string) {
    mutateRoom((current) => ({
      ...current,
      players: {
        ...current.players,
        [playerId]: {
          ...current.players[playerId],
          name: value,
        },
      },
      updatedAt: Date.now(),
    }));

    send({
      type: "update-player",
      playerId,
      patch: { name: value },
    });
  }

  function toggleReady(playerId: PlayerId) {
    const nextReady = !room.players[playerId].ready;

    mutateRoom((current) => ({
      ...current,
      players: {
        ...current.players,
        [playerId]: {
          ...current.players[playerId],
          ready: nextReady,
        },
      },
      updatedAt: Date.now(),
    }));

    send({
      type: "update-player",
      playerId,
      patch: { ready: nextReady },
    });
  }

  function chooseText(selectedTextIndex: number) {
    if (room.matchState !== "lobby") {
      return;
    }

    const nextTextIndex = Math.max(0, Math.min(selectedTextIndex, textCatalog.length - 1));

    mutateRoom((current) => ({
      ...current,
      selectedTextIndex: nextTextIndex,
      updatedAt: Date.now(),
    }));

    setIsCatalogModalOpen(false);

    send({
      type: "set-text",
      selectedTextIndex: nextTextIndex,
    });
  }

  function startCountdown() {
    mutateRoom((current) => ({
      ...current,
      matchState: "countdown",
      countdownEndsAt: Date.now() + 3000,
      startedAt: null,
      finishedAt: null,
      players: {
        A: { ...current.players.A, input: "" },
        B: { ...current.players.B, input: "" },
      },
      updatedAt: Date.now(),
    }));

    send({ type: "start-countdown" });
  }

  function resetMatch() {
    setRoom((current) => ({
      ...current,
      matchState: "lobby",
      countdownEndsAt: null,
      startedAt: null,
      finishedAt: null,
      players: {
        A: { ...current.players.A, input: "", ready: false },
        B: { ...current.players.B, input: "", ready: false },
      },
      updatedAt: Date.now(),
    }));

    send({ type: "reset-match" });
  }

  function handleTypingChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (room.matchState !== "live" || (clientRole !== "master" && clientRole !== activePlayerId)) {
      return;
    }

    const nextValue = event.target.value.slice(0, challengeText.length);

    mutateRoom((current) => ({
      ...current,
      players: {
        ...current.players,
        [activePlayerId]: {
          ...current.players[activePlayerId],
          input: nextValue,
        },
      },
      updatedAt: Date.now(),
    }));

    send({
      type: "typing",
      playerId: activePlayerId,
      input: nextValue,
    });

    window.requestAnimationFrame(() => {
      typingInputRef.current?.focus();
    });
  }

  function renderChallengeText(playerId: PlayerId, accent?: "emerald" | "amber") {
    const playerInput = room.players[playerId].input;

    return (
      <p className="whitespace-pre-wrap wrap-anywhere font-mono text-base leading-8 text-slate-900 sm:text-[17px] sm:leading-9">
        {challengeText.split("").map((character, index) => {
          const typedCharacter = playerInput[index];
          const baseClass = "transition-all duration-150";

          if (index < playerInput.length) {
            return (
              <span
                key={`${playerId}-${character}-${index}`}
                className={
                  typedCharacter === character
                    ? `${baseClass} rounded-[0.2rem] bg-emerald-100 px-0.5 font-semibold text-emerald-950 ring-1 ring-emerald-200/80`
                    : `${baseClass} rounded-[0.2rem] bg-rose-100 px-0.5 font-semibold text-rose-950 ring-1 ring-rose-200/80`
                }
              >
                {character === " " ? "\u00A0" : character}
              </span>
            );
          }

          if (index === playerInput.length) {
            return (
              <span
                key={`${playerId}-${character}-${index}`}
                className={`${baseClass} rounded-sm ${accent === "amber" ? "bg-amber-200 text-amber-950 ring-1 ring-amber-300/70" : "bg-emerald-200 text-emerald-950 ring-1 ring-emerald-300/70"}`}
              >
                {character === " " ? "\u00A0" : character}
              </span>
            );
          }

          return (
            <span key={`${playerId}-${character}-${index}`} className={`${baseClass} text-slate-700`}>
              {character === " " ? "\u00A0" : character}
            </span>
          );
        })}
      </p>
    );
  }

  const liveLabel =
    room.matchState === "finished"
      ? "Partida terminada"
      : room.matchState === "countdown"
        ? "Cuenta regresiva activa"
        : room.matchState === "live"
          ? "Partida en vivo"
          : "Lobby abierto";

  const elapsedText = room.startedAt ? formatClock((room.finishedAt ?? clockTick) - room.startedAt) : "00:00.00";

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden py-0 text-slate-900 sm:gap-2.5">
      {room.matchState === "countdown" ? (
        <div className="countdown-overlay pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[28px] border border-amber-200/20 bg-slate-950/80 px-6 py-10 backdrop-blur-lg">
          <div className="relative flex w-full max-w-2xl flex-col items-center gap-4 rounded-4xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),rgba(2,6,23,0.78)_70%)] px-6 py-10 text-center shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
            <p className="text-xs uppercase tracking-[0.45em] text-amber-100/80">Sale la ronda</p>
            <div className="countdown-ring flex h-36 w-36 items-center justify-center rounded-full border border-amber-200/30 bg-white/5 shadow-[0_0_0_20px_rgba(251,191,36,0.08)] sm:h-44 sm:w-44">
              <span key={countdownRemaining ?? 0} className="countdown-number text-7xl font-semibold leading-none text-white sm:text-8xl">
                {countdownRemaining ?? 0}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-white/82 px-3 py-2.5 shadow-[0_20px_60px_rgba(1,8,18,0.12)] backdrop-blur-xl sm:px-4 sm:py-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-700">{roleLabel}</p>
          <div className="flex flex-wrap gap-2 text-sm text-slate-800">
            <span>{room.roomCode}</span>
            <span>{connectionLabel}</span>
            <span>{challengeMeta.title}</span>
            <span
              className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.22em] ${
                challengeDifficulty.tone === "emerald"
                  ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-700"
                  : challengeDifficulty.tone === "amber"
                    ? "border-amber-300/20 bg-amber-300/10 text-amber-700"
                    : "border-rose-300/20 bg-rose-300/10 text-rose-700"
              }`}
            >
              {challengeDifficulty.label}
            </span>
          </div>
        </div>

        {isMasterView ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsCatalogModalOpen(true)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Elegir texto (listado)
            </button>
            <button
              type="button"
              onClick={startCountdown}
              className="rounded-full border border-(--accent-strong)/20 bg-(--accent-strong)/10 px-3 py-2 text-sm font-medium text-(--accent-strong) transition hover:bg-(--accent-strong)/15"
            >
              Empezar
            </button>
            <button
              type="button"
              onClick={resetMatch}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Reset
            </button>
            <Link
              href={`/clasificacion?room=${encodeURIComponent(room.roomCode)}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Ver clasificación
            </Link>
          </div>
        ) : (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Espera el inicio</span>
        )}
      </header>

      <div className="grid min-h-0 flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(250px,320px)] lg:grid-cols-[minmax(0,2.15fr)_minmax(290px,0.85fr)] xl:grid-cols-[minmax(0,2.35fr)_minmax(320px,0.75fr)] xl:gap-3">
        <section className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white/80 p-2 shadow-[0_20px_60px_rgba(1,8,18,0.12)] backdrop-blur-xl sm:p-3 lg:p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-700">Texto activo</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl xl:text-2xl">{challengeMeta.title}</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-500">
                Dificultad {challengeDifficulty.label}
              </p>
            </div>
          </div>

          <div className="mt-2 flex min-h-0 flex-1 flex-col space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-2 leading-7 text-slate-700 sm:mt-3 sm:space-y-2.5 sm:p-3 lg:p-3.5 xl:p-4">
            {isMasterView ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[linear-gradient(180deg,rgba(17,79,183,0.06),rgba(255,138,31,0.04))] px-3 py-2.5 lg:px-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.34em] text-slate-700">Comparación en vivo</p>
                    <p className="mt-1 text-xs text-slate-800 sm:text-sm">Seguimiento paralelo de ambos jugadores.</p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-700">
                    <span className="rounded-full border border-(--accent-strong)/20 bg-(--accent-strong)/10 px-2.5 py-1 text-(--accent-strong)">A</span>
                    <span className="rounded-full border border-(--accent)/20 bg-(--accent)/10 px-2.5 py-1 text-(--accent)">VS</span>
                    <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-sky-700">B</span>
                  </div>
                </div>

                <div className="grid flex-1 gap-px bg-slate-200 md:grid-cols-2">
                {masterPlayerViews.map(({ playerId, stats, accent }) => (
                  <div key={playerId} className="flex min-h-0 flex-col bg-white p-2.5 sm:p-3 xl:p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.34em] text-slate-700">Jugador {playerId}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-950">{room.players[playerId].name}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-slate-700 xl:text-xs">
                          {stats.progress}% avance · {stats.wpm} WPM
                        </p>
                      </div>
                      <div
                        className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${
                          accent === "emerald"

                            ? "border-(--accent-strong)/20 bg-(--accent-strong)/10 text-(--accent-strong)"
                            : "border-(--accent)/20 bg-(--accent)/10 text-(--accent)"
                        }`}
                      >
                        {stats.textProgressLabel}
                      </div>
                    </div>

                    <div className="mt-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 xl:p-3">
                      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.24em] text-slate-700">
                        <span>Editor en vivo</span>
                        <span>{room.players[playerId].input.length}/{challengeText.length}</span>
                      </div>
                      <div className="min-h-24 max-h-44 overflow-auto pr-1 sm:min-h-28 sm:max-h-56 xl:min-h-32 xl:max-h-64">
                        {renderChallengeText(playerId, accent)}
                      </div>
                    </div>

                    <div className="mt-2.5 grid gap-1.5 sm:grid-cols-3">
                      <InfoTile label="Tiempo" value={stats.elapsedText} />
                      <InfoTile label="Precisión" value={`${stats.accuracy}%`} />
                      <InfoTile label="Errores" value={String(stats.mistakes)} />
                    </div>
                  </div>
                ))}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-3 sm:p-3.5 xl:p-4">
                <div className="mb-2.5 flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-slate-700 sm:text-xs">
                  <span>Editor activo</span>
                  <span>
                    Jugador {activePlayerId} · {activeStats.progress}% · {activeStats.wpm} WPM
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden wrap-anywhere">
                  {renderChallengeText(activePlayerId)}
                </div>
              </div>
            )}
          </div>

          {isMasterView ? null : (
            <div className="mt-2.5 flex min-h-0 flex-1 flex-col">
              <textarea
                ref={typingInputRef}
                value={room.players[activePlayerId].input}
                onChange={handleTypingChange}
                disabled={room.matchState !== "live" || clientRole !== activePlayerId}
                onBlur={() => {
                  if (room.matchState === "live" && clientRole === activePlayerId) {
                    window.setTimeout(() => typingInputRef.current?.focus(), 0);
                  }
                }}
                rows={4}
                placeholder={room.matchState === "countdown" ? "Espera el inicio..." : "Escribe aquí"}
                className="min-h-28 w-full flex-1 rounded-3xl border border-white/10 bg-slate-950/55 p-2.5 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-not-allowed disabled:opacity-70 sm:p-3 sm:text-base sm:leading-7"
              />
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-2 rounded-3xl border border-slate-200 bg-white/80 p-2.5 shadow-[0_20px_60px_rgba(1,8,18,0.12)] backdrop-blur-xl lg:sticky lg:top-3 lg:h-fit lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-auto lg:p-3 xl:gap-2.5 xl:p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-700">Sala</p>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-700">
              Vista compacta
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <MasterPlayerCard
              name={room.players.A.name}
              role="A"
              connected={room.players.A.connected}
              progress={statsA.progress}
              accent="emerald"
              stats={`${statsA.wpm} WPM`}
              time={statsA.elapsedText}
              accuracy={statsA.accuracy}
              textProgressLabel={statsA.textProgressLabel}
              typedCharacters={statsA.typedCharacters}
              targetCharacters={statsA.targetCharacters}
            />
            <MasterPlayerCard
              name={room.players.B.name}
              role="B"
              connected={room.players.B.connected}
              progress={statsB.progress}
              accent="amber"
              stats={`${statsB.wpm} WPM`}
              time={statsB.elapsedText}
              accuracy={statsB.accuracy}
              textProgressLabel={statsB.textProgressLabel}
              typedCharacters={statsB.typedCharacters}
              targetCharacters={statsB.targetCharacters}
            />
          </div>

          <SponsorCarousel />
          {isMasterView && leaderboard.length > 0 ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_20px_60px_rgba(1,8,18,0.12)] sm:p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.34em] text-slate-700">Clasificación general</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-950">Ranking de destreza</h3>
                </div>
                {topLeaderboardEntry ? (
                  <span className="rounded-full border border-(--accent-strong)/20 bg-(--accent-strong)/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-(--accent-strong)">
                    Líder: {topLeaderboardEntry.name}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {leaderboard.length ? (
                  <div className="max-h-80 overflow-auto">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-[11px] sm:text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Jugador</th>
                          <th className="px-3 py-2 font-medium">Nivel</th>
                          <th className="px-3 py-2 font-medium">Puntos</th>
                          <th className="px-3 py-2 font-medium">Victorias</th>
                          <th className="px-3 py-2 font-medium">WPM</th>
                          <th className="px-3 py-2 font-medium">Precisión</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((entry, index) => {
                          const isTopEntry = index === 0;

                          return (
                            <tr
                              key={entry.name}
                              className={isTopEntry ? "bg-(--accent-strong)/5 text-slate-950" : "border-t border-slate-200"}
                            >
                              <td className="px-3 py-2 align-middle font-semibold text-slate-700">{index + 1}</td>
                              <td className="px-3 py-2 align-middle">
                                <div className="flex items-center gap-2">
                                  <span className="max-w-28 truncate font-medium text-slate-950">{entry.name}</span>
                                  {isTopEntry ? (
                                    <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-700">
                                      Mejor
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-middle">
                                <SkillBadge tier={entry.skillTier} />
                              </td>
                              <td className="px-3 py-2 align-middle font-semibold text-slate-900">{entry.skillScore}</td>
                              <td className="px-3 py-2 align-middle text-slate-700">
                                {entry.wins}/{entry.matches}
                              </td>
                              <td className="px-3 py-2 align-middle text-slate-700">{entry.averageWpm}</td>
                              <td className="px-3 py-2 align-middle text-slate-700">{entry.averageAccuracy}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-3 py-5 text-sm text-slate-600">Todavía no hay partidas registradas.</div>
                )}
              </div>
            </section>
          ) : null}
          <FlisolBanner />
        </aside>
      </div>

      <TextCatalogModal
        open={isCatalogModalOpen}
        texts={textCatalog}
        selectedIndex={activeCatalogIndex}
        onSelect={chooseText}
        onClose={() => setIsCatalogModalOpen(false)}
        loading={catalogLoading}
        canManage={isMasterView}
        onCatalogRefresh={refreshCatalog}
      />
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "rose" | "emerald" | "sky";
}) {
  const toneStyles = {
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    sky: "border-sky-300/20 bg-sky-300/10 text-sky-100",
  }[tone];

  return (
    <div className={`w-full rounded-2xl border p-2 ${toneStyles}`}>
      <p className="text-[9px] uppercase tracking-[0.24em] opacity-80">{label}</p>
      <p className="mt-1 text-[1.05rem] font-semibold leading-none sm:mt-1.5 sm:text-[1.25rem]">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-3.5">
      <p className="text-[10px] uppercase tracking-[0.32em] text-slate-700">{label}</p>
      <p className="mt-2 wrap-break-word text-sm font-semibold leading-5 text-slate-950 sm:text-base">{value}</p>
    </div>
  );
}

function SkillBadge({ tier }: { tier: SkillTier }) {
  const toneClasses: Record<SkillTier, string> = {
    novato: "border-slate-300 bg-slate-100 text-slate-700",
    aprendiz: "border-amber-300/30 bg-amber-300/10 text-amber-700",
    competente: "border-emerald-300/30 bg-emerald-300/10 text-emerald-700",
    experto: "border-sky-300/30 bg-sky-300/10 text-sky-700",
    maestro: "border-(--accent-strong)/20 bg-(--accent-strong)/10 text-(--accent-strong)",
    leyenda: "border-rose-300/30 bg-rose-300/10 text-rose-700",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] ${toneClasses[tier]}`}>
      {tier}
    </span>
  );
}

function PlayerSetupCard({
  playerId,
  name,
  ready,
  connected,
  color,
  onNameChange,
  onToggleReady,
  canEdit,
  isControlled,
  onControl,
}: {
  playerId: PlayerId;
  name: string;
  ready: boolean;
  connected: boolean;
  color: "emerald" | "amber";
  onNameChange: (value: string) => void;
  onToggleReady: () => void;
  canEdit: boolean;
  isControlled: boolean;
  onControl: () => void;
}) {
  const badgeStyles =
    color === "emerald"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
      : "border-amber-300/20 bg-amber-300/10 text-amber-100";

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.25em] ${badgeStyles}`}>
          Jugador {playerId}
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
          {connected ? "Conectado" : "Demo local"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Nombre</span>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            disabled={!canEdit}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition placeholder:text-slate-500 focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <button
          type="button"
          onClick={onToggleReady}
          disabled={!canEdit}
          className={`w-full rounded-2xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${ready ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
        >
          {ready ? "Listo para competir" : "Marcar como listo"}
        </button>

        <button
          type="button"
          onClick={onControl}
          disabled={!canEdit}
          className={`w-full rounded-2xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${isControlled ? "border-white/30 bg-white text-slate-950" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
        >
          {isControlled ? "Control activo" : "Tomar control"}
        </button>
      </div>
    </div>
  );
}

function MasterPlayerCard({
  name,
  role,
  connected,
  progress,
  accent,
  stats,
  time,
  accuracy,
  textProgressLabel,
  typedCharacters,
  targetCharacters,
}: {
  name: string;
  role: string;
  connected: boolean;
  progress: number;
  accent: "emerald" | "amber";
  stats: string;
  time: string;
  accuracy: number;
  textProgressLabel: string;
  typedCharacters: number;
  targetCharacters: number;
}) {
  const accentStyles =
    accent === "emerald"
      ? "from-emerald-300 to-cyan-300"
      : "from-amber-300 to-orange-300";
  const displayName = name.trim() ? name : "";

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-3.5 shadow-[0_20px_50px_rgba(1,8,18,0.08)] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-slate-950 whitespace-normal wrap-break-word">{displayName || `Jugador ${role}`}</p>
        </div>
        <span
          className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${connected ? "bg-emerald-500 ring-2 ring-emerald-100" : "bg-slate-300 ring-2 ring-slate-100"}`}
          aria-label={connected ? "En línea" : "Sin conexión"}
          title={connected ? "En línea" : "Sin conexión"}
        />
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-linear-to-r ${accentStyles} transition-[width] duration-300`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] leading-5 text-slate-700 sm:text-[0.76rem]">
        <span className="font-medium text-slate-600">Avance</span>
        <span className="font-semibold text-slate-950">{progress}%</span>
        <span className="text-slate-300">•</span>
        <span className="font-medium text-slate-600">Tiempo</span>
        <span className="font-semibold text-slate-950">{time}</span>
        <span className="text-slate-300">•</span>
        <span className="font-medium text-slate-600">WPM</span>
        <span className="font-semibold text-slate-950">{stats.replace(/ WPM$/u, "")}</span>
      </div>
    </div>
  );
}

function sendMessage(socket: WebSocket, message: Record<string, unknown>) {
  socket.send(JSON.stringify(message));
}

function SponsorCarousel() {
  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] sm:p-4">
      <div className="sponsor-marquee flex w-max items-center gap-4 pr-4 sm:gap-5 lg:gap-6">
        {[...sponsorAssets, ...sponsorAssets].map((sponsor, index) => (
          <div
            key={`${sponsor.name}-${index}`}
            className="flex h-28 w-48 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white px-4 py-3 sm:h-32 sm:w-56 lg:h-36 lg:w-64"
          >
            <Image
              src={sponsor.image}
              alt={sponsor.name}
              width={360}
              height={220}
              loading={index === 0 ? "eager" : "lazy"}
              priority={index === 0}
              className="h-20 w-auto object-contain sm:h-24 lg:h-28"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FlisolBanner() {
  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] sm:p-4">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-[0_12px_30px_rgba(15,34,64,0.08)]">
        <Image src={flisolLogo} alt="FLISOL 2026" className="h-auto w-full" priority />
      </div>
    </div>
  );
}