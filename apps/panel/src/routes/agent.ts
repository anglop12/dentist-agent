import { Router } from 'express';
import { renderPage, esc } from '../lib/render';
import { apiPost } from '../lib/api-client';

export const agentRouter = Router();

agentRouter.get('/', (_req, res) => {
  const body = `
    <h1 class="text-2xl font-bold mb-1">🤖 Agente Conversacional</h1>
    <p class="text-gray-500 text-sm mb-4">Escribe como si fueras un paciente. El agente usa tools reales (buscar paciente, disponibilidad, crear cita).</p>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div class="lg:col-span-3">
        <div id="chat" class="bg-white rounded shadow p-4 h-[60vh] overflow-y-auto space-y-3 flex flex-col">
          <div class="text-gray-400 text-center my-auto">Escribe un mensaje para empezar 👇</div>
        </div>
      </div>
      <div class="space-y-3">
        <div class="bg-white rounded shadow p-3">
          <label class="block text-xs text-gray-500 mb-1">Canal</label>
          <select id="channel" name="channel" class="w-full border rounded px-2 py-1 text-sm">
            <option value="web" selected>web</option>
            <option value="whatsapp">whatsapp</option>
          </select>
        </div>
        <div class="bg-white rounded shadow p-3">
          <label class="block text-xs text-gray-500 mb-1">Tu teléfono (externalId)</label>
          <input id="externalId" name="externalId" value="+584141234567"
                 class="w-full border rounded px-2 py-1 text-sm font-mono">
        </div>
        <button hx-post="/agent/reset" hx-target="#chat" hx-swap="innerHTML"
                class="w-full bg-gray-100 hover:bg-gray-200 rounded px-2 py-2 text-sm">
          🗑️ Limpiar chat
        </button>
      </div>
    </div>

    <!-- hx-include arrastra canal + externalId (viven fuera del form) -->
    <form hx-post="/agent/send" hx-target="#chat" hx-swap="beforeend scroll:bottom"
          hx-include="#channel, #externalId"
          hx-on::after-request="document.getElementById('text').value = ''; document.getElementById('text').focus()"
          class="mt-4 flex gap-2">
      <input id="text" name="text" autocomplete="off" placeholder='Ej: "hola", "quiero una cita el viernes"...'
             class="flex-1 border rounded px-3 py-2" autofocus />
      <button class="bg-blue-600 hover:bg-blue-700 text-white rounded px-6 py-2">Enviar</button>
    </form>
  `;
  res.send(renderPage('Agente', body, '/agent'));
});

/** POST que el formulario HTMX invoca; devuelve SOLO las burbujas HTML. */
agentRouter.post('/send', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  const channel = String(req.body?.channel ?? '').trim() || 'web';
  const externalId = String(req.body?.externalId ?? '').trim();

  if (!text) return res.status(400).send(bubble('user', '(mensaje vacío)'));

  // Sin identidad no hay conversación válida — avisar en el chat, no tragárselo.
  if (!externalId || !/^\+?\d{8,15}$/.test(externalId)) {
    return res.send(
      bubble(
        'system',
        '⚠️ Escribe tu teléfono en formato internacional (ej. +584141234567) en el panel de la derecha y vuelve a enviar.',
      ),
    );
  }

  let reply: string;
  try {
    const api = await apiPost('/conversation/message', { channel, externalId, text });
    reply = api.reply ?? JSON.stringify(api);
  } catch (e: any) {
    reply = `⚠️ Error llamando a la API: ${e?.message ?? e}`;
  }
  res.send(bubble('user', text) + bubble('assistant', reply));
});

agentRouter.post('/reset', (_req, res) => {
  res.send('<div class="text-gray-400 text-center my-auto">Chat limpio. Escribe abajo 👇</div>');
});

function bubble(role: 'user' | 'assistant' | 'system', text: string): string {
  if (role === 'system') {
    return `
    <div class="flex justify-center">
      <div class="max-w-[90%] rounded-lg px-4 py-2 text-sm bg-amber-50 border border-amber-200 text-amber-800">
        ${esc(text)}
      </div>
    </div>`;
  }
  const isUser = role === 'user';
  return `
  <div class="flex ${isUser ? 'justify-end' : 'justify-start'}">
    <div class="max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
      isUser ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
    }">
      ${esc(text)}
    </div>
  </div>`;
}
