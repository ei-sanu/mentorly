'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/mock-auth';
import { LpuLogo } from '@/components/ui/lpu-logo';
import { Button } from '@/components/ui/button';
import { FileQuestion, ArrowLeft, LayoutDashboard, Home, LogIn } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();
  const { isSignedIn, user, isLoaded } = useAuth();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const getDashboardPath = () => {
    if (user?.role) {
      return `/app/${user.role.toLowerCase().replace('_', '-')}/dashboard`;
    }
    return '/login';
  };

  return (
    <div className="min-h-screen bg-lpu-bg flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-lpu-orange/5 blur-3xl -z-10" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl -z-10" />

      {/* Main Container */}
      <div className="max-w-md w-full text-center space-y-8 bg-white p-8 md:p-12 rounded-3xl border border-lpu-border shadow-sm">
        {/* LPU Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/">
            <LpuLogo className="h-12 w-auto transition-opacity hover:opacity-90" />
          </Link>
        </div>

        {/* Visual Element */}
        <div className="relative flex justify-center mb-4">
          <div className="h-24 w-24 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-lpu-orange animate-bounce">
            <FileQuestion className="h-12 w-12" />
          </div>
          <span className="absolute -top-2 -right-2 bg-lpu-orange text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            404
          </span>
        </div>

        {/* Text Details */}
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold text-lpu-text-primary tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm text-lpu-text-secondary leading-relaxed">
            Oops! The link might be broken, or the page has been moved. Verify the URL or navigate back using the actions below.
          </p>
        </div>

        {/* Navigation Actions */}
        <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
          {!isLoaded ? (
            <div className="h-11 w-full bg-gray-100 animate-pulse rounded-xl" />
          ) : isSignedIn ? (
            <Button
              onClick={() => router.push(getDashboardPath())}
              className="w-full h-11 font-bold bg-lpu-orange hover:bg-lpu-orange-hover text-white rounded-xl flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/login')}
              className="w-full h-11 font-bold bg-lpu-orange hover:bg-lpu-orange-hover text-white rounded-xl flex items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4" /> Sign In
            </Button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              className="h-11 border-lpu-border hover:bg-gray-50 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" /> Go Back
            </Button>

            <Link href="/" className="w-full">
              <Button
                variant="outline"
                className="w-full h-11 border-lpu-border hover:bg-gray-50 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Home className="h-4 w-4" /> Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-xs text-lpu-text-muted">
        Need assistance? Please contact university support.
      </div>
    </div>
  );
}
