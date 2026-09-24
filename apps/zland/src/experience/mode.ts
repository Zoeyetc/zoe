export type ExperienceMode = 'park' | 'workbench';

export const resolveExperienceMode = (search: string): ExperienceMode => {
  const mode = new URLSearchParams(search).get('mode');
  return mode === 'workbench' ? mode : 'park';
};

export const physicsDebugVisible = (search: string) =>
  !new URLSearchParams(search).has('hide-physics-debug');
