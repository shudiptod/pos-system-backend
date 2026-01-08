import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/apiResponse';

// export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
//   console.error('Error:', err);
//   const status = err.status || 500;
//   error(res, err.message || 'Internal Server Error', status);
// };

// MUST have all 4 arguments: (err, req, res, next)
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("🔥 Error caught in middleware:", err); // This helps you see it in logs

  // Handle Multer Errors (File too large, etc.)
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File is too large! Please upload a smaller file."
    });
  }

  // Handle Generic Errors
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  error(res, message, status);
};