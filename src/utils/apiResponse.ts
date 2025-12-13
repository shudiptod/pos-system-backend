import { Response } from 'express';

export const success = <T>(res: Response, data: T, message = 'Success', status = 200) => {
  res.status(status).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

export const error = (res: Response, message = 'Error', status = 500, details?: any) => {
  res.status(status).json({
    success: false,
    message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  });
};