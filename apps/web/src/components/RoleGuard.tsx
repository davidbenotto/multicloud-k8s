"use client";

import { useAuth, UserRole } from "@/contexts/AuthContext";

interface RoleGuardProps {
  /** Required role to view this content */
  role: UserRole | UserRole[];
  /** Content to show when user has the required role */
  children: React.ReactNode;
  /** Optional content to show when user doesn't have the required role */
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders content based on user's role
 *
 * @example
 * // Only show Create button for admins
 * <RoleGuard role="admin">
 *   <Button>Create Cluster</Button>
 * </RoleGuard>
 *
 * @example
 * // Show different content for viewers
 * <RoleGuard role="admin" fallback={<span>Read Only</span>}>
 *   <Button>Edit</Button>
 * </RoleGuard>
 */
export function RoleGuard({ role, children, fallback = null }: RoleGuardProps) {
  const { role: userRole, isAuthenticated } = useAuth();

  if (!isAuthenticated || !userRole) {
    return null;
  }

  const allowedRoles = Array.isArray(role) ? role : [role];

  if (allowedRoles.includes(userRole)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Shows content only for admin users
 */
export function AdminOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <RoleGuard role="admin" fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Shows content only for viewer users
 */
export function ViewerOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <RoleGuard role="viewer" fallback={fallback}>
      {children}
    </RoleGuard>
  );
}
