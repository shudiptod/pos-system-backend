
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import userAuthRoutes from "./routes/customer.auth.router";
import { listRoutes } from "./utils/listRoutes";
import customerRoutes from "./routes/create.customer.router";

import adminRoutes from "./routes/admin.router";
import productRoutes from "./routes/product.routes";
import cartRoutes from "./routes/cart.route";
import uploadRoutes from "./routes/upload.router";
import orderRoutes from "./routes/order.router";
import websiteSettingsRoutes from "./routes/websiteSettings.router";
import storeLocationRoutes from "./routes/storeLocation.router";

const allowedOrigins = [
  "http://localhost:3000",                  // Local Web
  "https://ecommerce-frontend-99o2zymab-shudiptods-projects.vercel.app",
  "https://www.gajittobd.com"    // Live Web
  // Add other web domains here if needed
];

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow Mobile Apps & Tools (Postman)
    // Requests from Flutter/Mobile usually have NO origin header.
    if (!origin) return callback(null, true);

    // 2. Allow specific Web Origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }, // MUST specify exact frontend URL (cannot use '*')
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

app.get("/", (req, res) => {
  res.json({
    message: "API Running – Auth System Ready!",
    routes: listRoutes(app),

  });
});


app.use("/api/auth", userAuthRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/stores", storeLocationRoutes);
app.use("/api/settings", websiteSettingsRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;