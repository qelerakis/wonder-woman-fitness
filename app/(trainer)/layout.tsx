import { Header } from '@/components/layout/Header';

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      {children}
    </div>
  );
}
