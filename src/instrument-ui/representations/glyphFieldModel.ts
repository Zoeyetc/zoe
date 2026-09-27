import type { ListeningRecordSlice } from './ListeningRecord.ts';

export const GLYPH_RENDERED_FRAME_LIMIT = 96;
export const GLYPH_MELODY_CANDIDATE_LIMIT = 5;
export const GLYPH_REJECTED_CANDIDATE_LIMIT = 2;
export const GLYPH_BASS_CANDIDATE_LIMIT = 4;
export const GLYPH_PIXELS_PER_SECOND = 64;

const MELODY_MIN_MIDI = 36;
const MELODY_MAX_MIDI = 84;
const BASS_MIN_MIDI = 24;
const BASS_MAX_MIDI = 60;
const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
const pitchPosition = (midi: number, minimum: number, maximum: number) =>
  1 - clamp((midi - minimum) / (maximum - minimum));

export type GlyphFieldGlyph = Readonly<{
  id: string; label: string; position: number; strength: number;
  kind: 'candidate' | 'selected' | 'rejected' | 'bass-candidate' | 'bass-selected';
}>;

export type GlyphFieldColumn = Readonly<{
  id: string; time: number; melody: readonly GlyphFieldGlyph[]; bass: readonly GlyphFieldGlyph[];
  melodySelectedPosition: number | null; bassSelectedPosition: number | null;
}>;

export type GlyphFieldLink = Readonly<{
  id: string; x1: number; y1: number; x2: number; y2: number;
}>;

export function selectedPathLinks(columns: readonly GlyphFieldColumn[], field: 'melody' | 'bass',
  pixelsPerSecond: number): readonly GlyphFieldLink[] {
  const links: GlyphFieldLink[] = [];
  const maximumPositionDelta = field === 'melody' ? .15 : .2;
  let previous: Readonly<{ id: string; time: number; position: number }> | null = null;
  for (const column of columns) {
    const position = field === 'melody' ? column.melodySelectedPosition : column.bassSelectedPosition;
    if (position === null) {
      previous = null;
      continue;
    }
    if (previous && column.time - previous.time <= .9
      && Math.abs(position - previous.position) <= maximumPositionDelta) {
      links.push({
        id: `${previous.id}-${column.id}`,
        x1: previous.time * pixelsPerSecond, y1: previous.position * 100,
        x2: column.time * pixelsPerSecond, y2: position * 100,
      });
    }
    previous = { id: column.id, time: column.time, position };
  }
  return links;
}

export function glyphColumnFromSlice(slice: ListeningRecordSlice): GlyphFieldColumn {
  const melody = slice.melody?.candidates.slice(0, GLYPH_MELODY_CANDIDATE_LIMIT).map((candidate, index) => ({
    id: `m-${candidate.rank}-${candidate.pitchHz.toFixed(2)}`,
    label: candidate.label,
    position: pitchPosition(candidate.midi, MELODY_MIN_MIDI, MELODY_MAX_MIDI),
    strength: clamp(.16 + candidate.score * .48 + candidate.salience * .22 + candidate.periodicity * .14, .16, 1),
    kind: index === slice.melody?.selectedCandidateIndex ? 'selected' as const : 'candidate' as const,
  })) ?? [];
  const rejected = slice.melody?.rejectedCandidates.slice(0, GLYPH_REJECTED_CANDIDATE_LIMIT).map(candidate => ({
    id: `r-${candidate.rank}-${candidate.pitchHz.toFixed(2)}`, label: '×',
    position: pitchPosition(candidate.midi, MELODY_MIN_MIDI, MELODY_MAX_MIDI),
    strength: clamp(.14 + candidate.score * .42, .14, .58), kind: 'rejected' as const,
  })) ?? [];
  const bass = slice.bass?.candidates.slice(0, GLYPH_BASS_CANDIDATE_LIMIT).map((candidate, index) => ({
    id: `b-${candidate.sourceRank}-${candidate.pitchHz.toFixed(2)}`,
    label: index === slice.bass?.selectedCandidateIndex ? candidate.label : '·',
    position: pitchPosition(candidate.midi, BASS_MIN_MIDI, BASS_MAX_MIDI),
    strength: clamp(.14 + candidate.score * .76, .14, .9),
    kind: index === slice.bass?.selectedCandidateIndex ? 'bass-selected' as const : 'bass-candidate' as const,
  })) ?? [];
  const melodySelected = melody.find(glyph => glyph.kind === 'selected');
  const bassSelected = bass.find(glyph => glyph.kind === 'bass-selected');
  return {
    id: slice.id, time: slice.time, melody: [...melody, ...rejected], bass,
    melodySelectedPosition: melodySelected?.position ?? null,
    bassSelectedPosition: bassSelected?.position ?? null,
  };
}
