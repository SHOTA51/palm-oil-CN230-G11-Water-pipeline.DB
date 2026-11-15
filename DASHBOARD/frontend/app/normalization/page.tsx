import type { Metadata } from "next";
import { Normalization } from "@/components/Normalization";

export const metadata: Metadata = {
  title: "ขั้นตอน Normalization · แดชบอร์ดปาล์มน้ำมัน",
  description: "จากไฟล์ Excel 3 ไฟล์ของ สศก. ผ่าน 1NF, 2NF, 3NF สู่ฐานข้อมูล plam-oil 6 ตาราง พร้อมแหล่งที่มาของข้อมูล",
};

export default function NormalizationPage() {
  return <Normalization />;
}
