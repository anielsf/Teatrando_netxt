/**
 * Logger centralizado de Teatrando
 * Reemplaza todos los console.error/console.log dispersos en la API
 * En producción, los logs se envían a Vercel Log Drains (configurar en Vercel Dashboard)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  service?: string;
  context?: Record<string, unknown>;
  timestamp: string;
  environment: string;
}

function formatEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  service?: string
): LogEntry {
  return {
    level,
    message,
    service: service || 'teatrando-api',
    context,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  };
}

function writeLog(entry: LogEntry) {
  const output = JSON.stringify(entry);
  switch (entry.level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>, service?: string) {
    if (process.env.NODE_ENV === 'development') {
      writeLog(formatEntry('debug', message, context, service));
    }
  },
  info(message: string, context?: Record<string, unknown>, service?: string) {
    writeLog(formatEntry('info', message, context, service));
  },
  warn(message: string, context?: Record<string, unknown>, service?: string) {
    writeLog(formatEntry('warn', message, context, service));
  },
  error(message: string, context?: Record<string, unknown>, service?: string) {
    writeLog(formatEntry('error', message, context, service));
  },
};

/**
 * Wrapper para manejar errores en API Routes de Next.js de forma centralizada
 */
export function withErrorHandler(
  handler: (req: Request, context?: Record<string, unknown>) => Promise<Response>
) {
  return async (req: Request, context?: Record<string, unknown>): Promise<Response> => {
    try {
      return await handler(req, context);
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('Unhandled API Error', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
      });
      return Response.json(
        { error: 'Error interno del servidor. Por favor intenta nuevamente.' },
        { status: 500 }
      );
    }
  };
}
