/**
 * i18n mínimo con claves tipadas. Hoy solo español; para añadir otro idioma basta
 * con otro JSON con las mismas claves (el tipo `MessageKey` obliga a que existan).
 */
import es from './es.json';

export type MessageKey = keyof typeof es;
export type Messages = Record<MessageKey, string>;

const catalogs = { es } satisfies Record<string, Messages>;
export type Locale = keyof typeof catalogs;

let current: Messages = catalogs.es;

export function setLocale(locale: Locale): void {
  current = catalogs[locale];
}

/** Traduce `key` sustituyendo `{var}` por `vars.var`. Las variables ausentes se dejan tal cual. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const msg = current[key];
  if (!vars) return msg;
  return msg.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** Números con formato español (coma decimal, punto de miles). */
export const formatNumber = (n: number, maxDecimals = 2): string =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: maxDecimals }).format(n);
