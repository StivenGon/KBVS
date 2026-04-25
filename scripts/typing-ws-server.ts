import { WebSocket, WebSocketServer } from "ws";

import {
  calculatePlayerStats,
  createCompletionEntry,
  createInitialRoomSnapshot,
  normalizePlayerName,
  updateRoomFeed,
  winnerFromSnapshot,
  type ClientRole,
  type PlayerId,
  type RoomSnapshot,
} from "../src/lib/typing-room";
import { getCachedTextCatalog, loadTextCatalog } from "../src/lib/text-catalog-service";

type ClientMessage =
  | {
      type: "join-room";
      roomCode: string;
      role: ClientRole;
      name?: string;
    }
  | {
      type: "update-player";
      playerId: PlayerId;
      patch: {
        name?: string;
        ready?: boolean;
      };
    }
  | {
      type: "set-text";
      selectedTextIndex: number;
    }
  | {
      type: "start-countdown";
    }
  | {
      type: "reset-match";
    }
  | {
      type: "typing";
      playerId: PlayerId;
      input: string;
      typingVersion?: number;
    }
  | {
      type: "leave-room";
    };

type ServerMessage =
  | {
      type: "room-snapshot";
      room: RoomSnapshot;
    }
  | {
      type: "typing-update";
      roomCode: string;
      playerId: PlayerId;
      input: string;
      typingVersion: number;
      updatedAt: number;
    }
  | {
      type: "server-note";
      message: string;
    }
  | {
      type: "error";
      message: string;
    };

type RoomClient = {
  socket: import("ws").WebSocket;
  roomCode: string | null;
  role: ClientRole | null;
};

type StartupError = NodeJS.ErrnoException;

const port = Number(process.env.TYPING_WS_PORT ?? 8787);
const host = process.env.TYPING_WS_HOST ?? "0.0.0.0";
const rooms = new Map<string, RoomSnapshot>();
const clients = new Set<RoomClient>();
let activeCatalog = getCachedTextCatalog();

void loadTextCatalog({ forceRefresh: true }).then((catalog) => {
  activeCatalog = catalog;
});

const catalogRefreshInterval = setInterval(() => {
  void loadTextCatalog({ forceRefresh: true }).then((catalog) => {
    activeCatalog = catalog;
  });
}, 60_000);

const wss = new WebSocketServer({ host, port });
let serverListening = false;
let duplicateRelayKeepAliveInterval: NodeJS.Timeout | null = null;

wss.on("listening", () => {
  serverListening = true;
  console.log(`[typing-ws] listening on ws://${host}:${port}`);
});

wss.on("error", (error) => {
  void handleServerError(error as StartupError, serverListening);
});

wss.on("connection", (socket) => {
  const transport = socket as WebSocket & {
    _socket?: {
      setNoDelay?: (noDelay?: boolean) => void;
    };
  };

  transport._socket?.setNoDelay?.(true);

  const client: RoomClient = {
    socket,
    roomCode: null,
    role: null,
  };

  clients.add(client);

  socket.on("message", (rawMessage) => {
    let message: ClientMessage;

    try {
      message = JSON.parse(rawMessage.toString("utf8")) as ClientMessage;
    } catch {
      send(socket, {
        type: "error",
        message: "Mensaje inválido: no se pudo interpretar como JSON.",
      });

      return;
    }

    if (message.type === "join-room") {
      joinRoom(client, message.roomCode, message.role, message.name);
      return;
    }

    if (!client.roomCode || !rooms.has(client.roomCode)) {
      send(socket, {
        type: "error",
        message: "Primero debes unirte a una sala.",
      });

      return;
    }

    const room = rooms.get(client.roomCode)!;

    let shouldPublishRoom = true;

    switch (message.type) {
      case "update-player": {
        const nextName =
          message.patch.name === undefined
            ? room.players[message.playerId].name
            : normalizePlayerName(message.patch.name, "");

        const nextPlayers = {
          ...room.players,
          [message.playerId]: {
            ...room.players[message.playerId],
            ...message.patch,
            name: nextName,
          },
        };

        room.players = nextPlayers;
        room.feed = updateRoomFeed(room.feed, `${nextPlayers[message.playerId].name} actualizó su ficha.`);
        room.updatedAt = Date.now();
        break;
      }
      case "set-text": {
        if (room.matchState !== "lobby") {
          send(socket, {
            type: "error",
            message: "El texto solo puede cambiarse antes de comenzar la partida.",
          });

          shouldPublishRoom = false;

          break;
        }

        const maxIndex = Math.max(0, activeCatalog.length - 1);
        room.selectedTextIndex = Math.max(0, Math.min(maxIndex, message.selectedTextIndex));
        const challenge = activeCatalog[room.selectedTextIndex] ?? activeCatalog[0];
        room.feed = updateRoomFeed(room.feed, `Se cargó "${challenge.title}" (${challenge.difficulty.label}).`);
        room.updatedAt = Date.now();
        break;
      }
      case "start-countdown": {
        startCountdown(room);
        break;
      }
      case "reset-match": {
        resetMatch(room);
        break;
      }
      case "typing": {
        if (room.matchState !== "live") {
          shouldPublishRoom = false;
          break;
        }

        const previousMatchState = room.matchState;
        const previousFinishedAt = room.finishedAt;
        const challenge = activeCatalog[room.selectedTextIndex]?.text ?? activeCatalog[0]?.text ?? "";
        const currentPlayer = room.players[message.playerId];
        const incomingVersion =
          typeof message.typingVersion === "number"
            ? Math.max(0, Math.floor(message.typingVersion))
            : currentPlayer.typingVersion + 1;

        if (incomingVersion < currentPlayer.typingVersion) {
          shouldPublishRoom = false;
          break;
        }

        const normalizedInput = message.input.slice(0, challenge.length);

        room.players[message.playerId] = {
          ...currentPlayer,
          input: normalizedInput,
          typingVersion: incomingVersion,
        };

        maybeFinishMatch(room);

        room.updatedAt = Date.now();

        if (room.matchState !== previousMatchState || room.finishedAt !== previousFinishedAt) {
          publishRoom(room);
          shouldPublishRoom = false;
          break;
        }

        publishTypingUpdate(room, message.playerId);
        shouldPublishRoom = false;
        break;
      }
      case "leave-room": {
        leaveRoom(client);
        return;
      }
    }

    if (shouldPublishRoom) {
      publishRoom(room);
    }
  });

  socket.on("close", () => {
    leaveRoom(client);
    clients.delete(client);
  });
});

const roomTickInterval = setInterval(() => {
  for (const room of rooms.values()) {
    if (room.matchState === "countdown" && room.countdownEndsAt && room.countdownEndsAt <= Date.now()) {
      startMatch(room);
      publishRoom(room);
    }
  }
}, 40);

function joinRoom(client: RoomClient, roomCode: string, role: ClientRole, playerName?: string) {
  leaveRoom(client);

  client.roomCode = roomCode;
  client.role = role;

  const room = rooms.get(roomCode) ?? createInitialRoomSnapshot(roomCode);
  room.masterConnected = room.masterConnected || role === "master";
  if (role === "A" || role === "B") {
    room.players[role].connected = true;
    room.players[role].name = normalizePlayerName(playerName, room.players[role].name);
  }

  room.feed = updateRoomFeed(room.feed, `${role === "master" ? "Maestro" : room.players[role]?.name ?? `Jugador ${role}`} entró en ${roomCode}.`);
  room.updatedAt = Date.now();

  rooms.set(roomCode, room);
  publishRoom(room);
}

function leaveRoom(client: RoomClient) {
  if (!client.roomCode || !rooms.has(client.roomCode)) {
    client.roomCode = null;
    client.role = null;
    return;
  }

  const room = rooms.get(client.roomCode)!;
  if (client.role === "master") {
    room.masterConnected = false;
  }

  if (client.role === "A" || client.role === "B") {
    room.players[client.role].connected = false;
  }

  room.feed = updateRoomFeed(
    room.feed,
    `${client.role === "master" ? "El maestro" : `El jugador ${client.role}`} salió de ${client.roomCode}.`,
  );
  room.updatedAt = Date.now();

  client.roomCode = null;
  client.role = null;

  publishRoom(room);
}

function startMatch(room: RoomSnapshot) {
  room.matchState = "live";
  room.countdownEndsAt = null;
  room.startedAt = Date.now();
  room.finishedAt = null;
  room.players.A.input = "";
  room.players.A.typingVersion = 0;
  room.players.B.input = "";
  room.players.B.typingVersion = 0;
  room.feed = updateRoomFeed(room.feed, `Comenzó la partida en ${room.roomCode}.`);
  room.updatedAt = Date.now();
}

function startCountdown(room: RoomSnapshot) {
  room.matchState = "countdown";
  room.countdownEndsAt = Date.now() + 3000;
  room.startedAt = null;
  room.finishedAt = null;
  room.players.A.input = "";
  room.players.A.typingVersion = 0;
  room.players.B.input = "";
  room.players.B.typingVersion = 0;
  room.feed = updateRoomFeed(room.feed, "Cuenta regresiva iniciada: la ronda comienza en breve.");
  room.updatedAt = Date.now();
}

function resetMatch(room: RoomSnapshot) {
  room.matchState = "lobby";
  room.countdownEndsAt = null;
  room.startedAt = null;
  room.finishedAt = null;
  room.players.A.input = "";
  room.players.A.typingVersion = 0;
  room.players.B.input = "";
  room.players.B.typingVersion = 0;
  room.players.A.ready = false;
  room.players.B.ready = false;
  room.feed = updateRoomFeed(room.feed, `La sala ${room.roomCode} volvió al lobby.`);
  room.updatedAt = Date.now();
}

function maybeFinishMatch(room: RoomSnapshot) {
  if (!room.startedAt || room.finishedAt || room.matchState !== "live") {
    return;
  }

  const challenge = activeCatalog[room.selectedTextIndex]?.text ?? activeCatalog[0]?.text ?? "";
  const now = Date.now();
  const statsA = calculatePlayerStats(room.players.A.input, challenge, room.startedAt, now, room.finishedAt);
  const statsB = calculatePlayerStats(room.players.B.input, challenge, room.startedAt, now, room.finishedAt);
  const winner = winnerFromSnapshot(room, now);

  if (!winner) {
    return;
  }

  room.matchState = "finished";
  room.finishedAt = now;

  const winnerStats = winner === "A" ? statsA : statsB;
  const loserStats = winner === "A" ? statsB : statsA;
  const winnerName = winner === "A" ? room.players.A.name : room.players.B.name;
  const loserName = winner === "A" ? room.players.B.name : room.players.A.name;

  const resolveParticipantName = (name: string, playerId: PlayerId) => name.trim() || `Jugador ${playerId}`;

  room.feed = updateRoomFeed(room.feed, `${resolveParticipantName(winnerName, winner)} ganó la sala ${room.roomCode}.`);
  room.history = [
    createCompletionEntry(resolveParticipantName(winnerName, winner), winnerStats, true),
    createCompletionEntry(resolveParticipantName(loserName, winner === "A" ? "B" : "A"), loserStats, false),
    ...room.history,
  ].slice(0, 200);
  room.updatedAt = now;
}

function publishRoom(room: RoomSnapshot) {
  const payload = JSON.stringify({
    type: "room-snapshot",
    room,
  } satisfies ServerMessage);

  for (const client of clients) {
    if (client.roomCode !== room.roomCode) {
      continue;
    }

    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(payload);
    }
  }
}

function publishTypingUpdate(room: RoomSnapshot, playerId: PlayerId) {
  const player = room.players[playerId];
  const payload = JSON.stringify({
    type: "typing-update",
    roomCode: room.roomCode,
    playerId,
    input: player.input,
    typingVersion: player.typingVersion,
    updatedAt: room.updatedAt,
  } satisfies ServerMessage);

  for (const client of clients) {
    if (client.roomCode !== room.roomCode) {
      continue;
    }

    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(payload);
    }
  }
}

function send(socket: import("ws").WebSocket, message: ServerMessage) {
  socket.send(JSON.stringify(message));
}

async function handleServerError(error: StartupError, alreadyListening: boolean) {
  if (!alreadyListening && error.code === "EADDRINUSE") {
    const reachableUrl = await detectReachableRelayUrl(port, host);

    if (reachableUrl) {
      console.log(
        `[typing-ws] relay already active at ${reachableUrl}; skipping duplicate start on ws://${host}:${port}.`,
      );
      startDuplicateRelayKeepAlive();
      return;
    }

    console.error(`[typing-ws] cannot bind ws://${host}:${port}: port already in use by another process.`);
    process.exit(1);
    return;
  }

  console.error("[typing-ws] server error", error);

  if (!alreadyListening) {
    process.exit(1);
  }
}

function startDuplicateRelayKeepAlive() {
  if (duplicateRelayKeepAliveInterval) {
    return;
  }

  clearInterval(catalogRefreshInterval);
  clearInterval(roomTickInterval);

  duplicateRelayKeepAliveInterval = setInterval(() => {
    // Keep this process alive so orchestrated dev scripts do not shutdown other services.
  }, 60_000);
}

async function detectReachableRelayUrl(portToProbe: number, configuredHost: string) {
  const probeHosts = Array.from(
    new Set([
      configuredHost,
      configuredHost === "0.0.0.0" ? "127.0.0.1" : "0.0.0.0",
      "localhost",
      "127.0.0.1",
    ]),
  ).filter((candidateHost) => candidateHost !== "0.0.0.0");

  for (const probeHost of probeHosts) {
    // Probe the existing listener with a WebSocket handshake so we only reuse an active relay.
    const isReachable = await canOpenWebSocket(`ws://${probeHost}:${portToProbe}`);

    if (isReachable) {
      return `ws://${probeHost}:${portToProbe}`;
    }
  }

  return null;
}

function canOpenWebSocket(url: string) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const socket = new WebSocket(url);

    const finalize = (result: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      socket.removeAllListeners();

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.terminate();
      }

      resolve(result);
    };

    const timeout = setTimeout(() => {
      finalize(false);
    }, 650);

    socket.once("open", () => {
      finalize(true);
    });

    socket.once("error", () => {
      finalize(false);
    });

    socket.once("unexpected-response", () => {
      finalize(false);
    });
  });
}