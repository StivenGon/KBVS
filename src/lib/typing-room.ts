export type PlayerId = "A" | "B";
export type ClientRole = "master" | PlayerId;
export type MatchState = "lobby" | "countdown" | "live" | "finished";

export type TypingChallenge = {
  text: string;
  title: string;
};

export type PlayerSnapshot = {
  name: string;
  ready: boolean;
  input: string;
  connected: boolean;
};

export type HistoryEntry = {
  name: string;
  time: string;
  errors: number;
  accuracy: number;
  wpm: number;
  winner: boolean;
};

export type RoomSnapshot = {
  roomCode: string;
  matchState: MatchState;
  selectedTextIndex: number;
  countdownEndsAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  players: Record<PlayerId, PlayerSnapshot>;
  feed: string[];
  history: HistoryEntry[];
  updatedAt: number;
  masterConnected: boolean;
};

export type PlayerStats = {
  typedCharacters: number;
  correctCharacters: number;
  targetCharacters: number;
  mistakes: number;
  accuracy: number;
  progress: number;
  textProgressLabel: string;
  elapsed: number;
  wpm: number;
  elapsedText: string;
};

export const challengeTexts: TypingChallenge[] = [
  {
    title: "Ronda de control",
    text: "En la arena de mecanografía, cada palabra cuenta y cada pausa revela el ritmo real del jugador.",
  },
  {
    title: "Ronda de precisión",
    text: "Las teclas rápidas no ganan solas; gana quien mantiene precisión, ritmo y control bajo presión.",
  },
  {
    title: "Ronda maestro",
    text: "Dos rivales, una sola línea de texto y un maestro observando cada error en tiempo real.",
  },
];

export const initialFeed = [
  "Sala demo lista para dos jugadores y una vista maestro.",
  "Se prepara una sesión local para demostrar la sincronización visual.",
  "El historial de resultados se guardará cuando la base de datos esté conectada.",
];

export const initialHistory: HistoryEntry[] = [
  { name: "Mara", time: "01:22.41", errors: 3, accuracy: 97, wpm: 58, winner: true },
  { name: "Leo", time: "01:31.08", errors: 5, accuracy: 94, wpm: 52, winner: false },
  { name: "Nora", time: "01:18.77", errors: 2, accuracy: 98, wpm: 61, winner: true },
];

export function createRoomCode() {
  const fragments = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10).toString());
  return `SALA-${fragments.join("")}`;
}

export function formatClock(milliseconds: number) {
  const totalMilliseconds = Math.max(0, Math.floor(milliseconds));
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  const centiseconds = String(Math.floor((totalMilliseconds % 1000) / 10)).padStart(2, "0");

  return `${minutes}:${seconds}.${centiseconds}`;
}

export function createInitialRoomSnapshot(roomCode = createRoomCode()): RoomSnapshot {
  return {
    roomCode,
    matchState: "lobby",
    selectedTextIndex: 0,
    countdownEndsAt: null,
    startedAt: null,
    finishedAt: null,
    players: {
      A: {
        name: "Ana",
        ready: false,
        input: "",
        connected: false,
      },
      B: {
        name: "Bruno",
        ready: false,
        input: "",
        connected: false,
      },
    },
    feed: [...initialFeed],
    history: [...initialHistory],
    updatedAt: Date.now(),
    masterConnected: false,
  };
}

export function calculatePlayerStats(
  input: string,
  target: string,
  startedAt: number | null,
  now: number,
  finishedAt: number | null,
): PlayerStats {
  const typedCharacters = input.length;
  const targetCharacters = target.length;
  const correctCharacters = Array.from(input).reduce((total, character, index) => {
    return total + (character === target[index] ? 1 : 0);
  }, 0);
  const mistakes = Math.max(0, typedCharacters - correctCharacters);
  const accuracy = typedCharacters === 0 ? 100 : Math.max(0, Math.round((correctCharacters / typedCharacters) * 100));
  const progress = targetCharacters === 0 ? 0 : Math.min(100, Math.round((typedCharacters / targetCharacters) * 100));
  const elapsed = startedAt ? (finishedAt ?? now) - startedAt : 0;
  const wpm =
    startedAt && elapsed > 0
      ? Math.max(0, Math.round((correctCharacters / 5) / (elapsed / 60000)))
      : 0;

  return {
    typedCharacters,
    correctCharacters,
    targetCharacters,
    mistakes,
    accuracy,
    progress,
    textProgressLabel: `${Math.min(typedCharacters, targetCharacters)}/${targetCharacters} caracteres`,
    elapsed,
    wpm,
    elapsedText: startedAt ? formatClock(elapsed) : "00:00.00",
  };
}

export function createDemoAutoAdvance(input: string, target: string) {
  if (input.length >= target.length) {
    return input;
  }

  const expectedCharacter = target[input.length];
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const fallback = alphabet[(alphabet.indexOf(expectedCharacter.toLowerCase()) + 7) % alphabet.length];
  const typedCharacter =
    Math.random() < 0.14 && input.length % 9 !== 0
      ? expectedCharacter === expectedCharacter.toUpperCase()
        ? fallback.toUpperCase()
        : fallback
      : expectedCharacter;

  return `${input}${typedCharacter}`;
}

export function updateRoomFeed(feed: string[], message: string) {
  return [message, ...feed].slice(0, 5);
}

export function winnerFromSnapshot(room: RoomSnapshot, now: number) {
  const challenge = challengeTexts[room.selectedTextIndex].text;
  const statsA = calculatePlayerStats(room.players.A.input, challenge, room.startedAt, now, room.finishedAt);
  const statsB = calculatePlayerStats(room.players.B.input, challenge, room.startedAt, now, room.finishedAt);

  if (statsA.progress >= 100 || statsB.progress >= 100) {
    if (statsA.progress >= 100 && statsB.progress >= 100) {
      return statsA.elapsed <= statsB.elapsed ? "A" : "B";
    }

    return statsA.progress >= 100 ? "A" : "B";
  }

  return null;
}

export function createCompletionEntry(name: string, stats: PlayerStats, winner: boolean): HistoryEntry {
  return {
    name,
    time: stats.elapsedText,
    errors: stats.mistakes,
    accuracy: stats.accuracy,
    wpm: stats.wpm,
    winner,
  };
}