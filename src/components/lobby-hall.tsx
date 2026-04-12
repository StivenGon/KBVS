'use client';

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import {
  createInitialRoomSnapshot,
  createRoomCode,
  challengeTexts,
  getChallengeDifficulty,
  normalizePlayerName,
  type ClientRole,
  type PlayerId,
  type RoomSnapshot,
  updateRoomFeed,
} from "@/lib/typing-room";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

const defaultWsUrl = process.env.NEXT_PUBLIC_TYPING_WS_URL ?? "ws://localhost:8787";

export default function LobbyHall() {
  const [roomCode, setRoomCode] = useState(() => createRoomCode());
  const [nickname, setNickname] = useState("Anfitrión");
  const [room, setRoom] = useState(() => createInitialRoomSnapshot(roomCode));
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [now, setNow] = useState(() => Date.now());
  const [socketUrl] = useState(defaultWsUrl);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  const encodedRoom = encodeURIComponent(roomCode);
  const masterHref = `/master?room=${encodedRoom}`;
  const playerAHref = `/player/A?room=${encodedRoom}`;
  const playerBHref = `/player/B?room=${encodedRoom}`;
  const masterReady = room.players.A.ready && room.players.B.ready;
  const activeChallenge = challengeTexts[room.selectedTextIndex];
  const activeDifficulty = getChallengeDifficulty(activeChallenge);

  useEffect(() => {
    setRoom(createInitialRoomSnapshot(roomCode));
  }, [roomCode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
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
          role: "master" satisfies ClientRole,
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
  }, [roomCode, socketUrl]);

  function send(message: Record<string, unknown>) {
    const socket = socketRef.current;

    if (socket?.readyState === WebSocket.OPEN) {
      sendMessage(socket, message);
    }
  }

  function regenerateRoom() {
    const nextRoomCode = createRoomCode();
    setRoomCode(nextRoomCode);
    setRoom(createInitialRoomSnapshot(nextRoomCode));

    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      sendMessage(socket, {
        type: "join-room",
        roomCode: nextRoomCode,
        role: "master" satisfies ClientRole,
      });
    }
  }

  function copyRoomCode() {
    void navigator.clipboard.writeText(roomCode).catch(() => {
      // Clipboard access is optional for the demo.
    });
  }

  function chooseChallenge(selectedTextIndex: number) {
    if (room.matchState !== "lobby") {
      return;
    }

    setRoom((current) => ({
      ...current,
      selectedTextIndex,
      updatedAt: Date.now(),
    }));

    send({
      type: "set-text",
      selectedTextIndex,
    });
  }

  function updatePlayerName(playerId: PlayerId, value: string) {
    const nextName = normalizePlayerName(value, room.players[playerId].name);

    setRoom((current) => ({
      ...current,
      players: {
        ...current.players,
        [playerId]: {
          ...current.players[playerId],
          name: nextName,
        },
      },
      updatedAt: Date.now(),
    }));

    send({
      type: "update-player",
      playerId,
      patch: { name: nextName },
    });
  }

  function toggleReady(playerId: PlayerId) {
    const nextReady = !room.players[playerId].ready;

    setRoom((current) => ({
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

  function startMatch() {
    if (!masterReady) {
      setRoom((current) => ({
        ...current,
        feed: updateRoomFeed(current.feed, "Ambos jugadores deben marcarse como listos para comenzar."),
      }));

      return;
    }

    setRoom((current) => ({
      ...current,
      matchState: "countdown",
      countdownEndsAt: Date.now() + 3000,
      feed: updateRoomFeed(current.feed, `Cuenta regresiva iniciada con "${activeChallenge.title}".`),
    }));

    send({ type: "start-countdown" });
  }

  const connectionLabel =
    connectionState === "connected"
      ? `Conectado a ${socketUrl}`
      : connectionState === "connecting"
        ? "Conectando al relay WebSocket"
        : connectionState === "error"
          ? "Conexión con error"
          : "Desconectado; intentando reconectar";

  return (
    <section className="grid flex-1 gap-6 rounded-4xl border border-white/10 bg-(--surface) p-6 shadow-[0_30px_100px_rgba(1,8,18,0.45)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3 text-sm text-slate-300/80">
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-emerald-200">
            Lobby previo
          </span>
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-amber-100">
            {connectionLabel}
          </span>
          <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-sky-100">
            Antes de la carrera
          </span>
        </div>

        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-400">KBVS / Lobby</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Prepara la sala, comparte el código y entra a la carrera.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-300">
            Esta es la pantalla previa: crea o cambia la sala, marca la preparación de ambos jugadores y abre las
            vistas de maestro y jugador con el mismo identificador.
          </p>
        </div>

        <div className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/35 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Sala activa</p>
              <p className="mt-2 text-3xl font-semibold text-white">{roomCode}</p>
            </div>
            <button
              type="button"
              onClick={regenerateRoom}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Nueva sala
            </button>
          </div>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Nombre del anfitrión</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition placeholder:text-slate-500 focus:border-white/30"
            />
          </label>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Texto de la partida</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{activeChallenge.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Antes de iniciar, elige el texto cargado desde la base de datos simulada para esta sala.
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] ${
                  activeDifficulty.tone === "emerald"
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                    : activeDifficulty.tone === "amber"
                      ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                      : "border-rose-300/30 bg-rose-300/10 text-rose-100"
                }`}
              >
                Dificultad {activeDifficulty.label}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {challengeTexts.map((challenge, index) => {
                const difficulty = getChallengeDifficulty(challenge);
                const selected = index === room.selectedTextIndex;

                return (
                  <button
                    key={challenge.id}
                    type="button"
                    onClick={() => chooseChallenge(index)}
                    disabled={room.matchState !== "lobby"}
                    className={`rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? difficulty.tone === "emerald"
                          ? "border-emerald-300/40 bg-emerald-300/15"
                          : difficulty.tone === "amber"
                            ? "border-amber-300/40 bg-amber-300/15"
                            : "border-rose-300/40 bg-rose-300/15"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{challenge.title}</p>
                      <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-white">
                        {difficulty.label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      {challenge.text}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <LobbyPlayerCard
              label="Jugador A"
              name={room.players.A.name}
              ready={room.players.A.ready}
              connected={room.players.A.connected}
              onNameChange={(value) => updatePlayerName("A", value)}
              onToggleReady={() => toggleReady("A")}
            />
            <LobbyPlayerCard
              label="Jugador B"
              name={room.players.B.name}
              ready={room.players.B.ready}
              connected={room.players.B.connected}
              onNameChange={(value) => updatePlayerName("B", value)}
              onToggleReady={() => toggleReady("B")}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copyRoomCode}
              className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Copiar código
            </button>
            <Link
              href={masterHref}
              className={`rounded-full border px-5 py-3 text-sm font-medium transition ${masterReady ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/25" : "border-white/15 bg-white/5 text-white hover:bg-white/10"}`}
            >
              Entrar como maestro
            </Link>
            <button
              type="button"
              onClick={startMatch}
              disabled={!masterReady || room.matchState === "countdown"}
              className="rounded-full border border-amber-300/30 bg-amber-300/15 px-5 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {room.matchState === "countdown" ? "Cuenta regresiva en curso" : "Iniciar cuenta regresiva"}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-amber-300/20 bg-amber-300/10 p-5 text-center shadow-[0_20px_60px_rgba(18,12,2,0.2)]">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-100/80">Cuenta regresiva</p>
          <p className="mt-3 text-7xl font-semibold leading-none text-amber-100 sm:text-8xl">
            {room.matchState === "countdown" && room.countdownEndsAt
              ? Math.max(0, Math.ceil((room.countdownEndsAt - now) / 1000))
              : "3"}
          </p>
          <p className="mt-3 text-sm text-amber-50/90">
            {room.matchState === "countdown"
              ? room.countdownEndsAt && room.countdownEndsAt - now <= 1000
                ? "La ronda está por comenzar."
                : "La ronda comienza en breve."
              : masterReady
                ? "Pulsa iniciar para preparar el arranque de la ronda."
                : "Espera a que ambos jugadores se marquen como listos."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/35 p-5 text-slate-300">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Acceso a la carrera</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Abrir la misma sala</h2>
        </div>

        <div className="grid gap-3">
          <AccessCard href={playerAHref} label="Jugador A" description="Plaza izquierda. Usa esta vista para competir." />
          <AccessCard href={playerBHref} label="Jugador B" description="Plaza derecha. Comparte el mismo código de sala." />
          <AccessCard href={masterHref} label="Maestro" description="Observa la partida y controla la ronda desde arriba." />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Estado de la sala</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <InfoTile label="Listo A" value={room.players.A.ready ? "Sí" : "No"} />
            <InfoTile label="Listo B" value={room.players.B.ready ? "Sí" : "No"} />
            <InfoTile label="Conectado A" value={room.players.A.connected ? "Sí" : "No"} />
            <InfoTile label="Conectado B" value={room.players.B.connected ? "Sí" : "No"} />
            <InfoTile label="Texto" value={activeChallenge.title} />
            <InfoTile label="Dificultad" value={activeDifficulty.label} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Checklist</p>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <li>1. Comparte el código {roomCode} con quienes van a entrar.</li>
            <li>2. Elige el texto y revisa la dificultad antes de iniciar.</li>
            <li>3. Marca listos a los dos jugadores desde el lobby.</li>
            <li>4. Abre el maestro y los dos jugadores en pestañas separadas.</li>
          </ol>
        </div>

        <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/30 p-4 text-sm text-slate-300">
          Anfitrión actual: {nickname}. Esta pantalla es el paso previo al duelo, antes de entrar a la carrera.
          {masterReady ? " La sala ya está lista para avanzar." : " Falta completar la preparación."}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Registro vivo</p>
          <div className="mt-4 space-y-2">
            {room.feed.slice(0, 3).map((item) => (
              <div key={item} className="rounded-2xl bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LobbyPlayerCard({
  label,
  name,
  ready,
  connected,
  onNameChange,
  onToggleReady,
}: {
  label: string;
  name: string;
  ready: boolean;
  connected: boolean;
  onNameChange: (value: string) => void;
  onToggleReady: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white">
          {label}
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
          {connected ? "Conectado" : "Demo local"}
        </span>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Nombre</span>
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition placeholder:text-slate-500 focus:border-white/30"
        />
      </label>

      <button
        type="button"
        onClick={onToggleReady}
        className={`mt-3 w-full rounded-2xl border px-3 py-2 text-sm font-medium transition ${ready ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
      >
        {ready ? "Listo para competir" : "Marcar como listo"}
      </button>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function AccessCard({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link href={href} className="rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
      <p className="text-base font-semibold text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </Link>
  );
}

function sendMessage(socket: WebSocket, message: Record<string, unknown>) {
  socket.send(JSON.stringify(message));
}