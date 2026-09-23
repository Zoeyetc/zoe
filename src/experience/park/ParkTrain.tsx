import { PARK_TRAIN_ROUTE, PARK_TRAIN_STATIONS, PARK_VIEWBOX } from './config';

/** Static experience infrastructure. It consumes composition config only. */
export function ParkTrain() {
  return <g className="park-train" data-park-infrastructure="train" data-spatial-role="experience-infrastructure"
    aria-label="Park Train circulation railway">
    <path className="park-train-bed" d={PARK_TRAIN_ROUTE} />
    <path className="park-train-ties" d={PARK_TRAIN_ROUTE} />
    <path className="park-train-rail" d={PARK_TRAIN_ROUTE} />
    {PARK_TRAIN_STATIONS.map(station => <g key={station.id} className="park-train-station"
      data-train-station={station.id}
      transform={`translate(${station.x * PARK_VIEWBOX.width} ${station.y * PARK_VIEWBOX.height})`}>
      <line x1="-8" y1="0" x2="8" y2="0" />
      <circle r="2.5" />
    </g>)}
  </g>;
}
