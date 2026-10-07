import { useCallback, useEffect, useRef, useState } from 'react';
import { streamExtraction, type StreamScenario } from './streamExtraction';
import type { ExtractionField, JobStatus } from './types';

export function useExtractionStream(scenario: StreamScenario) {
  const [status, setStatus] = useState<JobStatus>('idle');
  const [fields, setFields] = useState<ExtractionField[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cancelRef = useRef<(() => void) | null>(null);

  const start = useCallback(() => {
    cancelRef.current?.();
    setFields([]);
    setErrorMessage(null);
    setStatus('streaming');
    cancelRef.current = streamExtraction((event) => {
      if (event.type === 'field' && event.field) {
        setFields((prev) => [...prev, event.field as ExtractionField]);
      } else if (event.type === 'done') {
        setStatus('complete');
      } else if (event.type === 'error') {
        setStatus('failed');
        setErrorMessage(event.message ?? 'The extraction job failed.');
      }
    }, scenario).cancel;
  }, [scenario]);

  useEffect(() => {
    if (attempt === 0) return;
    start();
    return () => cancelRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, attempt]);

  const begin = useCallback(() => setAttempt((n) => n + 1), []);
  const retry = begin;

  return { status, fields, errorMessage, begin, retry, attempt };
}
