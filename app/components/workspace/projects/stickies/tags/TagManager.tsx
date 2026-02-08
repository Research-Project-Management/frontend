import React, { useState } from 'react';
import { Settings, Edit, Trash2, Plus, X } from 'lucide-react';
import type { Tag } from '../types/tag.type';
import { TagPill } from './TagPill';

interface TagManagerProps {
  tags: Tag[];
  onCreateTag: (name: string, color: string) => void;
  onUpdateTag: (tagId: string, updates: { name?: string; color?: string }) => void;
  onDeleteTag: (tagId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const tagColors = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#14b8a6', '#a855f7', '#10b981'
];

export const TagManager: React.FC<TagManagerProps> = ({
  tags,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  isOpen,
  onClose
}) => {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(tagColors[0]);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      onCreateTag(newTagName.trim(), newTagColor);
      setNewTagName('');
      setNewTagColor(tagColors[0]);
    }
  };

  const handleUpdateTag = (tagId: string) => {
    const updates: { name?: string; color?: string } = {};
    if (editName.trim()) updates.name = editName.trim();
    if (editColor) updates.color = editColor;
    
    if (Object.keys(updates).length > 0) {
      onUpdateTag(tagId, updates);
    }
    setEditingTag(null);
    setEditName('');
    setEditColor('');
  };

  const startEdit = (tag: Tag) => {
    setEditingTag(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Manage Tags</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Create New Tag */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Create New Tag</h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateTag()}
            />
            <div className="flex gap-1">
              {tagColors.slice(0, 8).map(color => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    newTagColor === color ? 'border-gray-800 scale-110' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
              className="p-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tag List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Existing Tags ({tags.length})
          </h3>
          {tags.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No tags created yet. Create your first tag above!
            </p>
          ) : (
            <div className="space-y-2">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
                  {editingTag === tag.id ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {tagColors.slice(0, 6).map(color => (
                          <button
                            key={color}
                            onClick={() => setEditColor(color)}
                            className={`w-4 h-4 rounded-full border-2 transition-all ${
                              editColor === color ? 'border-gray-800 scale-110' : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => handleUpdateTag(tag.id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingTag(null)}
                        className="p-1 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <TagPill tag={tag} size="sm" />
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => startEdit(tag)}
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteTag(tag.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};