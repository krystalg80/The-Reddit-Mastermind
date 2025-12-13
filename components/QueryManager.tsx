'use client';

import { useState } from 'react';
import { ChatGPTQuery } from '@/lib/types';

interface QueryManagerProps {
  companyId?: string;
  queries: ChatGPTQuery[];
  onQueriesChange: (queries: ChatGPTQuery[]) => void;
}

export default function QueryManager({ companyId, queries, onQueriesChange }: QueryManagerProps) {
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
    <div className="bg-white p-6 rounded-xl shadow-soft border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">ChatGPT Queries ({queries.length})</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
        >
          {isAdding ? 'Cancel' : '+ Add Query'}
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 space-y-3">
          <textarea
            placeholder="Query text (e.g., 'How to improve presentation skills') *"
            value={newQuery.query}
            onChange={(e) => setNewQuery({ ...newQuery, query: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
          />
          <select
            value={newQuery.intent}
            onChange={(e) => setNewQuery({ ...newQuery, intent: e.target.value as ChatGPTQuery['intent'] })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
          >
            <option value="question">Question</option>
            <option value="discussion">Discussion</option>
            <option value="advice">Advice</option>
            <option value="review">Review</option>
          </select>
          <button
            onClick={handleAddQuery}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-2.5 rounded-lg hover:from-primary-700 hover:to-primary-800 font-semibold transition-all shadow-soft hover:shadow-medium"
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
              className="text-red-600 hover:text-red-700 ml-2 font-medium text-sm transition-colors"
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

