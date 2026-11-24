'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Inbox, AlertCircle, LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-900">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-lpu-text-primary">{title}</h1>
          {description && <p className="text-lpu-text-secondary mt-1 max-w-2xl">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function SectionCard({ title, description, actions, className, children }: SectionCardProps) {
  return (
    <Card className={className}>
      {(title || description || actions) && (
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function PageEmptyState({ message, hint, icon: Icon }: { message: string; hint?: string; icon?: LucideIcon }) {
  const I = Icon ?? Inbox;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
        <I className="h-5 w-5 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-lpu-text-primary">{message}</p>
      {hint && <p className="text-xs text-lpu-text-secondary mt-1 max-w-xs">{hint}</p>}
    </div>
  );
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="h-12 w-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3">
        <AlertCircle className="h-5 w-5 text-red-400" />
      </div>
      <p className="text-sm font-medium text-lpu-text-primary">Something went wrong</p>
      <p className="text-xs text-lpu-text-secondary mt-1 max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Retry
        </Button>
      )}
    </div>
  );
}

export function PageLoader({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center" role="status" aria-busy="true">
      <div className="glass-panel flex w-fit items-center gap-2.5 rounded-full px-4 py-2 text-xs text-neutral-500">
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="glass-thinking-dot h-1.5 w-1.5 rounded-full bg-current" />
          <span className="glass-thinking-dot h-1.5 w-1.5 rounded-full bg-current" />
          <span className="glass-thinking-dot h-1.5 w-1.5 rounded-full bg-current" />
        </span>
        {message}
      </div>
      <div className="w-64 space-y-2">
        <div className="pulse-skeleton h-3 w-full rounded-md" aria-hidden="true" />
        <div className="pulse-skeleton h-3 w-2/3 rounded-md" aria-hidden="true" />
      </div>
    </div>
  );
}
