import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Mentorly light badges (2026-11-11, white theme): monochrome by default
// — the label text carries the status, not colour — with soft tints kept
// only for the semantic success / warning / destructive variants.
const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-2 focus:ring-offset-white",
  {
    variants: {
      variant: {
        default:
          "border-neutral-900 bg-neutral-900 text-white",
        secondary:
          "border-neutral-200 bg-neutral-100 text-neutral-600",
        destructive:
          "border-red-200 bg-red-50 text-red-600",
        outline: "text-neutral-700 border-neutral-300",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        brand: "border-neutral-900 bg-neutral-900 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
