import { useEffect, useRef, useState } from 'react';
import { MotionMode, MOTION_MODES, MOTION_MODE_NAMES } from './MotionMode.ts';

const MODE_DISCOVERABILITY: Readonly<Record<MotionMode, Readonly<{ label: string; description: string }>>> = {
  [MotionMode.Instrument]: { label: 'Listen Now', description: 'Reads current activity.' },
  [MotionMode.Material]: { label: 'Remember', description: 'Remembers sustained pressure.' },
  [MotionMode.Field]: { label: 'Compare', description: 'Compares observations.' },
  [MotionMode.Observatory]: { label: 'Confirm', description: 'Waits for confirmation.' },
};

export type MotionControlsProps = Readonly<{
  mode: MotionMode;
  enabled: boolean;
  select(mode: MotionMode): void;
  setEnabled(enabled: boolean): void;
}>;

export function MotionControls({ mode, enabled, select, setEnabled }: MotionControlsProps) {
  const [expanded, setExpanded] = useState<MotionMode | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelCollapse = () => {
    if (collapseTimer.current !== null) clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
  };
  useEffect(() => cancelCollapse, []);
  const choose = (next: MotionMode) => {
    cancelCollapse();
    select(next);
    setEnabled(true);
    setExpanded(next);
    collapseTimer.current = setTimeout(() => {
      setExpanded(null);
      collapseTimer.current = null;
    }, 3000);
  };
  return <span className="signal-motion-controls" role="group" aria-label="Motion" data-expanded={expanded !== null && enabled}>
    <button type="button" aria-label="Motion OFF" aria-pressed={!enabled} onClick={() => {
      cancelCollapse(); setExpanded(null); setEnabled(false);
    }}>[MOTION OFF]</button>
    {MOTION_MODES.map(item => <button key={item} type="button" className="signal-motion-mode"
      aria-label={`Motion ${MOTION_MODE_NAMES[item]}`} aria-pressed={enabled && mode === item}
      data-expanded={enabled && mode === item && expanded === item} onClick={() => choose(item)}>
      <span aria-hidden="true">{enabled && mode === item ? '●' : '○'}</span>
      <span className="signal-motion-mode-label" aria-hidden="true"><span>{MODE_DISCOVERABILITY[item].label}</span></span>
    </button>)}
    {enabled && expanded !== null && <span className="signal-motion-description">{MODE_DISCOVERABILITY[expanded].description}</span>}
  </span>;
}
