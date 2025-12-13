import { Request, Response } from 'express';
import { error } from '../utils/apiResponse';

export const notFound = (req: Request, res: Response) => {
  error(res, `Route ${req.originalUrl} not found`, 404);
};