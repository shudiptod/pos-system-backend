
//admin auth middleware

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../models/admin.model";

const JWT_SECRET = process.env.JWT_SECRET!;


// Extend Request to include typed user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

// Middleware to authenticate JWT and attach user
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ success: false, message: "Unauthorized" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };

    // Ensure role is a valid UserRole
    const role = decoded.role as UserRole;
    if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN"].includes(role))
      return res.status(403).json({ success: false, message: "Invalid role" });

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: role,
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};


// 2. AUTHORIZATION: Checks "Are you allowed to do this?" (Verifies Role)
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: "Forbidden: Insufficient permissions for this action" 
      });
    }

    next();
  };
};

