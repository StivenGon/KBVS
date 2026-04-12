import { NextResponse } from "next/server";

import { getMySqlPool } from "@/lib/mysql";

export async function GET() {
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

  return NextResponse.json({ texts: rows });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    text_title?: string;
    text_desc?: string;
    text_difficulty_id?: number;
    is_active?: boolean | number;
  };

  const title = body.text_title?.trim();
  const description = body.text_desc?.trim();
  const difficultyId = Number(body.text_difficulty_id);
  const isActive = body.is_active === undefined ? 1 : body.is_active ? 1 : 0;

  if (!title || !description || !Number.isFinite(difficultyId)) {
    return NextResponse.json({ message: "Datos de texto inválidos." }, { status: 400 });
  }

  const pool = getMySqlPool();
  try {
    const [result] = await pool.execute(
      `INSERT INTO textos (text_title, text_desc, text_difficulty_id, is_active)
       VALUES (?, ?, ?, ?)` ,
      [title, description, difficultyId, isActive],
    );

    return NextResponse.json({ message: "Texto creado.", result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo crear el texto." },
      { status: 400 },
    );
  }
}
