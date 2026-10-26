import { Router } from 'express';
import { renderPage, esc } from '../lib/render';
import { apiGet, apiPost, apiPatch } from '../lib/api-client';

export const appointmentsRouter = Router();

/** La API serializa value objects como { value } â€” helper tolerante. */
const v = (x: any) => x?.value ?? x ?? '';

appointmentsRouter.get('/', async (req, res) => {
  const token = (req as any).adminToken;
  const status = (req.query.status as string) ?? '';
  const qs = status ? `?status=${status}` : '';

  // Citas + catálogos para resolver IDs → nombres
  const [items, patients, doctors] = await Promise.all([
    apiGet(`/appointments${qs}`, token).catch(() => []),
    apiGet(`/patients`, token).catch(() => []),
    apiGet(`/doctors`, token).catch(() => []),
  ]);

  const patientName = new Map<string, string>(
    patients.map((p: any) => [p.id, `${p.name?.name ?? ''} ${p.name?.lastname ?? ''}`.trim()]),
  );
  const doctorName = new Map<string, string>(
    doctors.map((d: any) => [d.id, `${d.name?.name ?? ''} ${d.name?.lastname ?? ''}`.trim()]),
  );

  const body = `
    <h1 class="text-2xl font-bold mb-6">📅 Citas</h1>

    <div class="mb-4 flex flex-wrap gap-2">
      ${['', 'pending', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled']
        .map((s) => `<a href="/appointments?status=${s}" class="px-3 py-1 rounded text-sm ${s === status ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}">${s || 'todas'}</a>`)
        .join('')}
    </div>

    <div class="bg-white rounded shadow overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-100">
          <tr>
            <th class="text-left p-2">Fecha</th>
            <th class="text-left p-2">Hora</th>
            <th class="text-left p-2">Doctor</th>
            <th class="text-left p-2">Paciente</th>
            <th class="text-left p-2">Estado</th>
            <th class="text-left p-2">Origen</th>
            <th class="text-left p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0
            ? '<tr><td colspan="7" class="p-4 text-center text-gray-400">Sin citas</td></tr>'
            : items.map((a: any) => {
                const st = v(a.status);
                const pid = v(a.patientId);
                const did = v(a.doctorId);
                return `
            <tr class="border-b">
              <td class="p-2">${v(a.date)}</td>
              <td class="p-2">${v(a.time)}</td>
              <td class="p-2">${esc(doctorName.get(did) ?? String(did).slice(0, 8))}</td>
              <td class="p-2">${esc(patientName.get(pid) ?? String(pid).slice(0, 8))}</td>
              <td class="p-2"><span class="px-2 py-1 rounded text-xs ${statusBadge(st)}">${st}</span></td>
              <td class="p-2"><span class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">${v(a.source)}</span></td>
              <td class="p-2">
                ${['pending', 'confirmed'].includes(st) ? `
                  <button hx-post="/appointments/${a.id}/cancel-htmx" hx-swap="none"
                          class="text-red-600 hover:text-red-800 text-xs border border-red-200 px-2 py-1 rounded">
                    Cancelar
                  </button>
                ` : ''}
              </td>
            </tr>`;
              }).join('')}
        </tbody>
      </table>
    </div>
  `;
  res.send(renderPage('Citas', body, '/appointments'));
});

// HTMX envÃ­a POST (el botÃ³n usa hx-post)
appointmentsRouter.post('/:id/cancel-htmx', async (req, res) => {
  const token = (req as any).adminToken;
  try {
    await apiPatch(`/appointments/${req.params.id}/cancel`, { reason: 'cancelada desde panel' }, token);
    // HX-Refresh provoca recarga completa -> la tabla muestra el nuevo estado
    res.set('HX-Refresh', 'true');
    res.status(204).end();
  } catch (e: any) {
    res.status(500).send('No se pudo cancelar');
  }
});

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    checked_in: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-green-100 text-green-800',
    no_show: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    expired: 'bg-gray-100 text-gray-500',
  };
  return map[status] ?? 'bg-gray-100';
}
