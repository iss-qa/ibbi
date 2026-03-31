export default function Header({ title, subtitle, action }) {
  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-5 md:mb-6 relative">
      <div className="pl-12 md:pl-0">
        <h1 className="font-display text-2xl md:text-3xl text-ibbiNavy pt-0.5">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && (
        <div className="mt-3 md:mt-0 flex justify-center w-full md:w-auto">
          {action}
        </div>
      )}
    </header>
  );
}
