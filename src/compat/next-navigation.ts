import { useNavigate, useLocation, useParams as useRouterParams, useSearchParams as useRouterSearchParams } from 'react-router-dom';

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (url: string) => navigate(url),
    replace: (url: string) => navigate(url, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  };
}

export function usePathname(): string {
  const location = useLocation();
  return location.pathname;
}

export function useParams<T extends Record<string, string | string[] | undefined> = Record<string, string>>(): T {
  return useRouterParams() as unknown as T;
}

export function useSearchParams() {
  return useRouterSearchParams();
}

export function redirect(url: string) {
  window.location.href = url;
}

export function notFound() {
  // Not found fallback helper
}
