# Zoë Motion Study baseline lock v0.1

This compares the current working-tree production UI with `?motion-study=off`
and the A/B/C study flags. It freezes the current presentation as measured; it
does not select a motion direction or grant subjective visual approval.

## Method

- Chrome production preview, same unloaded reference state, same viewport.
- Repeated the 1920×1080 comparison with the same real song paused at
  01:14.100, so Observed Pitch residue, Harmony, and Tonal evidence are
  populated rather than placeholders.
- Captured screenshots and computed-style/geometry JSON for every state at
  1920×1080, 1280×720, and 1920×1080 with the fullscreen control active.
- Compared the 407 non-canvas elements in DOM order for text, bounding boxes,
  font family/size/weight/line height/letter spacing/numeric variant, margins,
  padding, gap, display, position, whitespace, and text alignment.
- Screenshot comparisons use JPEG captures, so a changed rule can create small
  compression differences in adjacent pixels.

## Result

| State | Text differences | Font differences | Spacing differences | Geometry differences | Layout-property differences | Overflow |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Off, A, B, C at 1920×1080 | 0 | 0 | 0 | 0 | 0 | 0 |
| Off, A, B, C at 1280×720 | 0 | 0 | 0 | 0 | 0 | 0 |
| Off, A, B, C with fullscreen control active | 0 | 0 | 0 | 0 | 0 | 0 |
| Off, A, B, C with populated real-audio evidence | 0 | 0 | 0 | 0 | 0 | 0 |

At each size, production, explicit Off, B, and C have byte-identical idle
screenshots. A differs because it substitutes the existing divider paint with
the shader; its only computed-style differences are 11 border colors on divider
elements. Border widths and every non-canvas bounding box remain unchanged.
At 1920×1080, all 79,913 differing A screenshot pixels fall within a 16px
margin of those divider lines or a small transport-thumb JPEG artifact region.
See `normal-1920/a-diff.png` for the raw difference map.

The populated real-audio pass contains 409 non-canvas elements. Production,
explicit Off, B, and C again have byte-identical screenshots. A changes only
the divider paint; all 409 elements retain the same text, typography, spacing,
and bounding boxes. The A screenshot has 54 additional pixels in one nearby
text glyph outside the divider/transport-thumb mask; each RGB channel differs
by at most 6 in the lossy JPEG capture. Therefore the JPEG is not a proof of
strict glyph-pixel identity for A; the computed typography and geometry are
identical, and no glyph dimensions or line breaks change.

The canvas exactly matches the production root rectangle: 1480×850.7266 at
1920×1080, 1264×678.6172 at 1280×720, and 1920×1080 when the fullscreen
control is active. The canvas is fixed and pointer-transparent; it does not
change the root's positioning or any content geometry.

The browser control exposed the active fullscreen UI state and a 1920×1080
root, but its isolated DOM read reported `document.fullscreenElement` as false.
This comparison verifies the fullscreen composition and geometry, not an
independent OS-level fullscreen assertion.
