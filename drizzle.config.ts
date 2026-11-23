import { defineConfig } from "drizzle-kit";
export default defineConfig({ schema: ["./db/schema.ts", "./lib/credit/schema.ts"], out: "./drizzle", dialect: "postgresql" });
