import React from 'react';

export const SidebarPanel = ({ children, className }: any) => <div className={className}>{children}</div>;
export const SidebarSegmented = ({ children, className }: any) => <div className={className}>{children}</div>;
export const SidebarSection = ({ children, className }: any) => <div className={className}>{children}</div>;
export const SidebarEmptyState = ({ children, className }: any) => <div className={className}>{children}</div>;
export const SidebarHeader = ({ children, className }: any) => <div className={className}>{children}</div>;
export const SidebarIconButton = ({ children, className, onClick }: any) => <button className={className} onClick={onClick}>{children}</button>;
