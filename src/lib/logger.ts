import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, json, errors } = winston.format;

const transport = new DailyRotateFile({
    dirname: '/logs',
    filename: 'gajitto-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
});

export const logger = winston.createLogger({
    level: 'info',
    // You must combine the 'errors' format BEFORE the 'json' format
    format: combine(
        errors({ stack: true }), // <-- This is the missing piece
        timestamp(),
        json()
    ),
    transports: [
        new winston.transports.Console(),
        transport
    ]
});