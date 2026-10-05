import { useEffect, useState, type KeyboardEvent } from 'react';
import { formatNumber } from '../ui/i18n';

/** Interpreta "42,5", "42.5" o " 42 " como número. `null` si no es válido. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '' || !/^-?\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Campo numérico que confirma con Intro o al salir (un solo paso de deshacer).
 * Si `onCommit` lanza o el texto no es válido, vuelve al valor anterior.
 */
export function NumberField({
  label,
  value,
  unit,
  min,
  onCommit,
}: {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  onCommit(n: number): void;
}) {
  const [text, setText] = useState(formatNumber(value, 1));
  useEffect(() => setText(formatNumber(value, 1)), [value]);

  const commit = () => {
    const n = parseNumber(text);
    if (n === null || (min !== undefined && n < min) || n === value) {
      setText(formatNumber(value, 1));
      return;
    }
    try {
      onCommit(n);
    } catch {
      setText(formatNumber(value, 1));
    }
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      setText(formatNumber(value, 1));
      e.currentTarget.blur();
    }
    e.stopPropagation();
  };
  return (
    <label className="field">
      <span>{label}</span>
      <span className="field__input">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
        />
        {unit && <span className="field__unit">{unit}</span>}
      </span>
    </label>
  );
}
