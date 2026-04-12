import { countWords, type CatalogDifficultyTone } from "@/lib/text-catalog";

export type AdminDifficultyRow = {
  id_text_dif: number;
  text_dif_desc: string;
  text_dif_level: number;
  text_dif_color: CatalogDifficultyTone;
};

export type AdminTextRow = {
  id_text: number;
  text_title: string;
  text_desc: string;
  text_difficulty_id: number;
  is_active: number;
  text_dif_desc: string;
  text_dif_level: number;
  text_dif_color: CatalogDifficultyTone;
};

export function normalizeTone(value: unknown): CatalogDifficultyTone {
  return value === "amber" || value === "rose" ? value : "emerald";
}

export function buildTextPreview(text: string) {
  return {
    wordCount: countWords(text),
    characterCount: text.length,
  };
}
