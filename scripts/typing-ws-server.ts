import { WebSocket, WebSocketServer } from "ws";

import {
  calculatePlayerStats,
  createCompletionEntry,
  createDemoAutoAdvance,
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

const port = Number(process.env.TYPING_WS_PORT ?? 8787);
const rooms = new Map<string, RoomSnapshot>();
const clients = new Set<RoomClient>();
let activeCatalog = getCachedTextCatalog();

void loadTextCatalog({ forceRefresh: true }).then((catalog) => {
  activeCatalog = catalog;
});

setInterval(() => {
  void loadTextCatalog({ forceRefresh: true }).then((catalog) => {
    activeCatalog = catalog;
  });
}, 60_000);

const wss = new WebSocketServer({ port });

console.log(`[typing-ws] listening on ws://localhost:${port}`);

wss.on("connection", (socket) => {
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
          break;
        }

        room.players[message.playerId] = {
          ...room.players[message.playerId],
          input: message.input,
        };

        maybeFinishMatch(room);

        room.updatedAt = Date.now();
        break;
      }
      case "leave-room": {
        leaveRoom(client);
        return;
      }
    }

    publishRoom(room);
  });

  socket.on("close", () => {
    leaveRoom(client);
    clients.delete(client);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.matchState === "countdown" && room.countdownEndsAt && room.countdownEndsAt <= Date.now()) {
      startMatch(room);
      publishRoom(room);
      continue;
    }

    if (room.matchState !== "live" || room.finishedAt) {
      continue;
    }

    const challenge = activeCatalog[room.selectedTextIndex]?.text ?? activeCatalog[0]?.text ?? "";

    for (const playerId of ["A", "B"] as PlayerId[]) {
      if (room.players[playerId].connected) {
        continue;
      }

      room.players[playerId].input = createDemoAutoAdvance(room.players[playerId].input, challenge);
    }

    maybeFinishMatch(room);
    publishRoom(room);
  }
}, 180);

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
  room.players.B.input = "";
  room.feed = updateRoomFeed(room.feed, `Comenzó la partida en ${room.roomCode}.`);
  room.updatedAt = Date.now();
}

function startCountdown(room: RoomSnapshot) {
  room.matchState = "countdown";
  room.countdownEndsAt = Date.now() + 3000;
  room.startedAt = null;
  room.finishedAt = null;
  room.players.A.input = "";
  room.players.B.input = "";
  room.feed = updateRoomFeed(room.feed, "Cuenta regresiva iniciada: la ronda comienza en breve.");
  room.updatedAt = Date.now();
}

function resetMatch(room: RoomSnapshot) {
  room.matchState = "lobby";
  room.countdownEndsAt = null;
  room.startedAt = null;
  room.finishedAt = null;
  room.players.A.input = "";
  room.players.B.input = "";
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

function send(socket: import("ws").WebSocket, message: ServerMessage) {
  socket.send(JSON.stringify(message));
}