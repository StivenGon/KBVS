import { NextResponse } from "next/server";

import { getMySqlPool } from "@/lib/mysql";
import { normalizeTone } from "@/lib/admin-catalog";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const difficultyId = Number(id);

  if (!Number.isFinite(difficultyId)) {
    return NextResponse.json({ message: "Id inválido." }, { status: 400 });
  }

  const body = (await request.json()) as {
    text_dif_desc?: string;
    text_dif_level?: number;
    text_dif_color?: string;
  };

  const updates: string[] = [];
  const values: Array<string | number> = [];

  if (body.text_dif_desc !== undefined) {
    updates.push("text_dif_desc = ?");
    values.push(body.text_dif_desc.trim());
  }

  if (body.text_dif_level !== undefined) {
    updates.push("text_dif_level = ?");
    values.push(Number(body.text_dif_level));
  }

  if (body.text_dif_color !== undefined) {
    updates.push("text_dif_color = ?");
    values.push(normalizeTone(body.text_dif_color));
  }

  if (updates.length === 0) {
    return NextResponse.json({ message: "No hay cambios para guardar." }, { status: 400 });
  }

  const pool = getMySqlPool();

  try {
    await pool.execute(`UPDATE text_difficulty SET ${updates.join(", ")} WHERE id_text_dif = ?`, [...values, difficultyId]);
    return NextResponse.json({ message: "Dificultad actualizada." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo actualizar la dificultad." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const difficultyId = Number(id);

  if (!Number.isFinite(difficultyId)) {
    return NextResponse.json({ message: "Id inválido." }, { status: 400 });
  }

  const pool = getMySqlPool();

  try {
    await pool.execute("DELETE FROM text_difficulty WHERE id_text_dif = ?", [difficultyId]);
    return NextResponse.json({ message: "Dificultad eliminada." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo eliminar la dificultad." },
      { status: 400 },
    );
  }
}
