import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../apps/zland/src/styles.css', import.meta.url), 'utf8');
const park = readFileSync(new URL('../src/experience/park/ParkMap.tsx', import.meta.url), 'utf8');
const train = readFileSync(new URL('../src/experience/park/ParkTrain.tsx', import.meta.url), 'utf8');
const carousel = readFileSync(new URL('../src/rides/carousel/CarouselView.tsx', import.meta.url), 'utf8');
const ferris = readFileSync(new URL('../src/rides/ferris-wheel/FerrisWheelView.tsx', import.meta.url), 'utf8');

const token = (name: string) => {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `missing --${name}`);
  return match[1].trim();
};

const px = (name: string) => Number.parseFloat(token(name));

test('visual language defines one shared monochrome token system', () => {
  for (const name of [
    'z-background', 'z-surface', 'z-structure-primary', 'z-structure-secondary',
    'z-infrastructure', 'z-district', 'z-evidence', 'z-muted-text',
    'stroke-actor-primary', 'stroke-actor-secondary', 'stroke-infrastructure', 'stroke-district',
  ]) token(name);
  assert.doesNotMatch(css, /--z-evidence-(melody|harmony|rhythm|percussion|structure|phrase)/);
});

test('stroke tokens preserve actor, district, and infrastructure hierarchy', () => {
  assert.ok(px('stroke-actor-primary') > px('stroke-district'));
  assert.ok(px('stroke-district') > px('stroke-infrastructure'));
  assert.match(css, /\.park-roller-track \.park-track-rail \{ stroke-width: var\(--stroke-actor-primary\)/);
  assert.match(css, /\.park-train-rail \{[^}]*stroke-width: var\(--stroke-infrastructure\)/);
  assert.match(css, /\.park-district \{[^}]*stroke-width: var\(--stroke-district\)/);
});

test('precise Carousel and FerrisWheel carriers retain the single evidence accent', () => {
  assert.match(carousel, /pose\.active \? 'carousel-carrier carousel-carrier--active'/);
  assert.match(ferris, /cabin\.active \? 'ferris-cabin ferris-cabin--active'/);
  assert.match(css, /\.carousel-carrier--active \.carousel-carrier-frame \{[^}]*var\(--z-evidence\)/);
  assert.match(css, /\.ferris-cabin--active \.ferris-carrier \{[^}]*var\(--z-evidence-soft\)/);
  assert.match(css, /\.ferris-cabin--active \.ferris-carrier-media \{ fill: var\(--z-evidence\)/);
  assert.doesNotMatch(css, /\.ferris-ring \{[^}]*z-evidence/);
  assert.doesNotMatch(css, /\.carousel-(canopy|ring|mast|platform) \{[^}]*z-evidence/);
});

test('attention roles quiet structure without removing descendant evidence', () => {
  const ambient = css.match(/\.park-node\[data-attention-role='ambient'\][^{]*\{([^}]*)\}/)?.[1] ?? '';
  const resting = css.match(/\.park-node\[data-attention-role='resting'\][^{]*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(ambient, /--actor-primary/);
  assert.match(resting, /--actor-primary/);
  assert.doesNotMatch(ambient, /opacity/);
  assert.doesNotMatch(resting, /opacity/);
  assert.match(park, /<CarouselView state=\{state\.carousel\}/);
  assert.match(park, /<FerrisWheelView state=\{state\.ferrisWheel\}/);
});

test('Park Train remains quiet non-musical infrastructure', () => {
  assert.match(train, /data-spatial-role="experience-infrastructure"/);
  assert.doesNotMatch(train, /AudioWorld|AudioClock|snapshot|events|melody|harmony|rhythm|percussion|phrase|spectrum/);
  assert.doesNotMatch(css, /\.park-train[^}]*z-evidence/);
});

test('Park mode uses ordinary anchored content while workbench retains its development treatment', () => {
  assert.match(css, /\.content-participant-response \{[^}]*border: 2px/);
  assert.match(css, /\.park-map \.content-participant-response \{[^}]*border: 0;[^}]*border-left:/);
  assert.match(css, /\.park-map \.content-participant-response \{[^}]*background: transparent/);
});

test('Park presentation removes coordinate copy without changing focus or actor instances', () => {
  assert.doesNotMatch(park, /0,0 → 1,1|normalized PhysicsWorld/);
  assert.match(park, /className="park-viewport"/);
  assert.match(park, /data-focus-trigger=/);
  assert.doesNotMatch(park, /create[A-Z][A-Za-z]+Simulation/);
});
