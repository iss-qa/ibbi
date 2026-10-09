export default function Header({ title, subtitle, action }) {
  return (
    <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 lg:gap-4 mb-5 md:mb-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl md:text-3xl text-ibbiNavy leading-tight break-words">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-slate-500 mt-1 break-words">{subtitle}</p>}
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2 min-w-0 lg:shrink-0 lg:justify-end [&>*]:max-w-full">
          {action}
        </div>
      )}
    </header>
  );
}
