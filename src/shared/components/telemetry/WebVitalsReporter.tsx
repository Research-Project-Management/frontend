'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { logger } from '@/shared/lib/logger';

const CORE_METRICS = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);

interface WebVitalsMetric {
  id: string;
  name: string;
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  navigationType?: string;
}

/**
 * Reports Core Web Vitals metrics through the unified structured logger.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric: WebVitalsMetric) => {
    if (!CORE_METRICS.has(metric.name)) return;

    const payload = {
      id: metric.id,
      name: metric.name,
      value:
        metric.name === 'CLS'
          ? Math.round(metric.value * 1000) / 1000
          : Math.round(metric.value),
      rating: metric.rating,
      navigationType: metric.navigationType,
      pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
    };

    if (metric.rating === 'poor') {
      logger.warn('[WebVitals] Poor metric', payload);
    } else if (metric.rating === 'needs-improvement') {
      logger.info('[WebVitals] Needs improvement', payload);
    } else {
      logger.debug('[WebVitals]', payload);
    }
  });

  return null;
}

export default WebVitalsReporter;
