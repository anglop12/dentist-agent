/**
 * Cliente HTTP al API principal.
 */

export async function apiGet(path: string, token?: string): Promise<any> {
  const url = `${process.env.API_URL ?? 'http://localhost:3000'}${path}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

export async function apiPost(path: string, body: unknown, token?: string): Promise<any> {
  const url = `${process.env.API_URL ?? 'http://localhost:3000'}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

export async function apiPatch(path: string, body: unknown, token?: string): Promise<any> {
  const url = `${process.env.API_URL ?? 'http://localhost:3000'}${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.status === 204 ? {} : res.json();
}
