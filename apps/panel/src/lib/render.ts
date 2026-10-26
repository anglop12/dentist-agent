/**
 * Helper de renderizado del layout principal (Tailwind CDN + HTMX CDN).
 */

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HEAD = `
  <script src="https://unpkg.com/htmx.org@1.9.12"></script>
  <script src="https://cdn.tailwindcss.com"></script>
`;

function nav(active: string): string {
  const link = (href: string, label: string) =>
    `<a href="${href}" class="${active === href ? 'text-blue-600 font-semibold' : 'hover:text-blue-600'}">${label}</a>`;
  return `
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
      <span class="font-bold text-lg">🦷 Panel Dental</span>
      ${link('/dashboard', 'Dashboard')}
      ${link('/appointments', 'Citas')}
      ${link('/patients', 'Pacientes')}
      ${link('/agent', 'Agente 🤖')}
    </div>`;
}

export function renderPage(title: string, body: string, active = ''): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — Panel Dental</title>
  ${HEAD}
</head>
<body class="bg-gray-100 min-h-screen">
  <nav class="bg-white shadow mb-6">${nav(active)}</nav>
  <main class="max-w-6xl mx-auto px-4 pb-12">
    ${body}
  </main>
</body>
</html>`;
}
