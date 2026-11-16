import type { Metadata } from "next";
import { ServingLayer } from "@/components/ServingLayer";

export const metadata: Metadata = {
  title: "Serving Layer: กราฟ + Semantic Search · แดชบอร์ดปาล์มน้ำมัน",
  description: "ส่งต่อข้อมูลจาก MySQL ไป Neo4j สร้างกราฟจากคีย์นอก ฝังเวกเตอร์ด้วย Gemini แล้วค้นหาด้วยความหมายและ query หลายทอด",
};

export default function ServingLayerPage() {
  return <ServingLayer />;
}
