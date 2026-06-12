"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProcessedMatch } from "@/lib/match-processor";

const BATCH_SIZE = 10;

async function fetchBatch(
  ids: string[],
  subject: string,
): Promise<{
  matches: Record<string, ProcessedMatch>;
  errors: Record<string, string>;
}> {
  const res = await fetch("/api/matches/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchIds: ids, subject }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request_failed");
  return {
    matches: (data.matches || {}) as Record<string, ProcessedMatch>,
    errors: (data.errors || {}) as Record<string, string>,
  };
}

export function useMatchDetails(matchIds: string[], subject: string) {
  const [matchesMap, setMatchesMap] = useState<Record<string, ProcessedMatch>>(
    {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [done, setDone] = useState(false);
  const runRef = useRef(0);

  const loadAll = useCallback(async () => {
    if (!matchIds.length || !subject) {
      setDone(true);
      return;
    }

    const runId = ++runRef.current;
    setLoading(true);
    setDone(false);
    setLoadedCount(0);
    setMatchesMap({});
    setErrors({});

    const chunks: string[][] = [];
    for (let i = 0; i < matchIds.length; i += BATCH_SIZE) {
      chunks.push(matchIds.slice(i, i + BATCH_SIZE));
    }

    let loaded = 0;
    for (const chunk of chunks) {
      if (runRef.current !== runId) return;
      try {
        const { matches, errors: batchErrors } = await fetchBatch(
          chunk,
          subject,
        );
        if (runRef.current !== runId) return;
        setMatchesMap((prev) => ({ ...prev, ...matches }));
        if (Object.keys(batchErrors).length) {
          setErrors((prev) => ({ ...prev, ...batchErrors }));
        }
        loaded += chunk.length;
        setLoadedCount(loaded);
      } catch (err) {
        if (runRef.current !== runId) return;
        const msg = err instanceof Error ? err.message : "request_failed";
        const chunkErrors: Record<string, string> = {};
        for (const id of chunk) chunkErrors[id] = msg;
        setErrors((prev) => ({ ...prev, ...chunkErrors }));
        loaded += chunk.length;
        setLoadedCount(loaded);
      }
    }

    if (runRef.current === runId) {
      setLoading(false);
      setDone(true);
    }
  }, [matchIds, subject]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const allMatches = useMemo(
    () =>
      matchIds
        .map((id) => matchesMap[id])
        .filter(Boolean) as ProcessedMatch[],
    [matchIds, matchesMap],
  );

  return {
    allMatches,
    matchesMap,
    errors,
    loading,
    loadedCount,
    totalCount: matchIds.length,
    done,
    reload: loadAll,
  };
}
