// src/app.ts
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


const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use(cookieParser());
app.use("/api/cart", cartRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;