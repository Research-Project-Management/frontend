'use client';

import React, { Suspense } from 'react';
import { IntegrationsHub } from '../components/integrations/IntegrationsHub';

export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationsHub />
    </Suspense>
  );
}
