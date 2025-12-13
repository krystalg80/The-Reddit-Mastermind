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

  // Update form data when company prop changes (e.g., after import or clear)
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
    } else {
      // Clear form when company is null
      setFormData({
        name: '',
        description: '',
        website: '',
        industry: '',
        target_audience: '',
      });
      setIsCollapsed(false);
    }
  }, [company]);

  const handleChange = (field: keyof Company, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onCompanyChange(updated);
  };

  const hasData = formData.name || formData.description;

  return (
    <div className="bg-white p-6 rounded-xl shadow-soft border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Company Information
          {hasData && (
            <span className="ml-2 text-sm font-normal text-emerald-600 flex items-center inline-flex">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Imported
            </span>
          )}
        </h2>
        {hasData && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            {isCollapsed ? '▼ Show' : '▲ Hide'}
          </button>
        )}
      </div>
      
      {isCollapsed && hasData ? (
        <div className="space-y-2 text-sm text-gray-600">
          <div><strong className="text-gray-900">Name:</strong> {formData.name}</div>
          {formData.website && <div><strong className="text-gray-900">Website:</strong> {formData.website}</div>}
          <div><strong className="text-gray-900">Description:</strong> {formData.description.substring(0, 100)}...</div>
        </div>
      ) : (
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Website
          </label>
          <input
            type="url"
            value={formData.website || ''}
            onChange={(e) => handleChange('website', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Industry
          </label>
          <input
            type="text"
            value={formData.industry || ''}
            onChange={(e) => handleChange('industry', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Target Audience
          </label>
          <input
            type="text"
            value={formData.target_audience || ''}
            onChange={(e) => handleChange('target_audience', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      </div>
      )}
    </div>
  );
}

