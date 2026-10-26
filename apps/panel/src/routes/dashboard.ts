import { Router } from 'express';
import { layout, renderPage } from '../lib/render';
import { apiGet } from '../lib/api-client';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  const token = (req as any).adminToken;
  const summary = await apiGet('/reporting/summary', token).catch(() => ({
    appointments_total: 0,
    appointments_by_status: {},
    no_show_rate: 0,
    conversion_rate: 0,
    avg_daily_appointments: 0,
    estimated_revenue_cents: 0,
    conversations_active: 0,
    conversations_resolved: 0,
  }));

  const body = `
    <h1 class="text-2xl font-bold mb-6">Dashboard</h1>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white p-4 rounded shadow">
        <div class="text-gray-500 text-sm">Citas totales</div>
        <div class="text-2xl font-bold">${summary.appointments_total}</div>
      </div>
      <div class="bg-white p-4 rounded shadow">
        <div class="text-gray-500 text-sm">Tasa no-show</div>
        <div class="text-2xl font-bold ${summary.no_show_rate > 8 ? 'text-red-600' : ''}">${summary.no_show_rate}%</div>
      </div>
      <div class="bg-white p-4 rounded shadow">
        <div class="text-gray-500 text-sm">Conversion</div>
        <div class="text-2xl font-bold">${summary.conversion_rate}%</div>
      </div>
      <div class="bg-white p-4 rounded shadow">
        <div class="text-gray-500 text-sm">Promedio diario</div>
        <div class="text-2xl font-bold">${summary.avg_daily_appointments}</div>
      </div>
    </div>

    <h2 class="text-xl font-semibold mt-8 mb-4">Por estado</h2>
    <div class="bg-white p-4 rounded shadow">
      <table class="w-full">
        <thead>
          <tr class="border-b">
            <th class="text-left py-2">Estado</th>
            <th class="text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(summary.appointments_by_status)
            .map(([s, n]) => `<tr class="border-b"><td class="py-2">${s}</td><td class="text-right">${n}</td></tr>`)
            .join('')}
        </tbody>
      </table>
    </div>
  `;
  res.send(renderPage('Dashboard', body, '/dashboard'));
});
