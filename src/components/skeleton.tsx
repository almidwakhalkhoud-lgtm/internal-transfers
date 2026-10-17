export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="skeleton-group"
      role="status"
      aria-label="Loading"
      aria-busy="true"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
