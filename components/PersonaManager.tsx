'use client';

import { useState } from 'react';
import { Persona } from '@/lib/types';

interface PersonaManagerProps {
  companyId?: string;
  personas: Persona[];
  onPersonasChange: (personas: Persona[]) => void;
}

export default function PersonaManager({ companyId, personas, onPersonasChange }: PersonaManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newPersona, setNewPersona] = useState<Partial<Persona>>({
    name: '',
    bio: '',
    expertise_areas: [],
    tone: 'casual',
    reddit_username: '',
  });
  const [expertiseInput, setExpertiseInput] = useState('');

  const handleAddPersona = () => {
    if (!newPersona.name || !newPersona.bio || !newPersona.reddit_username) {
      alert('Please fill in all required fields');
      return;
    }

    const persona: Persona = {
      company_id: companyId || '',
      name: newPersona.name,
      bio: newPersona.bio,
      expertise_areas: newPersona.expertise_areas || [],
      tone: newPersona.tone || 'casual',
      reddit_username: newPersona.reddit_username,
    };

    onPersonasChange([...personas, persona]);
    setNewPersona({
      name: '',
      bio: '',
      expertise_areas: [],
      tone: 'casual',
      reddit_username: '',
    });
    setExpertiseInput('');
    setIsAdding(false);
  };

  const handleRemovePersona = (index: number) => {
    onPersonasChange(personas.filter((_, i) => i !== index));
  };

  const addExpertise = () => {
    if (expertiseInput.trim()) {
      setNewPersona({
        ...newPersona,
        expertise_areas: [...(newPersona.expertise_areas || []), expertiseInput.trim()],
      });
      setExpertiseInput('');
    }
  };

  const removeExpertise = (index: number) => {
    const updated = [...(newPersona.expertise_areas || [])];
    updated.splice(index, 1);
    setNewPersona({ ...newPersona, expertise_areas: updated });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-soft border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Personas ({personas.length})</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
        >
          {isAdding ? 'Cancel' : '+ Add Persona'}
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 space-y-3">
          <input
            type="text"
            placeholder="Name *"
            value={newPersona.name}
            onChange={(e) => setNewPersona({ ...newPersona, name: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
          />
          <textarea
            placeholder="Bio *"
            value={newPersona.bio}
            onChange={(e) => setNewPersona({ ...newPersona, bio: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
          />
          <input
            type="text"
            placeholder="Reddit Username *"
            value={newPersona.reddit_username}
            onChange={(e) => setNewPersona({ ...newPersona, reddit_username: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Expertise area"
              value={expertiseInput}
              onChange={(e) => setExpertiseInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExpertise())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={addExpertise}
              className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Add
            </button>
          </div>
          {newPersona.expertise_areas && newPersona.expertise_areas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {newPersona.expertise_areas.map((area, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm flex items-center gap-1"
                >
                  {area}
                  <button
                    onClick={() => removeExpertise(idx)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <select
            value={newPersona.tone}
            onChange={(e) => setNewPersona({ ...newPersona, tone: e.target.value as Persona['tone'] })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
          >
            <option value="casual">Casual</option>
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="technical">Technical</option>
            <option value="humorous">Humorous</option>
          </select>
          <button
            onClick={handleAddPersona}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
          >
            Add Persona
          </button>
        </div>
      )}

      <div className="space-y-3">
        {personas.map((persona, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg flex justify-between items-start">
            <div className="flex-1">
              <div className="font-semibold text-gray-900">{persona.name}</div>
              <div className="text-sm text-gray-600">@{persona.reddit_username}</div>
              <div className="text-sm text-gray-500 mt-1">{persona.bio}</div>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                  {persona.tone}
                </span>
                {persona.expertise_areas.map((area, idx) => (
                  <span key={idx} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                    {area}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleRemovePersona(index)}
              className="text-red-600 hover:text-red-700 ml-2 font-medium text-sm transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
        {personas.length === 0 && (
          <p className="text-gray-500 text-sm">No personas added yet. Add at least 2 personas.</p>
        )}
      </div>
    </div>
  );
}

