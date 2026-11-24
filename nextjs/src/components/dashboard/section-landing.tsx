'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from './page-primitives';
import { cn } from '@/lib/utils';

export interface SubSection {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent?: string;
}

interface SectionLandingProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: SubSection[];
  // Optional content rendered between the page header and the section
  // cards — e.g. the AI Matching landing page's live AI Engine status
  // card. Absent by default; no other landing page is affected.
  topContent?: ReactNode;
  className?: string;
}

export function SectionLanding({ title, description, icon, children, topContent, className }: SectionLandingProps) {
  return (
    <div className={cn("space-y-6 pb-10", className)}>
      <PageHeader title={title} description={description} icon={icon} />
      {topContent}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children.map((item) => (
          <Link key={item.href} href={item.href} className="group block">
            <Card className="h-full transition-all hover:shadow-md hover:border-neutral-400/40 group-hover:-translate-y-0.5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                      item.accent ?? "bg-neutral-100 text-neutral-900"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-lpu-text-muted group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
                </div>
                <CardTitle className="mt-4">{item.title}</CardTitle>
                {item.description && (
                  <CardDescription className="mt-1">{item.description}</CardDescription>
                )}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
