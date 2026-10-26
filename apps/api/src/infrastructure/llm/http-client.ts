/**
 * Cliente HTTP base para los providers LLM.
 * Usa fetch nativo (Node 20+) â€” sin dependencias extra.
 */

type WebReadableStream = import('node:stream/web').ReadableStream<Uint8Array>;

export interface HttpClientOpts {
  baseUrl: string;
  apiKey?: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
}

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly body: string, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class HttpClient {
  constructor(private readonly opts: HttpClientOpts) {}

  async post<T>(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const url = `${this.opts.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.opts.defaultHeaders ?? {}),
      ...(extraHeaders ?? {}),
    };
    if (this.opts.apiKey) headers['Authorization'] = `Bearer ${this.opts.apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 60_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new HttpError(res.status, text, `HTTP ${res.status} on ${path}: ${text.slice(0, 200)}`);
      }
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async postStream(
    path: string,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<WebReadableStream> {
    const url = `${this.opts.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.opts.defaultHeaders ?? {}),
      ...(extraHeaders ?? {}),
    };
    if (this.opts.apiKey) headers['Authorization'] = `Bearer ${this.opts.apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 120_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new HttpError(res.status, '', `HTTP ${res.status} on ${path}`);
      }
      return res.body;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  async get<T>(path: string): Promise<T> {
    const url = `${this.opts.baseUrl}${path}`;
    const headers: Record<string, string> = {
      ...(this.opts.defaultHeaders ?? {}),
    };
    if (this.opts.apiKey) headers['Authorization'] = `Bearer ${this.opts.apiKey}`;
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) throw new HttpError(res.status, await res.text(), `HTTP ${res.status} on ${path}`);
    return res.json() as Promise<T>;
  }
}
