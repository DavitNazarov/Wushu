'use client';

import { useRef, useState } from 'react';

export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);

  function handleMouseMove(e: React.MouseEvent<T>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function handleMouseLeave() {
    setSpot(null);
  }

  return { ref, spot, handleMouseMove, handleMouseLeave };
}
