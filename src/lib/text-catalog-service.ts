import { getMySqlPool } from "@/lib/mysql";
import { buildFallbackCatalog, normalizeCatalogRecord, type CatalogText } from "@/lib/text-catalog";

let cachedCatalog: CatalogText[] = buildFallbackCatalog();
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

export async function loadTextCatalog(options?: { forceRefresh?: boolean }) {
  if (!options?.forceRefresh && cachedCatalog.length > 0 && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedCatalog;
  }

  try {
    const pool = getMySqlPool();
    const [rows] = await pool.query(
      `SELECT
        t.id_text,
        t.text_title,
        t.text_desc,
        t.text_difficulty_id,
        d.text_dif_desc,
        d.text_dif_level,
        d.text_dif_color
      FROM textos AS t
      INNER JOIN text_difficulty AS d ON d.id_text_dif = t.text_difficulty_id
      WHERE t.is_active = 1
      ORDER BY d.text_dif_level ASC, t.id_text ASC`,
    );

    cachedCatalog = (rows as Array<Record<string, unknown>>).map((row) =>
      normalizeCatalogRecord({
        id_text: Number(row.id_text),
        text_title: String(row.text_title),
        text_desc: String(row.text_desc),
        text_difficulty_id: Number(row.text_difficulty_id),
        text_dif_desc: row.text_dif_desc === undefined ? undefined : String(row.text_dif_desc),
        text_dif_level: row.text_dif_level === undefined ? undefined : Number(row.text_dif_level),
        text_dif_color: row.text_dif_color === undefined ? undefined : String(row.text_dif_color) as "emerald" | "amber" | "rose",
      }),
    );
    cachedAt = Date.now();

    return cachedCatalog;
  } catch {
    return cachedCatalog.length > 0 ? cachedCatalog : buildFallbackCatalog();
  }
}

export function getCachedTextCatalog() {
  return cachedCatalog;
}
