import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('menulis satu baris JSON dengan level, event, dan timestamp', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('transaction.created', { id: 'tx_1' });

    const entry = JSON.parse(log.mock.calls[0][0]);
    expect(entry).toMatchObject({ level: 'info', event: 'transaction.created', id: 'tx_1' });
    expect(new Date(entry.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('mengarahkan warn dan error ke stream yang sesuai', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.warn('a');
    logger.error('b');

    expect(JSON.parse(warn.mock.calls[0][0]).level).toBe('warn');
    expect(JSON.parse(error.mock.calls[0][0]).level).toBe('error');
  });

  it('menyertakan detail Error (yang biasanya hilang di JSON.stringify)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('transaction.create.failed', { error: new Error('connection refused') });

    const entry = JSON.parse(error.mock.calls[0][0]);
    expect(entry.error).toMatchObject({ name: 'Error', message: 'connection refused' });
    expect(entry.error.stack).toContain('connection refused');
  });
});
