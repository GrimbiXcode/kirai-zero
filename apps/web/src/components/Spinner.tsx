export function Spinner({ label }: { label: string }) {
  return (
    <p role="status" className="py-8 text-center text-sm text-muted">
      {label}
    </p>
  );
}
