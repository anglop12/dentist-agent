import express from 'express';
import { dashboardRouter } from './routes/dashboard';
import { appointmentsRouter } from './routes/appointments';
import { patientsRouter } from './routes/patients';
import { agentRouter } from './routes/agent';

const app = express();
const PORT = parseInt(process.env.PANEL_PORT ?? '4000', 10);
process.env.API_URL ||= 'http://localhost:3000';
const API_URL = process.env.API_URL;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Inyecta config del API a cada request
app.use((req, _res, next) => {
  (req as any).apiUrl = API_URL;
  (req as any).adminToken = ADMIN_TOKEN;
  next();
});

app.get('/', (_req, res) => res.redirect('/dashboard'));

app.use('/dashboard', dashboardRouter);
app.use('/appointments', appointmentsRouter);
app.use('/patients', patientsRouter);
app.use('/agent', agentRouter);

// Health propio del panel
app.get('/panelz', (_req, res) => res.json({ panel: 'ok', api: API_URL }));

app.listen(PORT, () => {
  console.log(`🖥️  Panel:  http://localhost:${PORT}`);
  console.log(`🔗 API:    ${API_URL}`);
});
