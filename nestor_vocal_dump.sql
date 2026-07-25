-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: nestor_vocal
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('superadmin','admin') DEFAULT 'admin',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES (1,'admin','admin@nestor.local','$2b$12$Cnnh0nQ/kAh13YT8ZSlTPOwO9N4X/7HIiXO3xvsGIIg9Idrao1ry.','superadmin','2026-07-20 21:31:35','2026-06-12 18:14:06');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `dateTime` varchar(50) NOT NULL,
  `agent` varchar(255) DEFAULT NULL,
  `quantity` int DEFAULT '1',
  `location` varchar(255) DEFAULT NULL,
  `status` enum('upcoming','completed','cancelled') DEFAULT 'upcoming',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_userId` (`userId`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointments`
--

LOCK TABLES `appointments` WRITE;
/*!40000 ALTER TABLE `appointments` DISABLE KEYS */;
/*!40000 ALTER TABLE `appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_messages`
--

DROP TABLE IF EXISTS `chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `role` enum('user','assistant') NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_userId` (`userId`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_messages`
--

LOCK TABLES `chat_messages` WRITE;
/*!40000 ALTER TABLE `chat_messages` DISABLE KEYS */;
INSERT INTO `chat_messages` VALUES (1,1,'assistant','Bien sûr, je serais ravi de vous aider à réserver un vol de Paris à Abidjan. Pouvez-vous me préciser les dates de voyage souhaitées et le nombre de passagers ? Je vous propose des vols avec des compagnies aériennes de luxe telles que Air France ou Brussels Airlines. Je vous fournirai les tarifs et les horaires disponibles pour que vous puissiez choisir le vol qui vous convient le mieux.','2026-06-12 19:16:20'),(2,1,'assistant','Bienvenue chez Selectour Alltour ! Je serais ravi de vous aider à réserver un vol de Paris à Abidjan. Pouvez-vous me communiquer vos dates de voyage préférées et le nombre de passagers ? Je vous propose des options de vols avec les meilleures compagnies aériennes pour un trajet confortable et sécurisé.','2026-06-15 16:14:36'),(3,1,'assistant','I\'d be delighted to assist you with booking a flight from Paris to Abidjan. For your convenience, I\'ve searched for available options and found a suitable flight with Air France, departing from Paris Charles de Gaulle Airport and arriving at Félix-Houphouët-Boigny International Airport. Shall I proceed with the booking, or would you like me to explore alternative flights? Please let me know your preferred travel dates and class of service.','2026-06-15 16:16:15'),(4,1,'assistant','I ni ce, yɛlɛma Paris na Abidjan, a bɛ bɔn, a ka taa kan. Ni bɛ yɛn bɛɛ wɛrɛ wɛrɛ, wɛrɛ ka taa, Air France, Brussels Airlines, ni Turkish Airlines. An bɛ yɛn bɛɛ sɛnɛ, an ka taa kan, sɛnɛ ka taa, Selectour Alltour ka an bɔ.','2026-06-15 21:33:33'),(5,1,'assistant','I ni ce! N ka di ya, ka kɛnɛya anw tɔgɔ. I ka bɛn, n\'sa kɛnɛ a la, \"Bienvenue chez Selectour Alltour\"! N tɔgɔ ni anw bɛɛ, ka a fɔlɔ a la, on va vous aider à trouver votre voyage de rêve.','2026-06-15 21:33:42'),(6,1,'assistant','I ni sogoma ! Yɛlɛma Paris ka Abidjan, n\'ta don ni bɛɛ sɔrɔ bɛn. N ka tɔ a yɛlɛma kan, ka dɔnkilidii don, \"vol\" lajɛ. O bɛɛ sɔrɔ bɛn, n ka tɔ a la \"tarif\" lajɛ.','2026-06-15 22:27:19'),(7,1,'assistant','Il semble qu\'il n\'y ait pas de créneaux horaires déjà pris pour aujourd\'hui. Pour prendre rendez-vous, j\'ai besoin de savoir à quelle heure vous aimeriez vous rendre disponible et pour quelle raison. Pouvez-vous me fournir ces informations ?','2026-07-11 11:33:55'),(8,1,'assistant','Votre rendez-vous a été pris avec succès pour le 13 juillet 2026 à 15h. Vous pouvez consulter vos rendez-vous à tout moment en me demandant de les afficher. Y a-t-il autre chose que je puisse faire pour vous ?','2026-07-11 11:34:29'),(9,1,'assistant','Vous avez deux rendez-vous enregistrés : \n- Un rendez-vous le 17 juin 2026 à 15h avec Mme Koné pour prendre un billet, qui est déjà terminé.\n- Un rendez-vous le 13 juillet 2026 à 15h, qui est à venir.','2026-07-11 11:34:52'),(10,1,'assistant','Votre rendez-vous du 14 juillet 2026 à 15h a été pris avec succès. Vous avez désormais trois rendez-vous enregistrés : \n- Un rendez-vous le 17 juin 2026 à 15h avec Mme Koné pour prendre un billet, qui est déjà terminé.\n- Un rendez-vous le 13 juillet 2026 à 15h, qui est à venir.\n- Un rendez-vous le 14 juillet 2026 à 15h, qui est également à venir.','2026-07-11 11:40:48'),(11,1,'assistant','Vous avez désormais quatre rendez-vous enregistrés : \n- Un rendez-vous le 17 juin 2026 à 15h avec Mme Koné pour prendre un billet, qui est déjà terminé.\n- Un rendez-vous le 13 juillet 2026 à 15h, qui est à venir.\n- Un rendez-vous le 14 juillet 2026 à 15h, qui est également à venir.\n- Un rendez-vous le 16 juillet 2026 à 15h, qui est également à venir.','2026-07-11 11:48:59'),(12,1,'assistant','Votre rendez-vous du 17 juillet 2026 à 15h a été pris avec succès. Vous avez désormais cinq rendez-vous enregistrés : \n- Un rendez-vous le 17 juin 2026 à 15h avec Mme Koné pour prendre un billet, qui est déjà terminé.\n- Un rendez-vous le 13 juillet 2026 à 15h, qui est à venir.\n- Un rendez-vous le 14 juillet 2026 à 15h, qui est également à venir.\n- Un rendez-vous le 16 juillet 2026 à 15h, qui est également à venir.\n- Un rendez-vous le 17 juillet 2026 à 15h, qui est également à venir.','2026-07-11 11:58:48'),(13,1,'assistant','Je vois que nous avons plusieurs options pour un vol de Paris à Abidjan le 20 juillet 2026. Les prix varient de 194,62 € à 527,59 €, selon la compagnie aérienne et le nombre d\'escales. Puis-je vous aider à choisir un vol qui correspond à vos besoins et à votre budget ?','2026-07-19 08:29:07'),(14,1,'assistant','Votre billet pour le vol AF770 de Paris à Abidjan le 20 juillet 2026 a été réservé avec succès. Le prix du billet est de 194,62 €. Vous pouvez maintenant consulter vos billets enregistrés en utilisant la fonction \"list_my_tickets\".','2026-07-19 08:29:52'),(15,1,'assistant','Votre billet pour le vol ZZ5217 de Paris à Abidjan le 20 juillet 2026 a été réservé avec succès. Le prix du billet est de 200,13 €. Vous pouvez maintenant consulter vos billets enregistrés en utilisant la fonction \"list_my_tickets\".','2026-07-19 14:04:16'),(16,1,'assistant','Votre rendez-vous pour demain à 18h a été pris avec succès. Vous pouvez maintenant consulter vos rendez-vous en utilisant la fonction \"list_my_appointments\".','2026-07-19 14:05:05');
/*!40000 ALTER TABLE `chat_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` int DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `expires_at` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_by_admin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_userId` (`userId`),
  CONSTRAINT `documents_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `type` enum('success','info','warning','error') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `category` enum('appointment','ticket','document','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `message` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_unread` (`userId`,`is_read`),
  KEY `idx_user_created` (`userId`,`created_at`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,1,'success','appointment','Rendez-vous \"Rendez-vous\" confirmé le 13 juillet à 15:00',0,'2026-07-11 13:34:28'),(2,1,'info','appointment','Rendez-vous \"Rendez-vous\" le lundi 13 juillet',0,'2026-07-11 13:35:14'),(3,1,'success','appointment','Rendez-vous \"Rendez-vous\" confirmé le 14 juillet à 15:00',0,'2026-07-11 13:40:47'),(4,1,'info','appointment','Rendez-vous \"Rendez-vous\" le mardi 14 juillet',0,'2026-07-11 13:40:50'),(5,1,'success','appointment','Rendez-vous \"Rendez-vous\" confirmé le 16 juillet à 15:00',0,'2026-07-11 13:48:58'),(6,1,'info','appointment','Rendez-vous \"Rendez-vous\" le jeudi 16 juillet',0,'2026-07-11 13:49:07'),(7,1,'success','appointment','Rendez-vous \"Rendez-vous\" confirmé le 17 juillet à 15:00',0,'2026-07-11 13:58:48'),(8,1,'success','ticket','Billet BA0109 CDG → JFK enregistré',0,'2026-07-19 09:31:46'),(9,1,'success','ticket','Billet AF770 CDG → ABJ enregistré',0,'2026-07-19 10:29:52'),(10,1,'info','ticket','Vol AF770 CDG → ABJ le 20 juil.',0,'2026-07-19 10:30:12'),(11,1,'success','ticket','Billet ZZ5217 CDG → ABJ enregistré',0,'2026-07-19 16:04:11'),(12,1,'info','ticket','Vol ZZ5217 CDG → ABJ le 20 juil.',0,'2026-07-19 16:04:36'),(13,1,'success','appointment','Rendez-vous \"Rendez-vous\" confirmé le 20 juillet à 18:00',0,'2026-07-19 16:05:05'),(14,1,'info','appointment','Rendez-vous \"Rendez-vous\" le lundi 20 juillet',0,'2026-07-19 16:05:14'),(17,1,'success','appointment','Inscription en liste d\'attente confirmée pour le 21 juillet (position #1)',0,'2026-07-20 23:55:20'),(18,1,'success','appointment','Rendez-vous \"Prendre un billet\" confirmé le 21 juillet à 01:21',0,'2026-07-21 01:21:18'),(19,1,'info','system','bonjour',0,'2026-07-21 01:51:49'),(20,1,'success','appointment','Inscription en liste d\'attente confirmée pour le 22 juillet (position #1)',0,'2026-07-21 02:03:15'),(21,1,'info','document','Un nouveau document (other) a été ajouté par l\'agence',0,'2026-07-21 04:33:34');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tickets`
--

DROP TABLE IF EXISTS `tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `flightNumber` varchar(20) DEFAULT NULL,
  `airline` varchar(100) DEFAULT NULL,
  `origin` varchar(10) NOT NULL,
  `destination` varchar(10) NOT NULL,
  `departureDate` varchar(50) DEFAULT NULL,
  `arrivalDate` varchar(50) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT '0.00',
  `currency` varchar(10) DEFAULT 'EUR',
  `amadeusOfferId` varchar(500) DEFAULT NULL,
  `status` enum('upcoming','completed','cancelled') DEFAULT 'upcoming',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_userId` (`userId`),
  CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tickets`
--

LOCK TABLES `tickets` WRITE;
/*!40000 ALTER TABLE `tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `avatar` varchar(500) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `blocked` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_google_id` (`google_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Dupont ','dupont@gmail.com','$2b$12$.FJLBnhl/seEfo3RW4H/6evscR1kzlhrd637kKOoNHBZ2DPHWEm46',NULL,NULL,NULL,'2026-06-12 18:19:45','2026-07-20 23:42:44',0);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `waitlist`
--

DROP TABLE IF EXISTS `waitlist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `waitlist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `quantity` int DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_date` (`userId`,`date`),
  CONSTRAINT `waitlist_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `waitlist`
--

LOCK TABLES `waitlist` WRITE;
/*!40000 ALTER TABLE `waitlist` DISABLE KEYS */;
INSERT INTO `waitlist` VALUES (1,1,'Dupont ','2026-06-13',1,'2026-06-12 18:23:54'),(2,1,'Dupont ','2026-06-16',1,'2026-06-15 22:01:01'),(3,1,'Dupont ','2026-06-17',1,'2026-06-15 22:06:27');
/*!40000 ALTER TABLE `waitlist` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-23 14:57:46
