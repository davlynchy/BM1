export function ProjectPageShell({
  title,
  rightSlot,
  children,
}: {
  title: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="space-y-8">
      <header className="relative space-y-8 pt-2 text-center">
        <p className="font-heading text-3xl text-text/90">Bidmetric</p>
        <h1 className="font-heading text-6xl">{title}</h1>
        <div className="absolute right-0 top-2 text-sm font-medium text-text">{rightSlot ?? null}</div>
      </header>
      {children}
    </main>
  );
}
