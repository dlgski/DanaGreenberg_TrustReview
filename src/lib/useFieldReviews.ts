import { useCallback, useEffect, useState } from 'react';
import type { FieldReviewState } from './types';

export function useFieldReviews(resetKey: unknown) {
  const [reviews, setReviews] = useState<Record<string, FieldReviewState>>({});

  useEffect(() => {
    setReviews({});
  }, [resetKey]);

  const confirm = useCallback((fieldId: string) => {
    setReviews((prev) => ({
      ...prev,
      [fieldId]: { decision: 'confirmed', reviewedAt: new Date().toISOString() },
    }));
  }, []);

  const reject = useCallback((fieldId: string) => {
    setReviews((prev) => ({
      ...prev,
      [fieldId]: { decision: 'rejected', reviewedAt: new Date().toISOString() },
    }));
  }, []);

  const edit = useCallback((fieldId: string, editedValue: string) => {
    setReviews((prev) => ({
      ...prev,
      [fieldId]: { decision: 'edited', editedValue, reviewedAt: new Date().toISOString() },
    }));
  }, []);

  const resolveCandidate = useCallback(
    (fieldId: string, chosenValue: string, originalValue: string) => {
      setReviews((prev) => ({
        ...prev,
        [fieldId]:
          chosenValue === originalValue
            ? { decision: 'confirmed', reviewedAt: new Date().toISOString() }
            : {
                decision: 'edited',
                editedValue: chosenValue,
                resolvedCandidate: chosenValue,
                reviewedAt: new Date().toISOString(),
              },
      }));
    },
    [],
  );

  /** Sends a field back to "not reviewed", e.g. when a calculated field's inputs change. */
  const reset = useCallback((fieldId: string) => {
    setReviews((prev) => {
      if (!(fieldId in prev)) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const getDecision = useCallback(
    (fieldId: string): FieldReviewState => reviews[fieldId] ?? { decision: 'pending' },
    [reviews],
  );

  return { reviews, confirm, reject, edit, resolveCandidate, reset, getDecision };
}
