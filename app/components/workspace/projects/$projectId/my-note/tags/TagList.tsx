import React from 'react';
import { Search, Filter } from 'lucide-react';
import type { Tag } from '../types/tag.type';
import { TagPill } from './TagPill';

interface TagListProps {
  tags: Tag[];
  selectedTagIds: string[];
  onTagToggle: (tagId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  clearAllFilters: () => void;
}

export const TagList: React.FC<TagListProps> = ({
  tags,
  selectedTagIds,
  onTagToggle,
  searchQuery,
  onSearchChange,
  clearAllFilters
}) => {
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 border-r border-gray-200 bg-white h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="font-medium text-gray-900">Filter by Tags</h3>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tags..."
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="p-4">
        {/* Clear Filters */}
        {selectedTagIds.length > 0 && (
          <button
            onClick={clearAllFilters}
            className="w-full mb-3 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear All Filters ({selectedTagIds.length})
          </button>
        )}

        {/* Tag List */}
        <div className="space-y-2">
          {filteredTags.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              {searchQuery ? 'No tags found' : 'No tags created yet'}
            </p>
          ) : (
            filteredTags.map(tag => (
              <div
                key={tag.id}
                onClick={() => onTagToggle(tag.id)}
                className={`
                  p-2 rounded-lg border cursor-pointer transition-all
                  ${selectedTagIds.includes(tag.id) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={() => {}} // Handle by parent onClick
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {tag.name}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};