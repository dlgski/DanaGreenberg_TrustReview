import './Icon.css';

export type IconName = 'warning' | 'split' | 'calculator';

const PATHS: Record<IconName, string> = {
  warning: 'M8 1.5 15 14H1L8 1.5Zm-.75 4.5v4h1.5V6h-1.5Zm0 5.25v1.5h1.5v-1.5h-1.5Z',
  split: 'M2 3h5v10H2V3Zm1.5 1.5v7h2v-7h-2ZM9 3h5v10H9V3Z',
  calculator:
    'M3 2h10v12H3V2Zm1.5 1.5v2.5h7V3.5h-7Zm0 4v1.5H6V7.5H4.5Zm2.75 0v1.5h1.5V7.5h-1.5Zm2.75 0v1.5h1.5V7.5H10Zm-5.5 3V12H6v-1.5H4.5Zm2.75 0V12h1.5v-1.5h-1.5Zm2.75 0V12h1.5v-1.5H10Z',
};

/** Decorative only: every icon sits next to text that says the same thing. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={PATHS[name]} />
    </svg>
  );
}
