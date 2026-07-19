-- ============================================================
-- NESTOR VOCAL — Schéma MySQL complet (sans Appwrite)
-- ============================================================

DROP DATABASE IF EXISTS nestor_vocal;
CREATE DATABASE nestor_vocal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nestor_vocal;

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  google_id     VARCHAR(255),
  avatar        VARCHAR(500),
  phone         VARCHAR(50),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ADMINS ───────────────────────────────────────────────────
CREATE TABLE admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('superadmin','admin') DEFAULT 'admin',
  last_login    TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin par défaut : admin / Admin123!
INSERT INTO admins (username, email, password_hash, role) VALUES (
  'admin', 'admin@nestor.local',
  '$2b$12$Cnnh0nQ/kAh13YT8ZSlTPOwO9N4X/7HIiXO3xvsGIIg9Idrao1ry.',
  'superadmin'
);

-- ── APPOINTMENTS ─────────────────────────────────────────────
CREATE TABLE appointments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  userId      INT NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  dateTime    VARCHAR(50) NOT NULL,
  location    VARCHAR(255),
  status      ENUM('upcoming','completed','cancelled') DEFAULT 'upcoming',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── TICKETS ──────────────────────────────────────────────────
CREATE TABLE tickets (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  userId         INT NOT NULL,
  flightNumber   VARCHAR(20),
  airline        VARCHAR(100),
  origin         VARCHAR(10) NOT NULL,
  destination    VARCHAR(10) NOT NULL,
  departureDate  VARCHAR(50),
  arrivalDate    VARCHAR(50),
  price          DECIMAL(10,2) DEFAULT 0.00,
  currency       VARCHAR(10) DEFAULT 'EUR',
  amadeusOfferId VARCHAR(500),
  status         ENUM('upcoming','completed','cancelled') DEFAULT 'upcoming',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── DOCUMENTS ────────────────────────────────────────────────
CREATE TABLE documents (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  userId     INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  file_path  VARCHAR(500) NOT NULL,
  file_size  INT,
  mime_type  VARCHAR(100),
  expires_at DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── CHAT MESSAGES ────────────────────────────────────────────
CREATE TABLE chat_messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  userId     INT NOT NULL,
  role       ENUM('user','assistant') NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PROFILE ──────────────────────────────────────────────────
-- (inclus dans users, pas de table séparée)

SELECT 'nestor_vocal créée ✓' AS statut;
SHOW TABLES;


CREATE TABLE IF NOT EXISTS waitlist (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  userId     INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  date       DATE NOT NULL,
  quantity   INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_date (userId, date)
);
