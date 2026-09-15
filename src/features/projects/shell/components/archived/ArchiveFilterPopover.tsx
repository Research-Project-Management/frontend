'use client';

import React from 'react';
import { ProjectFilterPopover, type ProjectFilterPopoverProps } from '../project/ProjectFilterPopover';

export type ArchiveFilterPopoverProps = ProjectFilterPopoverProps;

export function ArchiveFilterPopover(props: ArchiveFilterPopoverProps) {
  return <ProjectFilterPopover {...props} />;
}

export default ArchiveFilterPopover;
