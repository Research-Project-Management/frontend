import React from 'react';
import type { Tag } from '../types/tag.type';

interface TagPillProps {
  tag: Tag;
  onRemove?: (tagId: string) => void;
  removable?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const TagPill: React.FC<TagPillProps> = ({ 
  tag, 
  onRemove, 
  removable = false, 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

  return (
    <div 
      className={`
        inline-flex items-center gap-1 rounded-full text-white font-medium
        ${sizeClasses[size]}
        transition-all duration-200 hover:scale-105
      `}
      style={{ backgroundColor: tag.color }}
    >
      <span>{tag.name}</span>
      {removable && (
        <button
          onClick={() => onRemove?.(tag.id)}
          className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
          aria-label={`Remove tag ${tag.name}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};