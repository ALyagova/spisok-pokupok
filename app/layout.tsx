import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Список покупок", description: "Личный список покупок для дома и магазина." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru"><body>{children}</body></html>; }
