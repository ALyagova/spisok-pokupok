import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/spisok-pokupok/",
  plugins: [react()],
});
