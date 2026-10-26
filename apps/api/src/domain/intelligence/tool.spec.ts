import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from './tool';

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const registry = new ToolRegistry();
    const tool = {
      name: 'foo',
      description: 'test',
      inputSchema: { parse: (x: any) => x } as any,
      requiredPermissions: [],
      execute: vi.fn(),
    };
    registry.register(tool);
    expect(registry.get('foo')).toBe(tool);
    expect(registry.names()).toContain('foo');
  });

  it('rejects duplicate registration', () => {
    const registry = new ToolRegistry();
    const tool = {
      name: 'foo',
      description: 'test',
      inputSchema: { parse: (x: any) => x } as any,
      requiredPermissions: [],
      execute: vi.fn(),
    };
    registry.register(tool);
    expect(() => registry.register(tool)).toThrow();
  });

  it('exposes specs as JSON Schema', () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'test',
      description: 'desc',
      inputSchema: { parse: () => undefined } as any,
      requiredPermissions: [],
      execute: vi.fn(),
    });
    const specs = registry.specs();
    expect(specs[0].name).toBe('test');
    expect(specs[0].description).toBe('desc');
  });
});
