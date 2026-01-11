import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request to include user info
export interface AuthRequest extends Request {
  customer?: {
    id: string;
    email: string;
  };
}

// ------------------------------------------------------------------
// 1. STRICT AUTH (For "My Orders", "Profile" etc.)
// ------------------------------------------------------------------
export const authenticateCustomer = (req: AuthRequest, res: Response, next: NextFunction) => {
  // CHANGE: Read from Cookie instead of Header
  let token = req.cookies?.accessToken;

  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided."
    });
  }

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

// ------------------------------------------------------------------
// 2. OPTIONAL AUTH (For "Checkout", "Home" etc.)
// ------------------------------------------------------------------
export const optionalAuthenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  // CHANGE: Read from Cookie
  let token = req.cookies?.accessToken;

  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  // 1. Guest Check: If no cookie, just move on.
  if (!token) {
    return next();
  }

  try {
    // 2. Token Check
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as { id: string; email: string };

    // 3. Attach User
    req.customer = decoded;
    next();
  } catch (error) {
    // Edge Case: Cookie exists but token is expired/invalid.
    // Since this is "Optional" auth, we have a UX choice:

    // Choice A (Strict): Return 403. The frontend sees this and redirects to login.
    // return res.status(403).json({ success: false, message: "Invalid token" });

    // Choice B (Smooth): Just clear the bad cookie and treat them as a guest.
    // This is often better for checkout flows so a stale cookie doesn't block a guest purchase.
    res.clearCookie("accessToken");
    next();
  }
};