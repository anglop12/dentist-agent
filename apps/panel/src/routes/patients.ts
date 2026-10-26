import { Router } from 'express';
import { renderPage, esc } from '../lib/render';
import { apiGet } from '../lib/api-client';

export const patientsRouter = Router();

const v = (x: any) => x?.value ?? x ?? '';

patientsRouter.get('/', async (req, res) => {
  const token = (req as any).adminToken;
  const search = (req.query.search as string) ?? '';
  // La API lista sin bÃºsqueda server-side compleja; filtramos en memoria.
  const all = await apiGet(`/patients`, token).catch(() => []);
  const needle = search.trim().toLowerCase();
  const items = needle
    ? all.filter((p: any) =>
        `${v(p.name?.name)} ${v(p.name?.lastname)} ${v(p.cedula)} ${v(p.phone)} ${v(p.email)}`
          .toLowerCase()
          .includes(needle),
      )
    : all;

  const rows = items.length === 0
    ? '<tr><td colspan="5" class="p-4 text-center text-gray-400">Sin pacientes</td></tr>'
    : items.map((p: any) => `
        <tr class="border-b">
          <td class="p-2">${esc(`${v(p.name?.name)} ${v(p.name?.lastname)}`)}</td>
          <td class="p-2">${esc(String(v(p.cedula)))}</td>
          <td class="p-2">${esc(String(v(p.phone)))}</td>
          <td class="p-2 text-xs">${esc(String(v(p.email)))}</td>
          <td class="p-2 text-xs text-gray-500">${esc(String(v(p.waPhone)))}</td>
        </tr>`).join('');

  const body = `
    <h1 class="text-2xl font-bold mb-6">Pacientes <span class="text-sm text-gray-400">(${items.length})</span></h1>

    <form class="mb-4" action="/patients" method="get">
      <input type="search" name="search" value="${esc(search)}" placeholder="Buscar por nombre, cedula, telefono"
             class="px-3 py-2 rounded border w-full md:w-1/2"
             hx-get="/patients" hx-trigger="input changed delay:400ms from:find input"
             hx-target="#tabla-pacientes" hx-swap="innerHTML">
    </form>

    <div id="tabla-pacientes" class="bg-white rounded shadow overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-100">
          <tr>
            <th class="text-left p-2">Nombre</th>
            <th class="text-left p-2">Cedula</th>
            <th class="text-left p-2">Telefono</th>
            <th class="text-left p-2">Email</th>
            <th class="text-left p-2">WhatsApp</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  res.send(renderPage('Pacientes', body, '/patients'));
});
