"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-boundary">
      <h1>BUZZ</h1>
      <p>The page could not be loaded. Please retry.</p>
      <button onClick={reset}>Retry</button>
    </main>
  );
}
