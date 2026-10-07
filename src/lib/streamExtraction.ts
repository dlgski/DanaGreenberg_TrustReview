import { normalizeExtraction } from './normalizeExtraction';
import type { StreamEvent } from './types';

export type StreamScenario = 'success' | 'fails-partway' | 'slow';

const SCENARIOS: StreamScenario[] = ['success', 'fails-partway', 'slow'];

export function isStreamScenario(value: string | null): value is StreamScenario {
  return value !== null && (SCENARIOS as string[]).includes(value);
}

const { fields, sourcePages, provenance, figuresInThousands } = normalizeExtraction();

/** Every field in the extraction, whether or not it has streamed in yet. */
export const allFields = fields;

export { sourcePages, provenance, figuresInThousands };
export const TOTAL_FIELD_COUNT = fields.length;

interface StreamHandle {
  cancel: () => void;
}

/**
 * Simulates a field-by-field extraction job: fields arrive one at a time
 * over roughly 10 seconds rather than all at once, and the 'fails-partway'
 * scenario stops the job midstream the way a real extraction job can fail.
 */
export function streamExtraction(
  onEvent: (event: StreamEvent) => void,
  scenario: StreamScenario = 'success',
): StreamHandle {
  let cancelled = false;
  const timeouts: ReturnType<typeof setTimeout>[] = [];

  const totalDurationMs = scenario === 'slow' ? 24000 : 10000;
  const fieldCount =
    scenario === 'fails-partway' ? Math.ceil(fields.length * 0.55) : fields.length;
  const baseInterval = totalDurationMs / fields.length;

  let elapsed = 0;
  for (let i = 0; i < fieldCount; i++) {
    const jitter = baseInterval * (Math.random() * 0.6 - 0.3);
    elapsed += baseInterval + jitter;
    const field = fields[i];
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      onEvent({ type: 'field', field });
    }, elapsed);
    timeouts.push(timeoutId);
  }

  const finalTimeoutId = setTimeout(() => {
    if (cancelled) return;
    if (scenario === 'fails-partway') {
      onEvent({
        type: 'error',
        message: 'Extraction job lost connection to the document service before finishing.',
      });
    } else {
      onEvent({ type: 'done' });
    }
  }, elapsed + baseInterval * 0.5);
  timeouts.push(finalTimeoutId);

  return {
    cancel: () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    },
  };
}
