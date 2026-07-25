-- ─────────────────────────────────────────────────────────────────────────
-- Nestor Vocal — Nettoyage des FK redondantes
--
-- 1) Ajoute fk_chat_messages_user (oubliée dans la version idempotente
--    précédente — chat_messages n'avait alors que l'ancienne _ibfk_1).
-- 2) Supprime les FK auto-générées par MySQL (*_ibfk_1) UNIQUEMENT une fois
--    que leur équivalent nommé existe bien — jamais la table ne se retrouve
--    sans aucune protection FK entre les deux étapes.
--
-- Idempotent comme le précédent : relançable sans risque.
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

-- Ne supprime l'ancienne FK que si la nouvelle (nommée) existe déjà —
-- garde-fou pour ne jamais laisser une table temporairement sans FK du tout.
DROP PROCEDURE IF EXISTS drop_fk_if_replaced $$
CREATE PROCEDURE drop_fk_if_replaced(
  IN targetTable VARCHAR(128),
  IN oldConstraintName VARCHAR(128),
  IN newConstraintName VARCHAR(128)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = newConstraintName
  ) AND EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = oldConstraintName
  ) THEN
    SET @sql = CONCAT('ALTER TABLE ', targetTable, ' DROP FOREIGN KEY ', oldConstraintName);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

-- ── 1) Ajoute la FK manquante sur chat_messages ──
CALL add_constraint_if_missing('fk_chat_messages_user',
  'ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE');

-- ── 2) Supprime les anciennes FK auto-générées, maintenant redondantes ──
CALL drop_fk_if_replaced('appointments',  'appointments_ibfk_1',  'fk_appointments_user');
CALL drop_fk_if_replaced('tickets',       'tickets_ibfk_1',       'fk_tickets_user');
CALL drop_fk_if_replaced('documents',     'documents_ibfk_1',     'fk_documents_user');
CALL drop_fk_if_replaced('waitlist',      'waitlist_ibfk_1',      'fk_waitlist_user');
CALL drop_fk_if_replaced('chat_messages', 'chat_messages_ibfk_1', 'fk_chat_messages_user');

-- Nettoyage : ces procédures ne servent qu'à ce script
DROP PROCEDURE IF EXISTS add_constraint_if_missing;
DROP PROCEDURE IF EXISTS drop_fk_if_replaced;