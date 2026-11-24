/** @type {import('next').NextConfig} */
const nextConfig = {
  // No `images.remotePatterns`: the React app imports next/image nowhere
  // and renders avatars with plain <img> tags whose src values come from
  // the backend (mentor.imageUrl, host unknown at build time). There are
  // no external image hosts to allowlist. Port workers: keep plain <img>
  // for backend-provided URLs — do NOT switch to next/image (see
  // CONVENTIONS.md in the VM staging dir). If a fixed external host ever
  // appears, add it here explicitly.
  //
  // reactStrictMode defaults to true in Next.js, matching the React
  // app's <React.StrictMode> wrapper in main.tsx — no flag needed.
  //
  // No Clerk middleware/proxy.ts: auth is fully client-side (Clerk JS +
  // backend token verification), exactly as in the React app. Do not
  // invent server-side auth.
};

export default nextConfig;
