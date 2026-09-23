import { PARK_TRAIN_ROUTE, PARK_TRAIN_STATIONS, PARK_VIEWBOX } from './config';
import { DoodleCircle, DoodlePath, DoodleLine } from '../doodle/DoodleSvg';

/** Static experience infrastructure. It consumes composition config only. */
export function ParkTrain() {
  return <g className="park-train" data-park-infrastructure="train" data-spatial-role="experience-infrastructure"
    aria-label="Park Train circulation railway">
    <DoodlePath className="park-train-bed" d={PARK_TRAIN_ROUTE} seed="park-train-bed" roughness={1.1} />
    <DoodlePath className="park-train-ties" d={PARK_TRAIN_ROUTE} seed="park-train-ties" roughness={1.35} />
    <DoodlePath className="park-train-rail" d={PARK_TRAIN_ROUTE} seed="park-train-rail" roughness={1.05} secondary />
    {PARK_TRAIN_STATIONS.map(station => <g key={station.id} className="park-train-station"
      data-train-station={station.id}
      transform={`translate(${station.x * PARK_VIEWBOX.width} ${station.y * PARK_VIEWBOX.height})`}>
      <DoodleLine x1={-8} y1={0} x2={8} y2={0} seed={`station-${station.id}`} roughness={0.5} />
      <DoodleCircle cx={0} cy={0} r={2.5} seed={`station-${station.id}-mark`} roughness={0.25} />
    </g>)}
  </g>;
}
