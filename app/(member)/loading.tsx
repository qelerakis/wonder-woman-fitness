export default function Loading(): React.ReactElement {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
    </div>
  );
}
