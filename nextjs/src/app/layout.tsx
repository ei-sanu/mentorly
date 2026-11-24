/**
 * Mentorly — Next.js root layout (server component; NO 'use client').
 *
 * Replaces, for the Next.js port, the combination of:
 *   - index.html (title / meta / viewport / body classes), and
 *   - src/main.tsx (ReactDOM root + <React.StrictMode> + providers).
 *
 * - Metadata + viewport come verbatim from the React app's index.html.
 * - Global CSS: globals.css only. It @imports ./mentorly-minimal.css
 *   itself, exactly as in the React app — never import the theme file
 *   separately (see CONVENTIONS.md).
 * - Auth: <MockAuthProvider> is the SINGLE Clerk owner, exactly as in
 *   main.tsx — it renders ClerkProvider internally. Do NOT add a second
 *   ClerkProvider here; nested providers break Clerk. MockAuthProvider
 *   is a client component, so importing it here does not make this
 *   layout a client component.
 * - No Clerk middleware / proxy.ts: auth is fully client-side (Clerk JS
 *   + backend token verification), as in the React app. Do not invent
 *   server-side auth.
 * - No favicon metadata: the React app has no favicon asset (index.html
 *   references /favicon.ico but no public/ folder or file exists).
 * - <React.StrictMode> is not written here: Next.js enables React
 *   Strict Mode by default.
 */
import type { Metadata, Viewport } from 'next';
import { MockAuthProvider } from '@/lib/mock-auth';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Mentorly - Alumni Mentorship & Career Network',
  description:
    'Connect with verified alumni for structured career mentorship, mock interviews, and career guidance.',
  authors: [{ name: 'Mentorly' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-lpu-bg text-lpu-text-primary antialiased">
        <MockAuthProvider>{children}</MockAuthProvider>
      </body>
    </html>
  );
}
