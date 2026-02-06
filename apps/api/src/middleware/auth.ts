import { Request, Response, NextFunction } from "express";
import { validateSession, UserRole } from "../services/auth";

// Extend Express Request to include session info
declare global {
  namespace Express {
    interface Request {
      session?: {
        sessionId: string;
        organizationId: string;
        cloudProvider: string;
        cloudIdentity: string;
        cloudAccountId: string;
        role: UserRole;
        isAdmin: boolean;
      };
    }
  }
}

/**
 * Middleware to require authentication
 * Validates the Bearer token and attaches session to request
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please provide a valid session token",
      });
    }

    const sessionToken = authHeader.substring(7);
    const session = await validateSession(sessionToken);

    if (!session) {
      return res.status(401).json({
        error: "Invalid or expired session",
        message: "Please log in again",
      });
    }

    // Attach session to request for use in route handlers
    req.session = session;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Authentication error" });
  }
}

/**
 * Middleware to require admin role
 * Must be used after requireAuth middleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    return res.status(401).json({
      error: "Authentication required",
      message: "Please log in first",
    });
  }

  if (!req.session.isAdmin) {
    return res.status(403).json({
      error: "Admin access required",
      message:
        "Your cloud credentials do not have admin permissions. You have read-only access.",
    });
  }

  next();
}

/**
 * Middleware to require specific role
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please log in first",
      });
    }

    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: `This action requires one of these roles: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
}
