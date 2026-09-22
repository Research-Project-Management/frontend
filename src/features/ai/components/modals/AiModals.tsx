'use client';

import React from 'react';
import { SkillsModal } from './SkillsModal';
import { UsageModal } from './UsageModal';
import { AnalyticsModal } from './AnalyticsModal';
import { MemoryModal } from './MemoryModal';

export function AiModals() {
  return (
    <>
      <SkillsModal />
      <UsageModal />
      <AnalyticsModal />
      <MemoryModal />
    </>
  );
}

export default AiModals;
