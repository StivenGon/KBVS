export type BattlePlayerId = string;

export type BattlePlayer = {
  id: BattlePlayerId;
  name: string;
  ready: boolean;
  input: string;
  connected: boolean;
  typingVersion: number;
  finished: boolean;
  finishedAt: number | null;
};

export type BattleRoom = {
  roomCode: string;
  matchState: "lobby" | "countdown" | "live" | "finished";
  selectedTextIndex: number;
  countdownEndsAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  players: BattlePlayer[];
  feed: string[];
  updatedAt: number;
};

let nextPlayerId = 1;

export function createBattlePlayerId(): BattlePlayerId {
  return `p${nextPlayerId++}`;
}

export function createBattleRoom(): BattleRoom {
  return {
    roomCode: "battle",
    matchState: "lobby",
    selectedTextIndex: 0,
    countdownEndsAt: null,
    startedAt: null,
    finishedAt: null,
    players: [],
    feed: ["Sala de batalla abierta. ¡Que gane el más rápido!"],
    updatedAt: Date.now(),
  };
}

export function addBattlePlayer(room: BattleRoom, name: string): BattlePlayer {
  const id = createBattlePlayerId();
  const player: BattlePlayer = {
    id,
    name: name.trim() || `Jugador ${id}`,
    ready: false,
    input: "",
    connected: true,
    typingVersion: 0,
    finished: false,
    finishedAt: null,
  };
  room.players.push(player);
  room.feed = [`${player.name} se unió a la batalla.`, ...room.feed].slice(0, 10);
  room.updatedAt = Date.now();
  return player;
}

export function removeBattlePlayer(room: BattleRoom, playerId: BattlePlayerId) {
  const player = room.players.find((p) => p.id === playerId);
  if (player) {
    room.players = room.players.filter((p) => p.id !== playerId);
    room.feed = [`${player.name} abandonó la batalla.`, ...room.feed].slice(0, 10);
    room.updatedAt = Date.now();
  }
}

export function allBattlePlayersFinished(room: BattleRoom): boolean {
  if (room.players.length === 0) return false;
  return room.players.every((p) => p.finished || !p.connected);
}

export function countBattleActivePlayers(room: BattleRoom): number {
  return room.players.filter((p) => p.connected && !p.finished).length;
}

export type BattleRankingEntry = {
  name: string;
  position: number;
  wpm: number;
  accuracy: number;
  errors: number;
  elapsed: number;
  elapsedText: string;
  progress: number;
  score: number;
};
