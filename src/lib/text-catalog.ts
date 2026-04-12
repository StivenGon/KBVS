import { challengeTexts, getChallengeDifficulty, type TypingChallenge } from "@/lib/typing-room";

export type CatalogDifficultyTone = "emerald" | "amber" | "rose";

export type CatalogDifficulty = {
  id: number;
  label: string;
  level: number;
  tone: CatalogDifficultyTone;
};

export type CatalogText = {
  id: number;
  title: string;
  text: string;
  wordCount: number;
  characterCount: number;
  difficulty: CatalogDifficulty;
};

export type CatalogRecord = {
  id_text: number;
  text_title: string;
  text_desc: string;
  text_difficulty_id: number;
  text_dif_desc?: string;
  text_dif_level?: number;
  text_dif_color?: CatalogDifficultyTone;
};

export function countWords(text: string) {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/u).length;
}

export function buildCatalogText(challenge: TypingChallenge): CatalogText {
  const difficulty = getChallengeDifficulty(challenge);

  return {
    id: challenge.id,
    title: challenge.title,
    text: challenge.text,
    wordCount: countWords(challenge.text),
    characterCount: challenge.text.length,
    difficulty: {
      id: challenge.textDifficultyId,
      label: difficulty.label,
      level: challenge.textDifficultyId,
      tone: difficulty.tone,
    },
  };
}

export function buildFallbackCatalog(): CatalogText[] {
  return challengeTexts.map((challenge) => buildCatalogText(challenge));
}

export function normalizeCatalogRecord(record: CatalogRecord): CatalogText {
  const difficultyLevel = record.text_dif_level ?? record.text_difficulty_id;
  const difficultyLabel = record.text_dif_desc ?? `Dificultad ${difficultyLevel}`;
  const difficultyTone = record.text_dif_color ?? (difficultyLevel <= 1 ? "emerald" : difficultyLevel === 2 ? "amber" : "rose");

  return {
    id: record.id_text,
    title: record.text_title,
    text: record.text_desc,
    wordCount: countWords(record.text_desc),
    characterCount: record.text_desc.length,
    difficulty: {
      id: record.text_difficulty_id,
      label: difficultyLabel,
      level: difficultyLevel,
      tone: difficultyTone,
    },
  };
}
