"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Eye } from "lucide-react";

interface ReadOnlyBadgeProps {
  className?: string;
}

/**
 * Displays a "Read Only" badge when the user has viewer role
 */
export function ReadOnlyBadge({ className = "" }: ReadOnlyBadgeProps) {
  const { isViewer } = useAuth();

  if (!isViewer) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full 
        bg-amber-500/10 text-amber-500 text-xs font-medium ${className}`}
    >
      <Eye size={12} />
      <span>Read Only</span>
    </div>
  );
}

/**
 * Displays a role badge based on the user's current role
 */
export function RoleBadge({ className = "" }: { className?: string }) {
  const { role, isAdmin, isViewer } = useAuth();

  if (!role) {
    return null;
  }

  if (isAdmin) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full 
          bg-emerald-500/10 text-emerald-500 text-xs font-medium ${className}`}
      >
        <span>Admin</span>
      </div>
    );
  }

  if (isViewer) {
    return <ReadOnlyBadge className={className} />;
  }

  return null;
}
