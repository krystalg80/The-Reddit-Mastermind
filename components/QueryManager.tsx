'use client';

import { useState } from 'react';
import { ChatGPTQuery } from '@/lib/types';

interface QueryManagerProps {
  companyId?: string;
  queries: ChatGPTQuery[];
  onQueriesChange: (queries: ChatGPTQuery[]) => void;
}

export default function QueryManager({ queries, onQueriesChange }: QueryManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newQuery, setNewQuery] = useState<Partial<ChatGPTQuery>>({
    query: '',
    intent: 'question',
  });

  const handleAddQuery = () => {
    if (!newQuery.query) {
      alert('Please enter a query');
      return;
    }

    const query: ChatGPTQuery = {
      company_id: companyId || '',
      query: newQuery.query,
      intent: newQuery.intent || 'question',
    };

    onQueriesChange([...queries, query]);
    setNewQuery({
      query: '',
      intent: 'question',
    });
    setIsAdding(false);
  };

  const handleRemoveQuery = (index: number) => {
    onQueriesChange(queries.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">ChatGPT Queries ({queries.length})</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          {isAdding ? 'Cancel' : '+ Add Query'}
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <textarea
            placeholder="Query text (e.g., 'How to improve presentation skills') *"
            value={newQuery.query}
            onChange={(e) => setNewQuery({ ...newQuery, query: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <select
            value={newQuery.intent}
            onChange={(e) => setNewQuery({ ...newQuery, intent: e.target.value as ChatGPTQuery['intent'] })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="question">Question</option>
            <option value="discussion">Discussion</option>
            <option value="advice">Advice</option>
            <option value="review">Review</option>
          </select>
          <button
            onClick={handleAddQuery}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
          >
            Add Query
          </button>
        </div>
      )}

      <div className="space-y-2">
        {queries.map((query, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg flex justify-between items-start">
            <div className="flex-1">
              <div className="text-gray-900">{query.query}</div>
              <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                {query.intent}
              </span>
            </div>
            <button
              onClick={() => handleRemoveQuery(index)}
              className="text-red-600 hover:text-red-700 ml-2"
            >
              Remove
            </button>
          </div>
        ))}
        {queries.length === 0 && (
          <p className="text-gray-500 text-sm">No queries added yet. Add at least 1 ChatGPT query.</p>
        )}
      </div>
    </div>
  );
}

