import multer from "multer";
import path from "path";
import os from "os";

// CHANGE 1: Use diskStorage instead of memoryStorage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Save to the system's temp directory
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        // Keep the original extension, make the name unique
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

export const upload = multer({
    storage: storage,
    limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});