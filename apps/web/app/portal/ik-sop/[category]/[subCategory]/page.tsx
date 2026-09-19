import type { Metadata } from "next";
import { IkSopApp } from "@/features/ik-sop/components/ik-sop-app";

type Props = {
  params: Promise<{
    category: string;
    subCategory: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, subCategory } = await params;
  return {
    title: `${subCategory.toUpperCase()} — IK & SOP — MKN Site`,
    description: `Instruksi Kerja dan SOP untuk ${category} / ${subCategory}`
  };
}

export default async function IkSopSubCategoryPage({ params }: Props) {
  const { category, subCategory } = await params;
  return <IkSopApp initialCategory={category} initialSubCategory={subCategory} />;
}
