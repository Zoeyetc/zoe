export type StructureRegion = Readonly<{
  id: string;
  start: number;
  end: number;
  section: string;
  energy: readonly [number, number];
  tension: readonly [number, number];
  build: readonly [number, number];
  phraseProgress: readonly [number, number];
}>;

export type StructuralDrop = Readonly<{
  id: string;
  time: number;
  strength: number;
}>;

export type ZlandAuthoredOverlay = Readonly<{
  structure: readonly StructureRegion[] | null;
  drops: readonly StructuralDrop[] | null;
}>;
