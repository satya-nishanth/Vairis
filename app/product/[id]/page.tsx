import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductPageClient from "./ProductPageClient";

export const revalidate = 120;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id, isActive: true },
    select: { name: true, description: true, images: true },
  });
  if (!product) return {};
  return {
    title: `${product.name} — VAIRIS`,
    description: product.description ?? undefined,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.images[0] ? [product.images[0]] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const [product, goldRates] = await Promise.all([
    prisma.product.findUnique({
      where: { id, isActive: true },
      include: { variants: true },
    }),
    prisma.goldRate.findMany(),
  ]);

  if (!product) notFound();

  return (
    <ProductPageClient
      product={{
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        images: product.images,
        itemCode: product.itemCode,
        comingSoon: product.comingSoon,
        variants: product.variants.map((v) => ({
          id: v.id,
          metalType: v.metalType,
          sku: v.sku,
          size: v.size,
          weightGrams: v.weightGrams.toString(),
          makingChargePerGram: v.makingChargePerGram.toString(),
          flatMakingCharge: v.flatMakingCharge.toString(),
          stoneCharges: v.stoneCharges.toString(),
          miscCharges: v.miscCharges.toString(),
        })),
      }}
      goldRates={goldRates.map((r) => ({
        metalType: r.metalType,
        ratePerGram: r.ratePerGram.toString(),
      }))}
    />
  );
}
