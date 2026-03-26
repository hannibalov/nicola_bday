export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen max-w-md mx-auto px-4 py-6 safe-area-padding bg-background text-foreground">
      {children}
    </div>
  );
}
