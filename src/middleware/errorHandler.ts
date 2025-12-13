import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/apiResponse';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  const status = err.status || 500;
  error(res, err.message || 'Internal Server Error', status);
};