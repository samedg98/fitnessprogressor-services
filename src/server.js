import pg from "pg";
pg.types.setTypeParser(1082, (val) => val); // return DATE as string

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// CORS — allow localhost + old Netlify + new Netlify + Vercel previews
const allowedOrigins = [
  "http://localhost:5173",

  // OLD Netlify
  "https://delicate-liger-d20157.netlify.app",

  // NEW Netlify 
  "https://stately-tartufo-23cf98.netlify.app",

  // Vercel preview
  "https://fitnessprogressor-kgcwdudfe-samedg98s-projects.vercel.app",
  "https://fitnessprogressor-zu77xfltn-samedg98s-projects.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
import authRoutes from "./routes/auth.js";
import workoutRoutes from "./routes/workouts.js";

app.use("/auth", authRoutes);
app.use("/workouts", workoutRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
