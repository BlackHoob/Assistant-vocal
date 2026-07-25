-- ─────────────────────────────────────────────────────────────────────────
-- Nestor Vocal — Contraintes d'intégrité référentielle (version idempotente)
--
-- Contrairement à constraints.sql, ce script vérifie si chaque contrainte
-- existe déjà avant de l'ajouter — il peut être relancé autant de fois que
-- nécessaire sans jamais provoquer d'erreur "Duplicate ... constraint name".
-- ─────────────────────────────────────────────────────────────────────────

DELIMITER $$

DROP PROCEDURE IF EXISTS add_constraint_if_missing $$
CREATE PROCEDURE add_constraint_if_missing(
  IN constraintName VARCHAR(128),
  IN alterStatement TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = constraintName
  ) THEN
    SET @sql = alterStatement;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN targetTable VARCHAR(128),
  IN indexName VARCHAR(128),
  IN createStatement TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = targetTable AND INDEX_NAME = indexName
  ) THEN
    SET @sql = createStatement;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

-- ── Clés étrangères ──
CALL add_constraint_if_missing('fk_appointments_user',
  'ALTER TABLE appointments ADD CONSTRAINT fk_appointments_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE');

CALL add_constraint_if_missing('fk_tickets_user',
  'ALTER TABLE tickets ADD CONSTRAINT fk_tickets_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE');

CALL add_constraint_if_missing('fk_documents_user',
  'ALTER TABLE documents ADD CONSTRAINT fk_documents_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE');

CALL add_constraint_if_missing('fk_notifications_user',
  'ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE');

CALL add_constraint_if_missing('fk_waitlist_user',
  'ALTER TABLE waitlist ADD CONSTRAINT fk_waitlist_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE');

-- ── Contraintes CHECK ──
CALL add_constraint_if_missing('chk_tickets_price',
  'ALTER TABLE tickets ADD CONSTRAINT chk_tickets_price CHECK (price >= 0)');

CALL add_constraint_if_missing('chk_appointments_quantity',
  'ALTER TABLE appointments ADD CONSTRAINT chk_appointments_quantity CHECK (quantity >= 1)');

CALL add_constraint_if_missing('chk_waitlist_quantity',
  'ALTER TABLE waitlist ADD CONSTRAINT chk_waitlist_quantity CHECK (quantity >= 1)');

-- NOTE : ta base a déjà une contrainte UNIQUE sur waitlist(userId, date)
-- sous le nom `unique_user_date` (visible dans ta vérification précédente)
-- — elle fait déjà exactement ce que devait faire `uq_waitlist_user_date`.
-- Pas besoin d'en ajouter une deuxième, elle est donc volontairement omise ici.

-- ── Index ──
CALL add_index_if_missing('appointments', 'idx_appointments_datetime_status',
  'CREATE INDEX idx_appointments_datetime_status ON appointments(dateTime, status)');

CALL add_index_if_missing('tickets', 'idx_tickets_status',
  'CREATE INDEX idx_tickets_status ON tickets(status)');

CALL add_index_if_missing('notifications', 'idx_notifications_user_read',
  'CREATE INDEX idx_notifications_user_read ON notifications(userId, is_read)');

CALL add_index_if_missing('documents', 'idx_documents_expires',
  'CREATE INDEX idx_documents_expires ON documents(expires_at)');

-- Nettoyage : les procédures ne servent qu'à ce script, pas besoin de les garder
DROP PROCEDURE IF EXISTS add_constraint_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
