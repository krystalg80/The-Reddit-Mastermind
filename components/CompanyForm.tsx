'use client';

import { useState, useEffect } from 'react';
import { Company } from '@/lib/types';

interface CompanyFormProps {
  company: Company | null;
  onCompanyChange: (company: Company) => void;
}

export default function CompanyForm({ company, onCompanyChange }: CompanyFormProps) {
  const [formData, setFormData] = useState<Company>({
    name: company?.name || '',
    description: company?.description || '',
    website: company?.website || '',
    industry: company?.industry || '',
    target_audience: company?.target_audience || '',
  });
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Update form data when company prop changes (e.g., after import)
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        description: company.description || '',
        website: company.website || '',
        industry: company.industry || '',
        target_audience: company.target_audience || '',
      });
      // Auto-collapse after import if company has data
      if (company.name && company.description) {
        setIsCollapsed(true);
      }
    }
  }, [company]);

  const handleChange = (field: keyof Company, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onCompanyChange(updated);
  };

  const hasData = formData.name || formData.description;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Company Information
          {hasData && (
            <span className="ml-2 text-sm font-normal text-green-600">✓ Imported</span>
          )}
        </h2>
        {hasData && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {isCollapsed ? '▼ Show' : '▲ Hide'}
          </button>
        )}
      </div>
      
      {isCollapsed && hasData ? (
        <div className="space-y-2 text-sm">
          <div><strong>Name:</strong> {formData.name}</div>
          {formData.website && <div><strong>Website:</strong> {formData.website}</div>}
          <div><strong>Description:</strong> {formData.description.substring(0, 100)}...</div>
        </div>
      ) : (
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Website
          </label>
          <input
            type="url"
            value={formData.website || ''}
            onChange={(e) => handleChange('website', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Industry
          </label>
          <input
            type="text"
            value={formData.industry || ''}
            onChange={(e) => handleChange('industry', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Audience
          </label>
          <input
            type="text"
            value={formData.target_audience || ''}
            onChange={(e) => handleChange('target_audience', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      )}
    </div>
  );
}

