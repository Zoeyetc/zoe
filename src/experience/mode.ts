export type ExperienceMode = 'park' | 'workbench' | 'signal-console';

export const resolveExperienceMode = (search: string): ExperienceMode => {
  const mode = new URLSearchParams(search).get('mode');
  return mode === 'workbench' || mode === 'signal-console' ? mode : 'park';
};

export const physicsDebugVisible = (search: string) =>
  !new URLSearchParams(search).has('hide-physics-debug');
