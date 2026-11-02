// Logger sederhana yang menulis satu baris JSON per event.
// Format JSON gampang dicari/difilter di Vercel Logs atau `docker logs`,
// misalnya cari semua event "transaction.create.failed".

type Level = 'info' | 'warn' | 'error';

function write(level: Level, event: string, data: Record<string, unknown> = {}) {
  const entry: Record<string, unknown> = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...data,
  };

  // Error object tidak ikut ter-serialize oleh JSON.stringify, jadi diambil manual
  if (data.error instanceof Error) {
    entry.error = { name: data.error.name, message: data.error.message, stack: data.error.stack };
  }

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => write('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => write('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => write('error', event, data),
};
