'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import Sidebar from '../components/Sidebar';
import ProfileTab from '@/features/account/components/ProfileTab';
import PreferencesTab from '@/features/account/components/PreferencesTab';
import NotificationsTab from '@/features/account/components/NotificationsTab';
import SecurityTab from '@/features/account/components/SecurityTab';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

export default function AccountModal({ isOpen, onClose, initialTab = 'profile' }: AccountModalProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Update activeTab if initialTab changes while modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab />;
      case 'preferences':
        return <PreferencesTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'security':
        return <SecurityTab />;
      default:
        return <ProfileTab />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className='max-w-[1100px] sm:max-w-[1100px] w-[90vw] h-[85vh] max-h-[800px] p-0 flex flex-row overflow-hidden gap-0 bg-background'
      >
        <VisuallyHidden>
          <DialogTitle>Account Settings</DialogTitle>
        </VisuallyHidden>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className='flex-1 overflow-y-auto bg-background/50'>
          {renderContent()}
        </main>
      </DialogContent>
    </Dialog>
  );
}
