'use client';

/**
 * ProjectNotificationsTab.tsx
 *
 * Notification preferences tab for Project Settings modal.
 * Location: `features/editor/ui/modals/project-settings/ProjectNotificationsTab.tsx`
 */

import React, { useState } from 'react';
import { SettingRow, OverleafSwitch } from './settings-common';

export function ProjectNotificationsTab() {
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyUpdates, setNotifyUpdates] = useState(false);

  return (
    <div className="space-y-1">
      <SettingRow
        title="Comments and mentions"
        description="Receive emails when someone mentions you or replies to your comments"
      >
        <OverleafSwitch
          checked={notifyComments}
          onCheckedChange={setNotifyComments}
          aria-label="Comments and mentions"
        />
      </SettingRow>

      <SettingRow
        title="Project activity summary"
        description="Receive weekly summaries of changes and collaboration in this project"
      >
        <OverleafSwitch
          checked={notifyUpdates}
          onCheckedChange={setNotifyUpdates}
          aria-label="Project activity summary"
        />
      </SettingRow>
    </div>
  );
}
