import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Fabrique un middleware d'upload multer qui écrit dans uploads/<folder>.
// Avant, profile.ts (avatars) et documents.ts (pièces jointes) dupliquaient
// chacun leur propre config multer.diskStorage quasi identique — DRY.
export function createUploadMiddleware(
  folder: string,
  buildFilename: (originalName: string) => string,
  maxSizeMb: number
) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(__dirname, `../../uploads/${folder}`);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, buildFilename(file.originalname)),
  });

  return multer({ storage, limits: { fileSize: maxSizeMb * 1024 * 1024 } });
}

// Supprime un fichier uploadé (avatar remplacé, document supprimé...).
// Ne fait rien si le fichier n'existe déjà plus — évite un crash sur un
// chemin périmé.
export function deleteUploadedFile(folder: string, filename: string) {
  const filePath = path.join(__dirname, `../../uploads/${folder}`, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}