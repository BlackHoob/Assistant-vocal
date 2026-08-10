import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool({
  host:             process.env.DB_HOST,
  user:             process.env.DB_USER,
  password:         process.env.DB_PASS,
  database:         process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  charset:          'utf8mb4',
});

// La vérification de connexion au chargement du module n'a de sens que
// quand l'app démarre réellement (via index.ts). En test, ce fichier est
// importé indirectement (routes → pool) mais aucune vraie base n'est
// disponible ni nécessaire — sans ce garde-fou, Jest se termine avant que
// cette tentative de connexion asynchrone n'aboutisse, ce qui produit des
// erreurs de "teardown" bruyantes mais sans rapport avec les tests eux-mêmes.
if (process.env.NODE_ENV !== 'test') {
  pool.getConnection()
    .then(conn => {
      console.log('MySQL connecté');
      conn.release();
    })
    .catch(err => {
      console.error('Erreur MySQL:', err.message);
    });
}