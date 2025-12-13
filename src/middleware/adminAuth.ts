// // src/middleware/adminAuth.ts
// import { Request, Response, NextFunction } from "express";
// import jwt from "jsonwebtoken";

// export type AdminRole = "ADMIN" | "MANAGER" | "SUPER_ADMIN" | "CUSTOMER";

// export interface AdminUserPayload {
//   id: string;
//   role: AdminRole;
//   email?: string;
//   // add other fields you include in JWT if needed
// }

// // Extend Express Request type (only once in your project, ideally in a types file)
// // If you don't have a types file yet, you can put this in src/types/express.d.ts
// declare global {
//   namespace Express {
//     interface Request {
//       user?: AdminUserPayload;
//     }
//   }
// }

// // Helper: verify JWT and attach user
// const verifyJwtAndSetUser = (req: Request, res: Response): AdminUserPayload | null => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader?.startsWith("Bearer ")) {
//     res.status(401).json({ success: false, message: "No token provided" });
//     return null;
//   }

//   const token = authHeader.split(" ")[1];

//   try {
//     const payload = jwt.verify(token, process.env.JWT_SECRET!) as AdminUserPayload;
//     req.user = payload;
//     return payload;
//   } catch (err) {
//     res.status(401).json({ success: false, message: "Invalid or expired token" });
//     return null;
//   }
// };

// // Main middleware - allows MANAGER, admin, SUPER_ADMIN
// export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
//   const user = verifyJwtAndSetUser(req, res);
//   if (!user) return; // response already sent

//   const allowedRoles: AdminRole[] = ["MANAGER", "ADMIN", "SUPER_ADMIN"];
//   if (!allowedRoles.includes(user.role)) {
//     return res.status(403).json({ success: false, message: "Forbidden: insufficient role" });
//   }

//   next();
// };

// // Only admin + SUPER_ADMIN (e.g. update price, name, delete)
// export const requireAdminOrHigher = (req: Request, res: Response, next: NextFunction) => {
//   const user = verifyJwtAndSetUser(req, res);
//   if (!user) return;

//   if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
//     return res.status(403).json({ success: false, message: "Required: ADMIN or SUPER_ADMIN" });
//   }

//   next();
// };

// // Only SUPER_ADMIN (dangerous operations)
// export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
//   const user = verifyJwtAndSetUser(req, res);
//   if (!user) return;

//   if (user.role !== "SUPER_ADMIN") {
//     return res.status(403).json({ success: false, message: "Required: SUPER_ADMIN only" });
//   }

//   next();
// };
