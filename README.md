# 🎙️ Nestor Vocal

Assistant concierge vocal intelligent — React + Node.js + **Appwrite**

## Stack

| Couche | Technologies |
|--------|-------------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | Node.js + Express + TypeScript |
| Auth & BDD & Storage | **Appwrite Cloud** |
| APIs | Amadeus (vols), ElevenLabs (STT/TTS), Groq (LLM) |

---

## ⚙️ Configuration Appwrite (Console)

> Projet : **Concierge vocal** — `6a27a14c0005a737962e`  
> Endpoint : `https://fra.cloud.appwrite.io/v1`

### 1. Ajouter une plateforme Web

Console → Settings → Platforms → **Add Platform → Web**
- Name : `Nestor Vocal`
- Hostname : `localhost`

### 2. Activer Google OAuth

Console → Auth → Settings → OAuth2 → **Google**
- Configurer sur [Google Cloud Console](https://console.cloud.google.com)
- URI de redirection : `https://fra.cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/6a27a14c0005a737962e`

### 3. Créer la base de données

Console → Databases → **Create Database**
- Database ID : `nestor_db`

#### Collection `appointments`
Attributes :
| Key | Type | Required |
|-----|------|----------|
| userId | String(36) | ✅ |
| title | String(255) | ✅ |
| description | String(1000) | |
| dateTime | String(50) | ✅ |
| location | String(255) | |
| status | String(20) | ✅ (default: `upcoming`) |

#### Collection `tickets`
Attributes :
| Key | Type | Required |
|-----|------|----------|
| userId | String(36) | ✅ |
| flightNumber | String(20) | |
| airline | String(100) | |
| origin | String(10) | ✅ |
| destination | String(10) | ✅ |
| departureDate | String(50) | |
| arrivalDate | String(50) | |
| price | Float | |
| currency | String(10) | |
| amadeusOfferId | String(500) | |
| status | String(20) | ✅ (default: `upcoming`) |

> **Permissions** sur les deux collections : `Any` en lecture/écriture (ou configurer par userId).

### 4. Créer les buckets Storage

Console → Storage → **Create Bucket**

| Bucket ID | Nom | Permissions |
|-----------|-----|-------------|
| `documents` | Documents | Users (role:member) |
| `avatars` | Avatars | Users (role:member) |

### 5. Créer une API Key (pour le backend)

Console → Settings → API Keys → **Create API Key**
- Scopes : `databases.read`, `databases.write`, `storage.read`, `storage.write`, `users.read`
- Copier dans `backend/.env` → `APPWRITE_API_KEY`

---

## 🚀 Installation

### Backend

```bash
cd backend
copy .env.example .env   # Windows
# Remplir les clés dans .env
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Variables backend (.env)

```env
PORT=4000
FRONTEND_URL=http://localhost:5173
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=6a27a14c0005a737962e
APPWRITE_API_KEY=<votre_api_key>
APPWRITE_DB_ID=nestor_db
APPWRITE_COLLECTION_APPOINTMENTS=appointments
APPWRITE_COLLECTION_TICKETS=tickets
APPWRITE_BUCKET_DOCUMENTS=documents
ELEVENLABS_API_KEY=<votre_clé>
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
GROQ_API_KEY=<votre_clé>
AMADEUS_CLIENT_ID=<votre_clé>
AMADEUS_CLIENT_SECRET=<votre_secret>
```

---

## Architecture Auth

```
Frontend (Appwrite SDK)          Backend (node-appwrite Admin)
─────────────────────            ──────────────────────────────
account.createEmailSession()  →  Appwrite Cloud
account.createJWT()           →  JWT (1h) envoyé dans Authorization header
                              →  authGuard vérifie via account.get()
```

Le frontend gère **Auth + Profil + Avatar** directement via le SDK Appwrite.  
Le backend gère **Voice (STT/TTS/Chat), Appointments, Documents, Tickets** avec vérification JWT.
