import NotebookLayout from '@/components/notebook/NotebookLayout';

export default function NotebookRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotebookLayout>
      {children}
    </NotebookLayout>
  );
}