import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/apiResponse';
import { AppError } from '../utils/appError';


export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("🔥 Error caught in middleware:", err);

  if (res.headersSent) {
    return next(err);
  }

  // 1. Handle Multer Errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return error(res, "File is too large! Max limit is 5MB.", 400);
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return error(res, "Too many files or invalid field name.", 400);
  }

  // 2. Handle Custom AppErrors
  if (err instanceof AppError) {
    return error(res, err.message, err.statusCode);
  }

  // 3. Handle Drizzle / Postgres Duplicate Key Error
  // Drizzle nests the specific DB error inside 'err.cause'
  const errorCode = err.code || err.cause?.code;

  if (errorCode === '23505') {
    // Try to extract which field caused the issue from 'detail'
    // Example detail: "Key (barcode)=(6923453142193) already exists."
    const detail = err.detail || err.cause?.detail;
    let message = 'Duplicate field value entered.';

    if (detail && detail.includes('Key (') && detail.includes(')=')) {
      const fieldName = detail.split('(')[1].split(')')[0];
      message = `${fieldName} already exists.`;
    }

    return error(res, message, 409);
  }

  // 4. Handle Zod Validation Errors
  if (err.name === 'ZodError') {
    const messages = err.errors.map((e: any) => e.message).join(', ');
    return error(res, `Validation Error: ${messages}`, 400, err.errors);
  }

  // 5. Generic / Unknown Errors
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'development'
    ? err.message
    : "Something went wrong. Please try again later.";

  error(res, message, status);
};