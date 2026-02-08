import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Middleware to serve static client files and handle SPA routing
 */
export function serveStatic(app: express.Express): void {
  const distClientPath = path.join(__dirname, '../../../dist/client');

  // Check if dist/client exists (production mode)
  if (fs.existsSync(distClientPath)) {
    // Serve static files from dist/client
    app.use(express.static(distClientPath));

    // SPA fallback - all non-API routes return index.html
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distClientPath, 'index.html'));
    });
  } else {
    // Development mode - Vite dev server handles this
    app.get('*', (_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Frontend not built. Run `npm run build` or use `npm run dev` for development.',
      });
    });
  }
}
