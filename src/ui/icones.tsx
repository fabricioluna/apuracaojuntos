// Ícones do protótipo, como componentes React (mesmos desenhos de docs/apuracao.html).
type Props = { className?: string };

const base = { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;

export function IconeBarras(p: Props) {
  return (
    <svg {...base} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className={p.className}>
      <path d="M5 20V11M12 20V4M19 20v-6" />
    </svg>
  );
}
export function IconeScan(p: Props) {
  return (
    <svg {...base} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8" />
    </svg>
  );
}
export function IconeEscudo(p: Props) {
  return (
    <svg {...base} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
export function IconeFoto(p: Props) {
  return (
    <svg {...base} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
export function IconeTeclado(p: Props) {
  return (
    <svg {...base} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </svg>
  );
}
export function IconeCheck(p: Props) {
  return (
    <svg {...base} stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
export function IconeInfo(p: Props) {
  return (
    <svg {...base} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className={p.className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}
