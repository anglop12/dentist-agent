# Panel HTMX (apps/panel)

> Panel web mínimo para administración. Usa HTMX + Tailwind.
> Consume el API REST principal como backend.

---

## Características

- **Dashboard** con KPIs en vivo (no-show rate, conversión, etc.).
- **Citas** con filtros por estado y cancelación inline.
- **Pacientes** con búsqueda reactiva.
- **Layout** con Tailwind CDN + HTMX CDN (sin build step).

---

## Cómo arrancar

```bash
pnpm dev:panel
# Escucha en http://localhost:4000

# Variables opcionales:
PANEL_PORT=4000
API_URL=http://localhost:3000
ADMIN_TOKEN=tu-token-aqui
```

El panel asume que el API está corriendo. Si no, muestra valores placeholder.

---

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/dashboard` | KPIs principales |
| `/appointments` | Lista + filtros + cancelación inline |
| `/patients` | Lista + búsqueda |

---

## Stack técnico

- **Express 4** (servidor mínimo).
- **HTMX 1.9** (interactividad sin JS).
- **Tailwind CDN** (estilos sin build).
- **Sin BD propia** — consume el API.

---

## Estructura

```
apps/panel/src/
├── server.ts              # bootstrap Express
├── lib/
│   ├── api-client.ts      # cliente HTTP al API
│   └── render.ts          # layout Tailwind base
└── routes/
    ├── dashboard.ts       # KPIs
    ├── appointments.ts    # lista + cancelación
    └── patients.ts        # lista + búsqueda
```

---

## Ejemplo de HTMX inline

Cancelar una cita sin recargar:

```html
<button hx-patch="/appointments/abc-123/cancel-htmx"
        hx-swap="none"
        class="text-red-600">
  Cancelar
</button>
```

El endpoint `/appointments/:id/cancel-htmx` hace `apiPatch` al API principal.

---

## Para producción

1. Servir tras Nginx/Caddy con HTTPS.
2. Configurar auth (Basic Auth o JWT en `ADMIN_TOKEN`).
3. Reemplazar CDN de Tailwind por build local (mejor performance).
4. Considerar migrar a una SPA (React/Vue) si crece la complejidad.
