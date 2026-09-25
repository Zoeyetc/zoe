# Zoë Listening Calibration Suite v0.1

Deterministic measurements of the existing motion responses. These are synthetic retained-evidence samples, not PCM or perceptual ratings. No mode parameters are changed by this suite.
Regenerate with `node scripts/listeningCalibration.ts` from the repository root.

- Step: 60 frames/s (0.016667 s); each case starts from fresh mode state with 0.5 s of inactive lead-in and 15.0 s of inactive tail.
- Reaction: first activity ≥ 0.02 after stimulus onset. Peak: maximum activity. Time above threshold: total duration with activity ≥ 0.10.
- Settle: time after the stimulus ends until activity stays ≤ 0.001 for the rest of the trace. Rest: time after stimulus end until activity stays exactly 0.
- Confirmation: first accepted Observatory state after stimulus onset; other modes have no confirmation state. “—” means the event did not occur within the trace.
- All time columns are seconds. “Settle” and “rest” are measured from the start of final silence, or from the end of the fade/alternating phase.

## Single transient

Input: 100 ms onset 1.0 with level 0.08, then silence.

| Mode | React | Settle | Peak | Above 0.10 | Confirm | Exact rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Instrument | 0.10 | 1.08 | 0.106 | 0.12 | — | 1.55 |
| Material | — | 0.00 | 0.000 | 0.00 | — | 0.00 |
| Field | — | 0.35 | 0.002 | 0.00 | — | 0.63 |
| Observatory | — | 0.00 | 0.000 | 0.00 | — | 0.00 |

## Repeated beats

Input: Six 120 ms beats at 0.5 s spacing; level 0.10 between beats.

| Mode | React | Settle | Peak | Above 0.10 | Confirm | Exact rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Instrument | 0.10 | 0.92 | 0.193 | 2.92 | — | 1.38 |
| Material | 0.75 | 2.97 | 0.120 | 1.15 | — | 7.58 |
| Field | 0.08 | 1.15 | 0.044 | 0.00 | — | 1.43 |
| Observatory | — | 0.00 | 0.000 | 0.00 | — | 0.00 |

## Constant tone

Input: Level 0.50, transient 0.08, structure 0.45 for 4 s.

| Mode | React | Settle | Peak | Above 0.10 | Confirm | Exact rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Instrument | 0.12 | 1.12 | 0.303 | 4.17 | — | 1.60 |
| Material | 0.52 | 4.62 | 0.488 | 5.20 | — | 9.23 |
| Field | 0.10 | 1.75 | 0.076 | 0.00 | — | 2.02 |
| Observatory | — | 0.00 | 0.000 | 0.00 | — | 0.00 |

## Sudden silence

Input: Four agreeing observations at 0.70 for 3 s; immediate silence.

| Mode | React | Settle | Peak | Above 0.10 | Confirm | Exact rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Instrument | 0.08 | 1.25 | 0.700 | 3.40 | — | 1.75 |
| Material | 0.37 | 4.93 | 0.649 | 4.82 | — | 9.55 |
| Field | 0.02 | 2.63 | 0.700 | 3.73 | — | 2.90 |
| Observatory | 1.62 | 2.57 | 0.550 | 3.52 | 1.50 | 2.58 |

## Gradual fade

Input: Four agreeing observations at 0.80 for 2 s, then linear fade over 3 s.

| Mode | React | Settle | Peak | Above 0.10 | Confirm | Exact rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Instrument | 0.08 | 0.85 | 0.800 | 4.87 | — | 1.33 |
| Material | 0.37 | 4.17 | 0.657 | 6.05 | — | 8.78 |
| Field | 0.02 | 1.88 | 0.799 | 5.00 | — | 2.17 |
| Observatory | 1.62 | 2.35 | 0.550 | 5.30 | 1.50 | 2.37 |

## Alternating agreement / disagreement

Input: 0.55 s agreeing, 0.55 s conflicting, repeated for 6.6 s.

| Mode | React | Settle | Peak | Above 0.10 | Confirm | Exact rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Instrument | 0.08 | 1.22 | 0.775 | 6.97 | — | 1.70 |
| Material | 0.37 | 4.92 | 0.668 | 8.38 | — | 9.52 |
| Field | 0.02 | 2.10 | 0.718 | 6.82 | — | 2.38 |
| Observatory | — | 0.00 | 0.000 | 0.00 | — | 0.00 |

## Short false consensus

Input: 0.75 s agreement, then 1.5 s isolated level.

| Mode | React | Settle | Peak | Above 0.10 | Confirm | Exact rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Instrument | 0.08 | 1.22 | 0.775 | 2.62 | — | 1.70 |
| Material | 0.37 | 4.67 | 0.498 | 3.80 | — | 9.28 |
| Field | 0.02 | 1.15 | 0.745 | 1.52 | — | 1.43 |
| Observatory | — | 0.00 | 0.000 | 0.00 | — | 0.00 |

## Long confirmed consensus

Input: Four agreeing observations at 0.80 for 4 s, then silence.

| Mode | React | Settle | Peak | Above 0.10 | Confirm | Exact rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Instrument | 0.08 | 1.27 | 0.800 | 4.42 | — | 1.77 |
| Material | 0.37 | 4.97 | 0.685 | 5.85 | — | 9.58 |
| Field | 0.02 | 2.68 | 0.800 | 4.78 | — | 2.97 |
| Observatory | 1.62 | 2.57 | 0.550 | 4.52 | 1.50 | 2.58 |

