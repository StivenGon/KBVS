import { NextResponse } from "next/server";

import { getMySqlPool } from "@/lib/mysql";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const textId = Number(id);

  if (!Number.isFinite(textId)) {
    return NextResponse.json({ message: "Id inválido." }, { status: 400 });
  }

  const body = (await request.json()) as {
    text_title?: string;
    text_desc?: string;
    text_difficulty_id?: number;
    is_active?: boolean | number;
  };

  const updates: string[] = [];
  const values: Array<string | number> = [];

  if (body.text_title !== undefined) {
    updates.push("text_title = ?");
    values.push(body.text_title.trim());
  }

  if (body.text_desc !== undefined) {
    updates.push("text_desc = ?");
    values.push(body.text_desc.trim());
  }

  if (body.text_difficulty_id !== undefined) {
    updates.push("text_difficulty_id = ?");
    values.push(Number(body.text_difficulty_id));
  }

  if (body.is_active !== undefined) {
    updates.push("is_active = ?");
    values.push(body.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return NextResponse.json({ message: "No hay cambios para guardar." }, { status: 400 });
  }

  const pool = getMySqlPool();

  try {
    await pool.execute(`UPDATE textos SET ${updates.join(", ")} WHERE id_text = ?`, [...values, textId]);
    return NextResponse.json({ message: "Texto actualizado." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo actualizar el texto." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const textId = Number(id);

  if (!Number.isFinite(textId)) {
    return NextResponse.json({ message: "Id inválido." }, { status: 400 });
  }

  const pool = getMySqlPool();

  try {
    await pool.execute("DELETE FROM textos WHERE id_text = ?", [textId]);
    return NextResponse.json({ message: "Texto eliminado." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo eliminar el texto." },
      { status: 400 },
    );
  }
}
