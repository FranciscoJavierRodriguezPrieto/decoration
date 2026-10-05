/** Marca de PlanoCasa: una planta en L con un sofá, igual que el icono de la app. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="var(--teal-900)" />
      <path d="M7 8h10v8h8v8H7z" fill="var(--paper)" />
      <path d="M7 16h6M17 16v4" stroke="var(--teal-900)" strokeWidth="1.2" />
      <rect x="8.5" y="20" width="6" height="2.6" rx="0.8" fill="var(--accent)" />
    </svg>
  );
}
