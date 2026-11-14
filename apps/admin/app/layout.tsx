import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "تاكسي العاصمة | مركز الإدارة",
  description: "مركز إدارة وتشغيل منصة تاكسي العاصمة",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
