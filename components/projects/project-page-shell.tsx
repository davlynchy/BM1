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
      <header className="relative space-y-6 pt-3 text-center">
        <h1 className="font-heading text-5xl">{title}</h1>
        <div className="absolute right-0 top-2 text-sm font-medium text-text">{rightSlot ?? null}</div>
      </header>
      {children}
    </main>
  );
}
