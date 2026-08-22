import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ValidationError } from '../errors/AppError';

// Types MIME autorisés par défaut : images courantes et PDF. Un appelant
// peut restreindre davantage (ex. avatars : uniquement des images) en
// passant sa propre liste au dernier paramètre de createUploadMiddleware.
const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

// Extrait en fonction testable séparément (voir fileUpload.test.ts) :
// rejette tout type de fichier hors liste blanche avant même l'écriture
// sur le disque. Sans ce filtre, un fichier .html ou .svg contenant du
// JavaScript pouvait être uploadé puis exécuté par le navigateur d'une
// victime, /uploads étant servi en statique par Express (voir index.ts).
export function createFileFilter(allowedMimeTypes: string[]): multer.Options['fileFilter'] {
  return (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new ValidationError(`Type de fichier non autorisé : ${file.mimetype}`));
      return;
    }
    cb(null, true);
  };
}

// Fabrique un middleware d'upload multer qui écrit dans uploads/<folder>.
// Avant, profile.ts (avatars) et documents.ts (pièces jointes) dupliquaient
// chacun leur propre config multer.diskStorage quasi identique — DRY.
export function createUploadMiddleware(
  folder: string,
  buildFilename: (originalName: string) => string,
  maxSizeMb: number,
  allowedMimeTypes: string[] = DEFAULT_ALLOWED_MIME_TYPES
) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(__dirname, `../../uploads/${folder}`);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, buildFilename(file.originalname)),
  });

  return multer({
    storage,
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: createFileFilter(allowedMimeTypes),
  });
}

// Supprime un fichier uploadé (avatar remplacé, document supprimé...).
// Ne fait rien si le fichier n'existe déjà plus — évite un crash sur un
// chemin périmé.
export function deleteUploadedFile(folder: string, filename: string) {
  const filePath = path.join(__dirname, `../../uploads/${folder}`, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}