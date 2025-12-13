import { UserRole } from "../models/admin.model"; // Adjust path as needed

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role?: UserRole;
        email?: string;
      };
    }
  }
}