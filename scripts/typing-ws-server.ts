import { WebSocket, WebSocketServer } from "ws";

import {
  calculatePlayerStats,
  challengeTexts,
  createCompletionEntry,
  createDemoAutoAdvance,
  createInitialRoomSnapshot,
  updateRoomFeed,
  winnerFromSnapshot,
  type ClientRole,
  type PlayerId,
  type RoomSnapshot,
} from "../src/lib/typing-room";

type ClientMessage =
  | {
      type: "join-room";
      roomCode: string;
      role: ClientRole;
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
      joinRoom(client, message.roomCode, message.role);
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
        const nextPlayers = {
          ...room.players,
          [message.playerId]: {
            ...room.players[message.playerId],
            ...message.patch,
          },
        };

        room.players = nextPlayers;
        room.feed = updateRoomFeed(room.feed, `${nextPlayers[message.playerId].name} actualizó su ficha.`);
        room.updatedAt = Date.now();
        break;
      }
      case "set-text": {
        room.selectedTextIndex = Math.max(0, Math.min(challengeTexts.length - 1, message.selectedTextIndex));
        room.feed = updateRoomFeed(room.feed, `Se cargó el texto ${room.selectedTextIndex + 1} de la sala.`);
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

    const challenge = challengeTexts[room.selectedTextIndex].text;

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

function joinRoom(client: RoomClient, roomCode: string, role: ClientRole) {
  leaveRoom(client);

  client.roomCode = roomCode;
  client.role = role;

  const room = rooms.get(roomCode) ?? createInitialRoomSnapshot(roomCode);
  room.masterConnected = room.masterConnected || role === "master";
  room.players.A.connected = room.players.A.connected || role === "A";
  room.players.B.connected = room.players.B.connected || role === "B";
  room.feed = updateRoomFeed(room.feed, `${role === "master" ? "Maestro" : `Jugador ${role}`} entró en ${roomCode}.`);
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

  const challenge = challengeTexts[room.selectedTextIndex].text;
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
  const winnerName = winner === "A" ? room.players.A.name : room.players.B.name;

  room.feed = updateRoomFeed(room.feed, `${winnerName} ganó la sala ${room.roomCode}.`);
  room.history = [
    createCompletionEntry(winnerName, winnerStats, true),
    ...room.history,
  ].slice(0, 5);
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