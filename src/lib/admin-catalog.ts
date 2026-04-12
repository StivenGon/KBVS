import "server-only";

import { getMySqlPool } from "@/lib/mysql";
import type { AdminDifficultyRow, AdminTextRow } from "@/lib/admin-catalog-shared";

export { buildTextPreview, normalizeTone } from "@/lib/admin-catalog-shared";
export type { AdminDifficultyRow, AdminTextRow } from "@/lib/admin-catalog-shared";

export async function listDifficulties() {
  const pool = getMySqlPool();
  const [rows] = await pool.query(
    `SELECT id_text_dif, text_dif_desc, text_dif_level, text_dif_color
     FROM text_difficulty
     ORDER BY text_dif_level ASC, id_text_dif ASC`,
  );

  return rows as AdminDifficultyRow[];
}

export async function listTexts() {
  const pool = getMySqlPool();
  const [rows] = await pool.query(
    `SELECT
       t.id_text,
       t.text_title,
       t.text_desc,
       t.text_difficulty_id,
       t.is_active,
       d.text_dif_desc,
       d.text_dif_level,
       d.text_dif_color
     FROM textos AS t
     INNER JOIN text_difficulty AS d ON d.id_text_dif = t.text_difficulty_id
     ORDER BY t.id_text DESC`,
  );

  return rows as AdminTextRow[];
}
