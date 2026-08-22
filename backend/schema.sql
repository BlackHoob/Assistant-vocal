

DROP DATABASE IF EXISTS nestor_vocal;

CREATE DATABASE nestor_vocal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nestor_vocal;

CREATE TABLE users (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  name                VARCHAR(255) NOT NULL,
  email               VARCHAR(255) NOT NULL UNIQUE,
  password_hash       VARCHAR(255),
  google_id           VARCHAR(255),
  avatar              VARCHAR(500),
  phone               VARCHAR(50),
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  blocked             TINYINT(1) NOT NULL DEFAULT 0,
  reset_token         VARCHAR(255),
  reset_token_expires DATETIME,

  INDEX idx_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



CREATE TABLE admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('superadmin', 'admin') NOT NULL DEFAULT 'admin',
  last_login    TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO admins (
  username,
  email,
  password_hash,
  role
) VALUES (
  'admin',
  'admin@nestor.local',
  '$2b$12$Cnnh0nQ/kAh13YT8ZSlTPOwO9N4X/7HIiXO3xvsGIIg9Idrao1ry.',
  'superadmin'
);


CREATE TABLE appointments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  userId      INT NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  dateTime    VARCHAR(50) NOT NULL,
  agent       VARCHAR(255),
  quantity    INT NOT NULL DEFAULT 1,
  location    VARCHAR(255),
  status      ENUM('upcoming', 'completed', 'cancelled')
              NOT NULL DEFAULT 'upcoming',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_appointments_user
    FOREIGN KEY (userId)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_appointments_quantity
    CHECK (quantity >= 1),

  INDEX idx_appointments_user (userId),
  INDEX idx_appointments_datetime_status (dateTime, status)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE tickets (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  userId         INT NOT NULL,
  flightNumber   VARCHAR(20),
  airline        VARCHAR(100),
  origin         VARCHAR(10) NOT NULL,
  destination    VARCHAR(10) NOT NULL,
  departureDate  VARCHAR(50),
  arrivalDate    VARCHAR(50),
  price          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency       VARCHAR(10) NOT NULL DEFAULT 'EUR',
  amadeusOfferId VARCHAR(500),
  status         ENUM('upcoming', 'completed', 'cancelled')
                 NOT NULL DEFAULT 'upcoming',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tickets_user
    FOREIGN KEY (userId)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_tickets_price
    CHECK (price >= 0),

  INDEX idx_tickets_user (userId),
  INDEX idx_tickets_status (status)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE documents (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  userId        INT NOT NULL,
  name          VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  file_size     INT,
  mime_type     VARCHAR(100),
  expires_at    DATE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_by_admin TINYINT(1) NOT NULL DEFAULT 0,

  CONSTRAINT fk_documents_user
    FOREIGN KEY (userId)
    REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_documents_user (userId),
  INDEX idx_documents_expires (expires_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE chat_messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  userId     INT NOT NULL,
  role       ENUM('user', 'assistant') NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_chat_messages_user
    FOREIGN KEY (userId)
    REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_chat_messages_user (userId)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE google_auth_codes (
  code       VARCHAR(64) PRIMARY KEY,
  user_id    INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_google_auth_codes_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_google_auth_codes_user (user_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  userId     INT NOT NULL,
  type       ENUM('success', 'info', 'warning', 'error')
             NOT NULL DEFAULT 'info',
  category   ENUM('appointment', 'ticket', 'document', 'system')
             NOT NULL DEFAULT 'system',
  message    VARCHAR(255) NOT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notifications_user
    FOREIGN KEY (userId)
    REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_notifications_user_read (userId, is_read),
  INDEX idx_notifications_user_created (userId, created_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE waitlist (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  userId     INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  date       DATE NOT NULL,
  quantity   INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_waitlist_user
    FOREIGN KEY (userId)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_waitlist_quantity
    CHECK (quantity >= 1),

  CONSTRAINT unique_user_date
    UNIQUE (userId, date)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


SELECT 'nestor_vocal créée avec succès' AS statut;

SHOW TABLES;