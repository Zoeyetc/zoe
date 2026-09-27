export enum VisualRepresentation {
  Original = 'original',
  GlyphField = 'glyph-field',
}

export const VISUAL_REPRESENTATIONS = [
  VisualRepresentation.Original,
  VisualRepresentation.GlyphField,
] as const;

export const VISUAL_REPRESENTATION_NAMES: Readonly<Record<VisualRepresentation, string>> = {
  [VisualRepresentation.Original]: 'ORIGINAL',
  [VisualRepresentation.GlyphField]: 'GLYPH FIELD',
};
