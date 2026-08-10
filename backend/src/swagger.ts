// swagger.ts
// Sert la documentation OpenAPI générée à partir des vraies routes de
// l'API sur /api-docs. À importer et appeler une fois dans index.ts.
//
// Installation requise :
//   npm install swagger-ui-express yamljs
//   npm install -D @types/swagger-ui-express

import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

export function setupSwagger(app: Express): void {
  const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  console.log('📄 Documentation API disponible sur /api-docs');
}