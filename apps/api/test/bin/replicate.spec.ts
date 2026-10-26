import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync } from 'fs';

describe('bin/replicate.ts - lógica pura', () => {
  let cwd: string;
  let origCwd: string;
  let origArgv: string[];

  beforeEach(() => {
    origCwd = process.cwd();
    origArgv = process.argv;
    cwd = mkdtempSync(join(tmpdir(), 'replicate-test-'));
    process.chdir(cwd);
  });

  afterEach(() => {
    process.chdir(origCwd);
    process.argv = origArgv;
    rmSync(cwd, { recursive: true, force: true });
  });

  it('exits with error if --config flag is missing', async () => {
    // Mock console.error y process.exit
    const errSpy = (await import('vitest')).vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = (await import('vitest')).vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code}`);
    }) as any);

    process.argv = ['node', 'replicate.ts'];
    await expect(import('../../bin/replicate')).rejects.toThrow('EXIT_1');

    errSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('throws when config file not found', async () => {
    process.argv = ['node', 'replicate.ts', '--config=missing.json'];
    await expect(import('../../bin/replicate')).rejects.toThrow(/Config file not found/);
  });

  it('generates .env and seed from valid config', async () => {
    const cfg = {
      clinic: { name: 'Clínica Test', timezone: 'UTC' },
      doctor: {
        name: 'Doc', lastname: 'Test', cedula: 12345,
        email: 'd@t.com', phone: '+584141234567',
        specialtyId: 'spec-1', dailyLimit: 10,
      },
      whatsapp: { enabled: true, sessionPath: './wa' },
      llm: { provider: 'ollama', model: 'qwen2.5:7b' },
    };
    writeFileSync(join(cwd, 'cfg.json'), JSON.stringify(cfg));
    process.argv = ['node', 'replicate.ts', `--config=${join(cwd, 'cfg.json')}`];

    await import('../../bin/replicate');

    // Verificar que se generó .env
    expect(existsSync(join(cwd, '.env'))).toBe(true);
    const env = readFileSync(join(cwd, '.env'), 'utf-8');
    expect(env).toContain('LLM_PROVIDER=ollama');
    expect(env).toContain('WA_ENABLED=true');
    expect(env).toContain('APP_NAME="Clínica Test"');

    // Verificar que se generó seed
    expect(existsSync(join(cwd, 'db/seeds/auto-seed.ts'))).toBe(true);
    const seed = readFileSync(join(cwd, 'db/seeds/auto-seed.ts'), 'utf-8');
    expect(seed).toContain('Doc');
    expect(seed).toContain('Test');
    expect(seed).toContain('12345');
  });

  it('does not overwrite existing .env', async () => {
    writeFileSync(join(cwd, '.env'), 'EXISTING=true');
    const cfg = {
      clinic: { name: 'X' },
      doctor: { name: 'A', lastname: 'B', cedula: 1, email: 'a@b.com', phone: '+1', specialtyId: 's', dailyLimit: 1 },
      llm: { provider: 'ollama' },
    };
    writeFileSync(join(cwd, 'cfg.json'), JSON.stringify(cfg));
    process.argv = ['node', 'replicate.ts', `--config=${join(cwd, 'cfg.json')}`];

    await import('../../bin/replicate');
    const env = readFileSync(join(cwd, '.env'), 'utf-8');
    expect(env).toBe('EXISTING=true');
  });
});
