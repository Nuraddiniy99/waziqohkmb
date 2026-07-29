"use client";

import { useState, useEffect } from 'react';
import { MOBILE_BREAKPOINT } from '@/lib/utils/constants';

export const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [width, setWidth] = useState(1920);

  useEffect(() => {
    const checkWidth = () => {
      const w = window.innerWidth;
      setWidth(w);
      setIsMobile(w < MOBILE_BREAKPOINT);
      setIsDesktop(w >= MOBILE_BREAKPOINT);
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return { isMobile, isDesktop, width };
};
