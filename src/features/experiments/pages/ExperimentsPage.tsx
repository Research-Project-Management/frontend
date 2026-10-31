'use client';

import React from 'react';
import { ExperimentsTopbar } from '../components/ExperimentsTopbar';
import { ExperimentsContent } from '../components/ExperimentsContent';
import { ExperimentsInspector } from '../components/ExperimentsInspector';
import { ExperimentsModals } from '../components/ExperimentsModals';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';

export function ExperimentsPage() {
  return (
    <div className="flex h-full w-full min-h-0 relative">
      {/* Main Workspace (Topbar + Data Content) */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        <ExperimentsTopbar />
        <div className="flex-1 overflow-hidden min-h-0 relative">
          <ExperimentsContent />
        </div>
      </div>

      {/* Right Inspector Panel */}
      <ErrorBoundary variant="section" featureName="Experiment Run Inspector">
        <ExperimentsInspector />
      </ErrorBoundary>

      {/* Interactive Scientific Modals (Artifact Preview, Log Run, LaTeX Generator) */}
      <ExperimentsModals />
    </div>
  );
}

export default ExperimentsPage;
