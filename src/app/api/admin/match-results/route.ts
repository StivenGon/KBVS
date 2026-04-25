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

export async function GET() {
  try {
    await ensureMatchResultsTable();

    const pool = getMySqlPool();

    const [rows] = await pool.query(
      `SELECT player_name, SUM(wpm) as total_wpm, AVG(accuracy) as avg_accuracy, 
              COUNT(*) as matches, SUM(CASE WHEN winner = 1 THEN 1 ELSE 0 END) as wins
       FROM match_results
       GROUP BY player_name
       ORDER BY wins DESC, avg_accuracy DESC, total_wpm DESC
       LIMIT 100`
    );

    return NextResponse.json(
      { success: true, results: rows },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching match results:", error);
    return NextResponse.json(
      { error: "Failed to fetch match results" },
      { status: 500 }
    );
  }
}
