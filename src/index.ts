import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRoutes from './routes/health.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);

app.listen(PORT, () => {
  console.log(`Servidor InkPixi escuchando en http://localhost:${PORT}`);
});