 import { Request, Response, NextFunction } from "express";
import { UserRole } from "../models/admin.model";


export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email?: string;
  };
}

// Define roles and allowed actions
export const RESOURCE_PERMISSIONS: Record<string, Record<string, UserRole[]>> = {
  customer: {
    create: ["SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN"],
    update: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  },
  product: {
    create: ["SUPER_ADMIN", "ADMIN"],
    update: ["SUPER_ADMIN", "ADMIN"],
    delete: ["SUPER_ADMIN"],
  },
  order: {
    create: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    update: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    dispatch: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  },
};

// Middleware to check if current user can perform action
export const authorizeResource =
  (resource: keyof typeof RESOURCE_PERMISSIONS, action: string) =>
  // 2. Use 'AuthRequest' instead of 'Request' here
  (req: AuthRequest, res: Response, next: NextFunction) => {
    
    // Now TypeScript knows 'user' exists and has a 'role'
    const userRole = req.user?.role;
    
    if (!userRole) return res.status(401).json({ success: false, message: "Unauthorized" });

    const allowedRoles = RESOURCE_PERMISSIONS[resource][action];
    
    // Safety check: if the resource/action doesn't exist in your config
    if (!allowedRoles) {
      return res.status(500).json({ success: false, message: "Invalid permission configuration" });
    }

    if (!allowedRoles.includes(userRole))
      return res.status(403).json({ success: false, message: "Forbidden" });

    next();
  };