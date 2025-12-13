//customer Auth middleware

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request to include user info
export interface AuthRequest extends Request {
  customer?: {
    id: string;
    email: string;
  };
}

export const authenticateCustomer = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
        success: false, 
        message: "Access denied. No token provided." 
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as { id: string; email: string };
    req.customer = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ 
        success: false, 
        message: "Invalid or expired token." 
    });
  }
};