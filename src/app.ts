// src/app.ts
import express from "express";
if (process.env.NODE_ENV === "production") {
  require("module-alias/register");
}

import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { listRoutes } from "./utils/listRoutes";

import adminRoutes from "./routes/admin.routes";
import productRoutes from "./routes/product.routes";
import categoryRoutes from "./routes/category.routes"; // Added this
import uploadRoutes from "./routes/supabase.routes";
import orderRoutes from "./routes/order.routes";
import websiteSettingsRoutes from "./routes/storeSettings.routes";

const allowedOrigins = [
  "http://localhost:3000", // Local Web
  "http://localhost:3001", // Local Web
  "https://ecommerce-frontend-99o2zymab-shudiptods-projects.vercel.app",
  "https://www.gajittobd.com", // Live Web
  "https://gajittobd.com", // Live Web
  "https://admin.gajittobd.com",
];

const app = express();
// app.set("trust proxy", 1);
// app.use(
//   helmet({
//     crossOriginResourcePolicy: { policy: "cross-origin" },
//     contentSecurityPolicy: {
//       directives: {
//         "default-src": ["'self'"],
//         "connect-src": [
//           "'self'",
//           "https://www.gajittobd.com",
//           "https://gajittobd.com",
//           "https://admin.gajittobd.com",
//           "https://ecommerce-backend-production-b59c.up.railway.app",
//         ],
//         "script-src": ["'self'"],
//         "style-src": ["'self'", "'unsafe-inline'", "https:"],
//         "img-src": ["'self'", "data:", "https:"],
//         "font-src": ["'self'", "https:", "data:"],
//       },
//     },
//   }),
// );

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin) return callback(null, true);
//       if (allowedOrigins.indexOf(origin) !== -1) {
//         callback(null, true);
//       } else {
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//   }),
// );

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

app.get("/", (req, res) => {
  res.json({
    message: "API Running – POS System Ready!",
    routes: listRoutes(app),
  });
});

// Mounted Routes
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes); // Categories are now cleanly separated
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/settings", websiteSettingsRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;