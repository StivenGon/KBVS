import { NextResponse } from "next/server";

import { getMySqlPool } from "@/lib/mysql";

async function ensureMatchResultsTable() {
  const pool = getMySqlPool();

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS match_results (
      id_match INT UNSIGNED NOT NULL AUTO_INCREMENT,
      player_name VARCHAR(255) NOT NULL,
      wpm INT UNSIGNED NOT NULL,
      accuracy DECIMAL(5, 2) NOT NULL,
      errors INT UNSIGNED NOT NULL,
      match_time INT UNSIGNED NOT NULL,
      winner TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_match),
      KEY idx_match_results_player_name (player_name),
      KEY idx_match_results_winner (winner),
      KEY idx_match_results_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playerName, wpm, accuracy, errors, matchTime, winner } = body;

    // Validate required fields
    if (!playerName || wpm === undefined || accuracy === undefined || errors === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await ensureMatchResultsTable();

    const pool = getMySqlPool();

    // Insert match result into database
    const [result] = await pool.execute(
      `INSERT INTO match_results (player_name, wpm, accuracy, errors, match_time, winner, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        playerName,
        Math.round(wpm),
        Math.round(accuracy),
        errors,
        matchTime || 0,
        winner ? 1 : 0,
      ]
    );

    return NextResponse.json(
      { success: true, message: "Match result saved", result },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving match result:", error);
    return NextResponse.json(
      { error: "Failed to save match result" },
      { status: 500 }
    );
  }
}
