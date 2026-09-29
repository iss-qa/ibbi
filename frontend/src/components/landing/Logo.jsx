// Marca PastorIA: cajado + ovelha estilizados e o wordmark com "IA" em destaque.
export function LogoMark({ className = 'w-9 h-9' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="24" className="fill-brandNavy" />
      {/* cajado */}
      <path d="M30 40V16.5a5.5 5.5 0 1 0-11 0" stroke="#c9a227" strokeWidth="3.2" strokeLinecap="round" />
      {/* ovelha */}
      <ellipse cx="18" cy="31" rx="7" ry="5.2" fill="#f7f3ea" />
      <circle cx="12.5" cy="29" r="2.6" fill="#f7f3ea" />
      <circle cx="11.6" cy="28.6" r="0.7" fill="#0a1f44" />
      <path d="M15 36v3M20 36v3" stroke="#f7f3ea" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ light = false, className = 'text-2xl' }) {
  return (
    <span className={`font-display font-bold tracking-tight ${className} ${light ? 'text-white' : 'text-brandNavy'}`}>
      Pastor<span className="text-brandGold">IA</span>
    </span>
  );
}

export default function Logo({ light = false, size = 'md' }) {
  const mark = size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const text = size === 'lg' ? 'text-3xl' : 'text-2xl';
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={mark} />
      <Wordmark light={light} className={text} />
    </span>
  );
}
