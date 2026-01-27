import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "aws"
  | "azure"
  | "gcp"
  | "onprem";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
}

const Badge = ({
  className,
  variant = "default",
  size = "sm",
  dot = false,
  children,
  ...props
}: BadgeProps) => {
  const baseStyles =
    "inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors";

  const variants: Record<BadgeVariant, string> = {
    default: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary text-secondary-foreground border-border",
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    error: "bg-red-500/10 text-red-500 border-red-500/20",
    aws: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    azure: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    gcp: "bg-green-500/10 text-green-500 border-green-500/20",
    onprem: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  const dotColors: Record<BadgeVariant, string> = {
    default: "bg-primary",
    secondary: "bg-muted-foreground",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    aws: "bg-orange-500",
    azure: "bg-blue-500",
    gcp: "bg-green-500",
    onprem: "bg-slate-400",
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[variant])} />
      )}
      {children}
    </span>
  );
};

export { Badge };
