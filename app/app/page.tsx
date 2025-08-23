import { redirect } from 'next/navigation';

export default function NotebookRoot() {
  // Redirect to events tab by default
  redirect('/app/events');
}