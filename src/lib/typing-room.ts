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
  typingVersion: number;
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

export type TypingTextToken =
  | {
      kind: "target";
      character: string;
      status: "correct" | "wrong" | "missing" | "pending";
      inputCharacter?: string;
    }
  | {
      kind: "extra";
      character: string;
      status: "extra";
    };

export type TypingTextMatch = {
  input: string;
  target: string;
  tokens: TypingTextToken[];
  typedCharacters: number;
  correctCharacters: number;
  targetCharacters: number;
  mistakes: number;
  complete: boolean;
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
        typingVersion: 0,
      },
      B: {
        name: "",
        ready: false,
        input: "",
        connected: false,
        typingVersion: 0,
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
  const match = buildTypingTextMatch(input, target);
  const typedCharacters = match.typedCharacters;
  const targetCharacters = match.targetCharacters;
  const correctCharacters = match.correctCharacters;
  const mistakes = match.mistakes;
  const scoredCharacters = correctCharacters + mistakes;
  const accuracy = scoredCharacters === 0 ? 100 : Math.max(0, Math.round((correctCharacters / scoredCharacters) * 100));
  const progress =
    targetCharacters === 0
      ? 0
      : match.complete
        ? 100
        : Math.min(99, Math.round((correctCharacters / targetCharacters) * 100));
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
    textProgressLabel: `${Math.min(correctCharacters, targetCharacters)}/${targetCharacters} caracteres`,
    elapsed,
    wpm,
    elapsedText: startedAt ? formatClock(elapsed) : "00:00.00",
  };
}

export function normalizeText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\u2026/g, "...")
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/\p{Z}/gu, " ")
    .replace(/[\u200B-\u200F\u2028\u2029\uFEFF\u00AD\u2060]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeTypingInput(input: string, target: string, overtypeBuffer = 24) {
  const maxCharacters = Array.from(normalizeText(target)).length + overtypeBuffer;
  return Array.from(normalizeText(input)).slice(0, maxCharacters).join("");
}

export function isTypingComplete(input: string, target: string) {
  const normalizedTarget = normalizeText(target);

  return normalizedTarget.length > 0 && normalizeText(input) === normalizedTarget;
}

export function buildTypingTextMatch(input: string, target: string): TypingTextMatch {
  const normalizedInput = normalizeText(input);
  const normalizedTarget = normalizeText(target);
  const inputCharacters = Array.from(normalizedInput);
  const targetCharacters = Array.from(normalizedTarget);
  const inputLength = inputCharacters.length;
  const targetLength = targetCharacters.length;
  const width = targetLength + 1;
  const cellCount = (inputLength + 1) * width;
  const costs = new Uint32Array(cellCount);
  const matches = new Uint32Array(cellCount);
  const operations = new Uint8Array(cellCount);

  for (let inputIndex = 1; inputIndex <= inputLength; inputIndex += 1) {
    const cellIndex = getMatchCellIndex(inputIndex, 0, width);
    costs[cellIndex] = costs[getMatchCellIndex(inputIndex - 1, 0, width)] + getInputInsertCost(inputCharacters[inputIndex - 1]);
    operations[cellIndex] = MATCH_OPERATION_INSERT;
  }

  for (let targetIndex = 1; targetIndex <= targetLength; targetIndex += 1) {
    const cellIndex = getMatchCellIndex(0, targetIndex, width);
    costs[cellIndex] = costs[getMatchCellIndex(0, targetIndex - 1, width)] + getTargetDeleteCost(targetCharacters[targetIndex - 1]);
    operations[cellIndex] = MATCH_OPERATION_DELETE;
  }

  for (let inputIndex = 1; inputIndex <= inputLength; inputIndex += 1) {
    for (let targetIndex = 1; targetIndex <= targetLength; targetIndex += 1) {
      const inputCharacter = inputCharacters[inputIndex - 1];
      const targetCharacter = targetCharacters[targetIndex - 1];
      const equal = inputCharacter === targetCharacter;
      const cellIndex = getMatchCellIndex(inputIndex, targetIndex, width);
      const diagonalIndex = getMatchCellIndex(inputIndex - 1, targetIndex - 1, width);
      const insertIndex = getMatchCellIndex(inputIndex - 1, targetIndex, width);
      const deleteIndex = getMatchCellIndex(inputIndex, targetIndex - 1, width);
      let bestCost = costs[diagonalIndex] + (equal ? 0 : getSubstitutionCost(inputCharacter, targetCharacter));
      let bestMatches = matches[diagonalIndex] + (equal ? 1 : 0);
      let bestOperation = equal ? MATCH_OPERATION_MATCH : MATCH_OPERATION_SUBSTITUTE;
      const insertCost = costs[insertIndex] + getInputInsertCost(inputCharacter);
      const insertMatches = matches[insertIndex];

      if (isBetterMatchCell(insertCost, insertMatches, MATCH_OPERATION_INSERT, bestCost, bestMatches, bestOperation)) {
        bestCost = insertCost;
        bestMatches = insertMatches;
        bestOperation = MATCH_OPERATION_INSERT;
      }

      const deleteCost = costs[deleteIndex] + getTargetDeleteCost(targetCharacter);
      const deleteMatches = matches[deleteIndex];

      if (isBetterMatchCell(deleteCost, deleteMatches, MATCH_OPERATION_DELETE, bestCost, bestMatches, bestOperation)) {
        bestCost = deleteCost;
        bestMatches = deleteMatches;
        bestOperation = MATCH_OPERATION_DELETE;
      }

      costs[cellIndex] = bestCost;
      matches[cellIndex] = bestMatches;
      operations[cellIndex] = bestOperation;
    }
  }

  let finalTargetIndex = 0;
  for (let targetIndex = 1; targetIndex <= targetLength; targetIndex += 1) {
    const candidateIndex = getMatchCellIndex(inputLength, targetIndex, width);
    const currentIndex = getMatchCellIndex(inputLength, finalTargetIndex, width);

    if (
      isBetterFinalCell(
        costs[candidateIndex],
        matches[candidateIndex],
        targetIndex,
        costs[currentIndex],
        matches[currentIndex],
        finalTargetIndex,
      )
    ) {
      finalTargetIndex = targetIndex;
    }
  }

  const alignedTokens: TypingTextToken[] = [];
  let inputIndex = inputLength;
  let targetIndex = finalTargetIndex;

  while (inputIndex > 0 || targetIndex > 0) {
    const operation = operations[getMatchCellIndex(inputIndex, targetIndex, width)];

    if (operation === MATCH_OPERATION_MATCH || operation === MATCH_OPERATION_SUBSTITUTE) {
      const inputCharacter = inputCharacters[inputIndex - 1];
      const targetCharacter = targetCharacters[targetIndex - 1];
      alignedTokens.push({
        kind: "target",
        character: targetCharacter,
        status: operation === MATCH_OPERATION_MATCH ? "correct" : "wrong",
        inputCharacter,
      });
      inputIndex -= 1;
      targetIndex -= 1;
      continue;
    }

    if (operation === MATCH_OPERATION_INSERT) {
      alignedTokens.push({
        kind: "extra",
        character: inputCharacters[inputIndex - 1],
        status: "extra",
      });
      inputIndex -= 1;
      continue;
    }

    if (operation === MATCH_OPERATION_DELETE) {
      alignedTokens.push({
        kind: "target",
        character: targetCharacters[targetIndex - 1],
        status: "missing",
      });
      targetIndex -= 1;
      continue;
    }

    break;
  }

  alignedTokens.reverse();

  for (let pendingIndex = finalTargetIndex; pendingIndex < targetLength; pendingIndex += 1) {
    alignedTokens.push({
      kind: "target",
      character: targetCharacters[pendingIndex],
      status: "pending",
    });
  }

  let correctCharacters = 0;
  let mistakes = 0;

  for (const token of alignedTokens) {
    if (token.kind === "target" && token.status === "correct") {
      correctCharacters += 1;
      continue;
    }

    if (token.status === "wrong" || token.status === "missing" || token.status === "extra") {
      mistakes += 1;
    }
  }

  return {
    input: normalizedInput,
    target: normalizedTarget,
    tokens: alignedTokens,
    typedCharacters: inputLength,
    correctCharacters,
    targetCharacters: targetLength,
    mistakes,
    complete: normalizedInput === normalizedTarget && targetLength > 0,
  };
}

export function getCorrectPrefixLength(input: string, target: string) {
  const inputCharacters = Array.from(normalizeText(input));
  const targetCharacters = Array.from(normalizeText(target));
  const maxLength = Math.min(inputCharacters.length, targetCharacters.length);
  let matchedCharacters = 0;

  for (let index = 0; index < maxLength; index += 1) {
    if (inputCharacters[index] !== targetCharacters[index]) break;
    matchedCharacters += 1;
  }

  return matchedCharacters;
}

const MATCH_OPERATION_START = 0;
const MATCH_OPERATION_MATCH = 1;
const MATCH_OPERATION_SUBSTITUTE = 2;
const MATCH_OPERATION_INSERT = 3;
const MATCH_OPERATION_DELETE = 4;

const OPERATION_PRIORITY: Record<number, number> = {
  [MATCH_OPERATION_START]: 0,
  [MATCH_OPERATION_MATCH]: 5,
  [MATCH_OPERATION_SUBSTITUTE]: 4,
  [MATCH_OPERATION_DELETE]: 3,
  [MATCH_OPERATION_INSERT]: 2,
};

function getMatchCellIndex(inputIndex: number, targetIndex: number, width: number) {
  return inputIndex * width + targetIndex;
}

function isBetterMatchCell(
  candidateCost: number,
  candidateMatches: number,
  candidateOperation: number,
  currentCost: number,
  currentMatches: number,
  currentOperation: number,
) {
  if (candidateCost !== currentCost) {
    return candidateCost < currentCost;
  }

  if (candidateMatches !== currentMatches) {
    return candidateMatches > currentMatches;
  }

  return OPERATION_PRIORITY[candidateOperation] >= OPERATION_PRIORITY[currentOperation];
}

function isBetterFinalCell(
  candidateCost: number,
  candidateMatches: number,
  candidateTargetIndex: number,
  currentCost: number,
  currentMatches: number,
  currentTargetIndex: number,
) {
  if (candidateCost !== currentCost) {
    return candidateCost < currentCost;
  }

  if (candidateMatches !== currentMatches) {
    return candidateMatches > currentMatches;
  }

  return candidateTargetIndex > currentTargetIndex;
}

function getSubstitutionCost(inputCharacter: string, targetCharacter: string) {
  if (isWhitespaceCharacter(inputCharacter) && isWhitespaceCharacter(targetCharacter)) {
    return 0;
  }

  return 2;
}

function getInputInsertCost(character: string) {
  return isSoftAlignmentCharacter(character) ? 1 : 2;
}

function getTargetDeleteCost(character: string) {
  return isSoftAlignmentCharacter(character) ? 1 : 2;
}

function isWhitespaceCharacter(character: string) {
  return /\s/u.test(character);
}

function isSoftAlignmentCharacter(character: string) {
  return /[\s.,;:!?¿¡()\[\]{}'"\-]/u.test(character);
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

export function winnerFromSnapshot(room: RoomSnapshot, now: number, targetText?: string) {
  const challenge = targetText ?? challengeTexts[room.selectedTextIndex].text;
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
