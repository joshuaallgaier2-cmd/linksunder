import { describe, it, expect } from 'vitest';
import { scenarioSchema, demoScenario } from '../shared/schema';
import { publicAddress, validateTarget } from '../server/security';
import { htmlReport } from '../server/report';
import { newRun } from '../server/runner';
import { formatTimestamp } from '../client/time';
describe('scenario validation', () => {
  it('rejects invalid configurations', () => {
    expect(scenarioSchema.safeParse({ name: '', url: 'hello', timeout: -1 }).success).toBe(false);
  });
  it('provides safe privacy defaults', () => {
    const s = scenarioSchema.parse({ name: 'A', url: 'http://localhost:3000' });
    expect(s.screenshots).toBe(false);
    expect(s.externalConsent).toBe(false);
  });
  it('includes real assertions in both demos', () => {
    for (const mode of ['broken', 'fixed'] as const)
      expect(demoScenario('http://localhost', mode).steps.some((s) => s.action === 'value')).toBe(
        true,
      );
  });
});
describe('network policy', () => {
  it.each([
    '127.0.0.1',
    '169.254.169.254',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '100.64.1.1',
    '0.0.0.0',
    '::1',
    'fc00::1',
    '::ffff:127.0.0.1',
  ])('blocks %s', (ip) => expect(publicAddress(ip)).toBe(false));
  it('accepts global public addresses', () => {
    expect(publicAddress('8.8.8.8')).toBe(true);
    expect(publicAddress('2606:4700::1111')).toBe(true);
  });
  it('rejects file and credential URLs', async () => {
    await expect(validateTarget('file:///etc/passwd', true)).rejects.toThrow();
    await expect(validateTarget('https://user:pass@example.com', true)).rejects.toThrow();
  });
  it('requires permission for external targets', async () => {
    await expect(validateTarget('https://example.com', false)).rejects.toThrow('permission');
  });
  it('blocks cross-origin loopback requests', async () => {
    await expect(
      validateTarget('http://localhost:90', true, 'https://example.com'),
    ).rejects.toThrow();
  });
});
it('escapes report content and stays offline', () => {
  const r = newRun(demoScenario('http://localhost', 'fixed'));
  r.name = '<script>alert(1)</script>';
  const html = htmlReport(r);
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('https://');
});
describe('timestamp formatting', () => {
  it('formats a known UTC timestamp deterministically', () => {
    expect(formatTimestamp('2026-01-02T15:04:05.000Z', 'UTC', 'en-US')).toBe(
      'Jan 2, 2026, 3:04 PM',
    );
  });
  it('returns a clear fallback for invalid timestamps', () => {
    expect(formatTimestamp('not-a-timestamp', 'UTC')).toBe('Invalid date');
  });
});
