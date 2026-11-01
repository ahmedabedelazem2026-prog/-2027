import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "تاكسي العاصمة | احجز رحلتك", description: "اطلب رحلتك داخل شمال سيناء وخارجها." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ar" dir="rtl"><body>{children}</body></html>; }