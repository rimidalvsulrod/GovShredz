"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { buildBodyMesh, targetVolume, type BodyMesh } from "@/body/mesh";
import { applyCorrection, photoCorrection, shapeFromStats } from "@/body/shape";
import type { PhotoMetrics } from "@/shared/physique";
import type { Sex } from "@/shared/ranks";

const BodyViewer = dynamic(() => import("@/body/viewer").then((m) => m.BodyViewer), { ssr: false });

/** A small spinning model of someone's latest scan. */
export function MiniBody({
  sex,
  heightCm,
  weightKg,
  bodyFat,
  age,
  metrics,
  skin,
  strength,
  className,
}: {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  bodyFat: number;
  age: number;
  metrics: PhotoMetrics | null;
  skin: string;
  strength: number;
  className?: string;
}) {
  const [mesh, setMesh] = useState<BodyMesh | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const stats = { sex, heightCm, weightKg, bodyFat, age, strength, metrics };
      const base = shapeFromStats(stats, skin);
      const shape = applyCorrection(base, photoCorrection(base, metrics));
      setMesh(buildBodyMesh(shape, { voxel: 0.0085, targetVolume: targetVolume(weightKg, bodyFat) }));
    }, 50);
    return () => clearTimeout(t);
  }, [sex, heightCm, weightKg, bodyFat, age, metrics, skin, strength]);
  return <div className={className}>{mesh && <BodyViewer models={[mesh]} mode="skin" className="h-full w-full" />}</div>;
}
