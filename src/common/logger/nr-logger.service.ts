import { LoggerService, LogLevel } from '@nestjs/common';
import pino from 'pino';

export type PinoLogger = pino.Logger;

export function createPinoLogger(): PinoLogger {
  return pino({ level: process.env.LOG_LEVEL ?? 'info' });
}

export class NrLoggerService implements LoggerService {
  constructor(private readonly pino: PinoLogger) {}

  log(message: unknown, context?: string) {
    this.pino.info(this.spread(message, context));
  }

  error(message: unknown, trace?: string, context?: string) {
    this.pino.error(this.spread(message, context, trace));
  }

  warn(message: unknown, context?: string) {
    this.pino.warn(this.spread(message, context));
  }

  debug(message: unknown, context?: string) {
    this.pino.debug(this.spread(message, context));
  }

  verbose(message: unknown, context?: string) {
    this.pino.trace(this.spread(message, context));
  }

  setLogLevels?(_levels: LogLevel[]) {}

  // If message is a JSON string (our structured events), spread its fields to
  // top-level Pino fields so New Relic can query them directly (e.g. WHERE reason = 'cooldown').
  private spread(message: unknown, context?: string, trace?: string): Record<string, unknown> {
    const base: Record<string, unknown> = { context };
    if (trace) base.trace = trace;

    if (typeof message === 'string') {
      try {
        const parsed = JSON.parse(message) as Record<string, unknown>;
        if (typeof parsed === 'object' && parsed !== null) return { ...base, ...parsed };
      } catch {
        // not JSON — plain string message
      }
      return { ...base, message };
    }

    return { ...base, message };
  }
}
