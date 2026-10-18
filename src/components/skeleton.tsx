export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="grid gap-3 p-4 md:p-5"
      role="status"
      aria-label="Loading"
      aria-busy="true"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          className="h-11 animate-pulse rounded-lg bg-zinc-200/70 even:w-5/6"
          key={i}
        />
      ))}
    </div>
  );
}
