import { NextResponse } from "next/server";

import { getMySqlPool } from "@/lib/mysql";
import { normalizeTone } from "@/lib/admin-catalog";

export async function GET() {
  const pool = getMySqlPool();
  const [rows] = await pool.query(
    `SELECT id_text_dif, text_dif_desc, text_dif_level, text_dif_color
     FROM text_difficulty
     ORDER BY text_dif_level ASC, id_text_dif ASC`,
  );

  return NextResponse.json({ difficulties: rows });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    text_dif_desc?: string;
    text_dif_level?: number;
    text_dif_color?: string;
  };

  const label = body.text_dif_desc?.trim();
  const level = Number(body.text_dif_level);
  const tone = normalizeTone(body.text_dif_color);

  if (!label || !Number.isFinite(level) || level < 1) {
    return NextResponse.json({ message: "Datos de dificultad inválidos." }, { status: 400 });
  }

  const pool = getMySqlPool();
  const [result] = await pool.execute(
    `INSERT INTO text_difficulty (text_dif_desc, text_dif_level, text_dif_color)
     VALUES (?, ?, ?)` ,
    [label, level, tone],
  );

  return NextResponse.json({ message: "Dificultad creada.", result }, { status: 201 });
}
