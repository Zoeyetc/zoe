export type ExperienceMode = 'park' | 'workbench';

export const resolveExperienceMode = (search: string): ExperienceMode =>
  new URLSearchParams(search).get('mode') === 'workbench' ? 'workbench' : 'park';

export const physicsDebugVisible = (search: string) =>
  !new URLSearchParams(search).has('hide-physics-debug');
