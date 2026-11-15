/** Where the data comes from: OAE open-data catalog, dataset dataoae1504. */

export type SourceFile = {
  level: "country" | "region" | "province";
  title: string;
  fileName: string;
  /** Header of the place column in this file (the country file differs from the other two). */
  placeColumn: string;
  rows: number;
  pageUrl: string;
  downloadUrl: string;
};

const DATASET_ID = "c10379a2-791b-44ae-87a0-53355a99be1b";
const res = (id: string, file: string) => ({
  pageUrl: `https://catalog.oae.go.th/en/dataset/dataoae1504/resource/${id}`,
  downloadUrl: `https://catalog.oae.go.th/dataset/${DATASET_ID}/resource/${id}/download/${file}`,
});

export const SOURCE = {
  title: "ปริมาณการผลิตปาล์มน้ำมัน",
  code: "dataoae1504",
  url: "https://catalog.oae.go.th/en/dataset/dataoae1504",
  publisher: "ศูนย์สารสนเทศการเกษตร สำนักงานเศรษฐกิจการเกษตร (สศก.)",
  catalog: "ระบบบัญชีข้อมูล สศก. (catalog.oae.go.th)",
  license: "Open Data Common",
  frequency: "ปีละ 1 ครั้ง",
  years: "ปีเพาะปลูก พ.ศ. 2525–2567",
  kind: "ข้อมูลสถิติทางการ (Official Statistics) · ข้อมูลสาธารณะ",
  files: [
    {
      level: "country",
      title: "ปริมาณการผลิตปาล์มน้ำมัน ระดับประเทศ",
      fileName: "oil_palm_production_wholecountry.xlsx",
      placeColumn: "province",
      rows: 172,
      ...res("88dfeaf6-3d8a-4ffb-956e-68becc9d7074", "oil_palm_production_wholecountry.xlsx"),
    },
    {
      level: "region",
      title: "ปริมาณการผลิตปาล์มน้ำมัน ระดับภาค",
      fileName: "oil_palm_production_region.xlsx",
      placeColumn: "province_name",
      rows: 480,
      ...res("1d6e4b0a-47dc-4094-8aab-838a23acb379", "oil_palm_production_region.xlsx"),
    },
    {
      level: "province",
      title: "ปริมาณการผลิตปาล์มน้ำมัน ระดับจังหวัด",
      fileName: "oil_palm_production_province.xlsx",
      placeColumn: "province_name",
      rows: 6308,
      ...res("65e0ccac-87ac-4a4d-9eb7-5611cccd78c6", "oil_palm_production_province.xlsx"),
    },
  ] satisfies SourceFile[],
};
