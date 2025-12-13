'use client';

import { useState } from 'react';
import { Subreddit } from '@/lib/types';

interface SubredditManagerProps {
  companyId?: string;
  subreddits: Subreddit[];
  onSubredditsChange: (subreddits: Subreddit[]) => void;
}

export default function SubredditManager({ subreddits, onSubredditsChange }: SubredditManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSubreddit, setNewSubreddit] = useState<Partial<Subreddit>>({
    name: '',
    description: '',
    post_frequency_limit: 2,
  });

  const handleAddSubreddit = () => {
    if (!newSubreddit.name) {
      alert('Please enter a subreddit name');
      return;
    }

    const subreddit: Subreddit = {
      company_id: companyId || '',
      name: newSubreddit.name.startsWith('r/') 
        ? newSubreddit.name.substring(2) 
        : newSubreddit.name,
      description: newSubreddit.description,
      post_frequency_limit: newSubreddit.post_frequency_limit || 2,
    };

    onSubredditsChange([...subreddits, subreddit]);
    setNewSubreddit({
      name: '',
      description: '',
      post_frequency_limit: 2,
    });
    setIsAdding(false);
  };

  const handleRemoveSubreddit = (index: number) => {
    onSubredditsChange(subreddits.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Subreddits ({subreddits.length})</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          {isAdding ? 'Cancel' : '+ Add Subreddit'}
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Subreddit name (e.g., r/startups or startups) *"
            value={newSubreddit.name}
            onChange={(e) => setNewSubreddit({ ...newSubreddit, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <textarea
            placeholder="Description (optional)"
            value={newSubreddit.description}
            onChange={(e) => setNewSubreddit({ ...newSubreddit, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Posts per week limit
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={newSubreddit.post_frequency_limit}
              onChange={(e) => setNewSubreddit({ 
                ...newSubreddit, 
                post_frequency_limit: parseInt(e.target.value) || 2 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            onClick={handleAddSubreddit}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
          >
            Add Subreddit
          </button>
        </div>
      )}

      <div className="space-y-2">
        {subreddits.map((subreddit, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
            <div>
              <div className="font-semibold text-gray-900">r/{subreddit.name}</div>
              {subreddit.description && (
                <div className="text-sm text-gray-600">{subreddit.description}</div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                Limit: {subreddit.post_frequency_limit || 2} posts/week
              </div>
            </div>
            <button
              onClick={() => handleRemoveSubreddit(index)}
              className="text-red-600 hover:text-red-700 ml-2"
            >
              Remove
            </button>
          </div>
        ))}
        {subreddits.length === 0 && (
          <p className="text-gray-500 text-sm">No subreddits added yet. Add at least 1 subreddit.</p>
        )}
      </div>
    </div>
  );
}

