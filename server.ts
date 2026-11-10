import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { fetchOfficialIPCA } from './src/services/ibge';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  app.use(express.json());

  // ============================================
  // API ENDPOINTS DO IPCA-CASA
  // ============================================

  // 1. Verificação de integridade da API
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      database: 'firebase-firestore',
    });
  });

  // 2. Consulta Oficial do IBGE via SIDRA com Cache Resiliente
  app.get('/api/ibge', async (req, res) => {
    try {
      const region = (req.query.region as string) || 'N1[all]';
      const force = req.query.force === 'true';
      const metadata = await fetchOfficialIPCA(region, force);
      res.json(metadata);
    } catch {
      res.status(500).json({ error: 'Erro ao consultar serviço oficial do IBGE' });
    }
  });

  // ============================================
  // SERVIDOR DE FRONTEND (Vite Middleware em Dev)
  // ============================================
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IPCA-Casa Server rodando em http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
});
