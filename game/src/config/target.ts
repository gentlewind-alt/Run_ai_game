/** Which build this is: the RUN web game ('run') or the standalone Android app ('android', `vite build --mode android`). */
export const TARGET: 'run' | 'android' = (import.meta as any).env?.MODE === 'android' ? 'android' : 'run';
