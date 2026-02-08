import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Plus } from 'lucide-react';
import type { Tag } from '../types/tag.type';
import { TagPill } from './TagPill';

interface TagSelectorProps {
  availableTags: Tag[];
  selectedTags: Tag[];
  onTagSelect: (tag: Tag) => void;
  onTagRemove: (tagId: string) => void;
  onCreateNew: (name: string, color: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
}

const tagColors = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

export const TagSelector: React.FC<TagSelectorProps> = ({
  availableTags,
  selectedTags,
  onTagSelect,
  onTagRemove,
  onCreateNew,
  placeholder = "Select or create tags...",
  allowCreate = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(tagColors[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setNewTagName('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedTags.some(selected => selected.id === tag.id)
  );

  const handleCreateNew = () => {
    if (newTagName.trim()) {
      onCreateNew(newTagName.trim(), selectedColor);
      setNewTagName('');
      setSelectedColor(tagColors[0]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map(tag => (
          <TagPill
            key={tag.id}
            tag={tag}
            onRemove={onTagRemove}
            removable
            size="sm"
          />
        ))}
      </div>

      {/* Dropdown Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <Search className="w-4 h-4 text-gray-400" />
        <span className="flex-1 text-sm text-gray-600">
          {selectedTags.length === 0 ? placeholder : `${selectedTags.length} tag${selectedTags.length !== 1 ? 's' : ''} selected`}
        </span>
        <Plus className="w-4 h-4 text-gray-400" />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Tag List */}
          <div className="max-h-40 overflow-y-auto">
            {filteredTags.length > 0 ? (
              filteredTags.map(tag => (
                <div
                  key={tag.id}
                  onClick={() => onTagSelect(tag)}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                >
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm">{tag.name}</span>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                {searchQuery ? 'No tags found' : 'No more tags available'}
              </div>
            )}
          </div>

          {/* Create New Tag */}
          {allowCreate && (
            <div className="border-t border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="New tag name..."
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateNew()}
                />
                <div className="flex gap-1">
                  {tagColors.slice(0, 6).map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                        selectedColor === color ? 'border-gray-800 scale-110' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreateNew}
                disabled={!newTagName.trim()}
                className="w-full py-1 bg-blue-500 text-white rounded text-sm disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
              >
                Create Tag
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};