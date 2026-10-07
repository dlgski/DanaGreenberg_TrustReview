import { useEffect, useState } from 'react';

/** Matches the CSS breakpoint where the source panel becomes a drawer. Keep in sync with the 1000px media queries. */
export const NARROW_LAYOUT_QUERY = '(max-width: 1000px)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}
