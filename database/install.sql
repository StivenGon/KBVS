CREATE DATABASE IF NOT EXISTS kbvs
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kbvs;

CREATE TABLE IF NOT EXISTS text_difficulty (
  id_text_dif INT UNSIGNED NOT NULL AUTO_INCREMENT,
  text_dif_desc VARCHAR(100) NOT NULL,
  text_dif_level INT UNSIGNED NOT NULL,
  text_dif_color ENUM('emerald', 'amber', 'rose') NOT NULL DEFAULT 'emerald',
  PRIMARY KEY (id_text_dif),
  UNIQUE KEY uq_text_difficulty_level (text_dif_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS textos (
  id_text INT UNSIGNED NOT NULL AUTO_INCREMENT,
  text_title VARCHAR(150) NOT NULL,
  text_desc TEXT NOT NULL,
  text_difficulty_id INT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_text),
  KEY idx_textos_difficulty_id (text_difficulty_id),
  CONSTRAINT fk_textos_text_difficulty
    FOREIGN KEY (text_difficulty_id) REFERENCES text_difficulty (id_text_dif)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO text_difficulty (id_text_dif, text_dif_desc, text_dif_level, text_dif_color)
VALUES
  (1, 'Baja', 1, 'emerald'),
  (2, 'Media', 2, 'amber'),
  (3, 'Alta', 3, 'rose')
ON DUPLICATE KEY UPDATE
  text_dif_desc = VALUES(text_dif_desc),
  text_dif_level = VALUES(text_dif_level),
  text_dif_color = VALUES(text_dif_color);

INSERT INTO textos (id_text, text_title, text_desc, text_difficulty_id, is_active)
VALUES
  (1, 'Ronda de control', 'En la arena de mecanografía, cada palabra cuenta y cada pausa revela el ritmo real del jugador.', 1, 1),
  (2, 'Ronda de precisión', 'Las teclas rápidas no ganan solas; gana quien mantiene precisión, ritmo y control bajo presión.', 2, 1),
  (3, 'Ronda maestro', 'Dos rivales, una sola línea de texto y un maestro observando cada error en tiempo real.', 3, 1)
ON DUPLICATE KEY UPDATE
  text_title = VALUES(text_title),
  text_desc = VALUES(text_desc),
  text_difficulty_id = VALUES(text_difficulty_id),
  is_active = VALUES(is_active);

CREATE TABLE IF NOT EXISTS match_results (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;