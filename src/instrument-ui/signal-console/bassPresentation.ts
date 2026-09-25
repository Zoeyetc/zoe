import { midiToNoteName } from '@zoeyetc/computational-listening-engine';
import type { BassEvidence, BassEvidenceFrame, BassSnapshot } from '@zoeyetc/computational-listening-engine';

export type BassPresentation = Readonly<{
  noteName: string;
  frequencyHz: string;
  state: BassSnapshot['reason'] | 'UNAVAILABLE';
  score: string;
  frame: BassEvidenceFrame | null;
  confidence: 'UNCALIBRATED';
}>;

/** Display the Engine's independent Bass decision without inferring a fallback from Melody. */
export function selectBassPresentation(snapshot: BassSnapshot | null | undefined,
  evidence: BassEvidence | null | undefined): BassPresentation {
  const frame = snapshot && evidence?.frames.find(item => item.time === snapshot.time) || null;
  const selected = Boolean(snapshot?.available && snapshot.pitchHz !== null && snapshot.midiFloat !== null);
  return {
    noteName: selected ? midiToNoteName(Math.round(snapshot!.midiFloat!)) : '—',
    frequencyHz: selected ? snapshot!.pitchHz!.toFixed(2) : '—',
    state: snapshot?.reason ?? 'UNAVAILABLE',
    score: selected && snapshot?.candidateScore !== null && snapshot?.candidateScore !== undefined
      ? snapshot.candidateScore.toFixed(3) : '—',
    frame,
    confidence: 'UNCALIBRATED',
  };
}
