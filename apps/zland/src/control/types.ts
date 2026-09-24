export interface ControlActions {
  play(): void;
  pause(): void;
  seek(time: number): void;
  restart(): void;
}

/** Reserved for future preparation UI; this skeleton uses one prepared empty map. */
export type SongPreparationState = 'unavailable' | 'preparing' | 'ready' | 'error';
