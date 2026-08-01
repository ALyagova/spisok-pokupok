import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Список покупок", description: "Общий семейный список покупок.", icons: { icon: "/app-icon.png", apple: "/app-icon.png" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru"><body>{children}</body></html>; }
