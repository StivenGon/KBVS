export type PlayerId = "A" | "B";
export type ClientRole = "master" | PlayerId;
export type MatchState = "lobby" | "countdown" | "live" | "finished";

export type DifficultyTone = "emerald" | "amber" | "rose";

export type TextDifficulty = {
  id: number;
  label: string;
  tone: DifficultyTone;
};

export type TypingChallenge = {
  id: number;
  text: string;
  title: string;
  textDifficultyId: number;
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
  score: number;
};

export type SkillTier = "novato" | "aprendiz" | "competente" | "experto" | "maestro" | "leyenda";

export type LeaderboardEntry = {
  name: string;
  matches: number;
  wins: number;
  bestScore: number;
  averageScore: number;
  averageWpm: number;
  averageAccuracy: number;
  averageErrors: number;
  skillScore: number;
  skillTier: SkillTier;
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

const PLAYER_NAME_MAX_LENGTH = 32;

export function normalizePlayerName(value: string | undefined, fallback: string) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, PLAYER_NAME_MAX_LENGTH);
}

export const challengeTexts: TypingChallenge[] = [
  {
    id: 1,
    title: "Ronda de control",
    text: "En la arena de mecanografía, cada palabra cuenta y cada pausa revela el ritmo real del jugador.",
    textDifficultyId: 1,
  },
  {
    id: 2,
    title: "Ronda de precisión",
    text: "Las teclas rápidas no ganan solas; gana quien mantiene precisión, ritmo y control bajo presión.",
    textDifficultyId: 2,
  },
  {
    id: 3,
    title: "Ronda maestro",
    text: "Dos rivales, una sola línea de texto y un maestro observando cada error en tiempo real.",
    textDifficultyId: 3,
  },
];

export const textDifficultyCatalog: TextDifficulty[] = [
  {
    id: 1,
    label: "Baja",
    tone: "emerald",
  },
  {
    id: 2,
    label: "Media",
    tone: "amber",
  },
  {
    id: 3,
    label: "Alta",
    tone: "rose",
  },
];

export function getTextDifficulty(textDifficultyId: number) {
  return textDifficultyCatalog.find((difficulty) => difficulty.id === textDifficultyId) ?? textDifficultyCatalog[0];
}

export function getChallengeDifficulty(challenge: TypingChallenge) {
  return getTextDifficulty(challenge.textDifficultyId);
}

export const initialFeed = [
  "Sala demo lista para dos jugadores y una vista maestro.",
  "Se prepara una sesión local para demostrar la sincronización visual.",
  "El historial de resultados se guardará cuando la base de datos esté conectada.",
];

export const initialHistory: HistoryEntry[] = [];

export function createRoomCode() {
  const fragments = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10).toString());
  return fragments.join("");
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
        name: "",
        ready: false,
        input: "",
        connected: false,
      },
      B: {
        name: "",
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
    score: calculateParticipantScore(stats, winner),
  };
}

export function calculateParticipantScore(stats: PlayerStats, winner: boolean) {
  const rawScore = stats.wpm * 2.2 + stats.accuracy * 1.15 - stats.mistakes * 4 + stats.progress * 0.25 + (winner ? 24 : 0);

  return Math.max(0, Math.round(rawScore));
}

export function getSkillTier(score: number): SkillTier {
  if (score >= 200) {
    return "leyenda";
  }

  if (score >= 160) {
    return "maestro";
  }

  if (score >= 125) {
    return "experto";
  }

  if (score >= 90) {
    return "competente";
  }

  if (score >= 60) {
    return "aprendiz";
  }

  return "novato";
}

export function buildLeaderboard(history: HistoryEntry[]): LeaderboardEntry[] {
  const grouped = new Map<
    string,
    {
      name: string;
      matches: number;
      wins: number;
      scoreTotal: number;
      bestScore: number;
      wpmTotal: number;
      accuracyTotal: number;
      errorsTotal: number;
    }
  >();

  for (const entry of history) {
    if (!Number.isFinite(entry.score)) {
      continue;
    }

    if (!Number.isFinite(entry.wpm) || !Number.isFinite(entry.accuracy) || !Number.isFinite(entry.errors)) {
      continue;
    }

    const key = entry.name.trim();

    if (!key) {
      continue;
    }

    const current = grouped.get(key) ?? {
      name: key,
      matches: 0,
      wins: 0,
      scoreTotal: 0,
      bestScore: 0,
      wpmTotal: 0,
      accuracyTotal: 0,
      errorsTotal: 0,
    };

    current.matches += 1;
    current.wins += entry.winner ? 1 : 0;
    current.scoreTotal += entry.score;
    current.bestScore = Math.max(current.bestScore, entry.score);
    current.wpmTotal += entry.wpm;
    current.accuracyTotal += entry.accuracy;
    current.errorsTotal += entry.errors;

    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((entry) => {
      const averageScore = entry.scoreTotal / entry.matches;
      const averageWpm = entry.wpmTotal / entry.matches;
      const averageAccuracy = entry.accuracyTotal / entry.matches;
      const averageErrors = entry.errorsTotal / entry.matches;
      if (![averageScore, averageWpm, averageAccuracy, averageErrors].every(Number.isFinite)) {
        return null;
      }

      const skillScore = Math.round(
        averageScore + entry.wins * 16 + averageWpm * 0.65 + averageAccuracy * 0.2 - averageErrors * 3,
      );

      if (!Number.isFinite(skillScore)) {
        return null;
      }

      return {
        name: entry.name,
        matches: entry.matches,
        wins: entry.wins,
        bestScore: entry.bestScore,
        averageScore: Math.round(averageScore),
        averageWpm: Math.round(averageWpm),
        averageAccuracy: Math.round(averageAccuracy),
        averageErrors: Number(averageErrors.toFixed(1)),
        skillScore,
        skillTier: getSkillTier(skillScore),
      } satisfies LeaderboardEntry;
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null)
    .sort((left, right) => {
      if (right.skillScore !== left.skillScore) {
        return right.skillScore - left.skillScore;
      }

      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      if (right.averageWpm !== left.averageWpm) {
        return right.averageWpm - left.averageWpm;
      }

      if (right.averageAccuracy !== left.averageAccuracy) {
        return right.averageAccuracy - left.averageAccuracy;
      }

      return left.name.localeCompare(right.name, "es");
    });
}