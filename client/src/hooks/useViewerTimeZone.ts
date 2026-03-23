"use client";

import { useEffect, useState } from 'react';

export function useViewerTimeZone(defaultTimeZone = 'UTC') {
  const [viewerTimeZone, setViewerTimeZone] = useState(defaultTimeZone);

  useEffect(() => {
    setViewerTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || defaultTimeZone);
  }, [defaultTimeZone]);

  return viewerTimeZone;
}
