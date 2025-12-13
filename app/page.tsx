'use client';

import { useState, useEffect } from 'react';
import { Company, Persona, Subreddit, ChatGPTQuery, ContentCalendar, CalendarPost } from '@/lib/types';
import CompanyForm from '@/components/CompanyForm';
import PersonaManager from '@/components/PersonaManager';
import SubredditManager from '@/components/SubredditManager';
import QueryManager from '@/components/QueryManager';
import CalendarDisplay from '@/components/CalendarDisplay';
import DataImporter from '@/components/DataImporter';
import { format, startOfWeek, addWeeks } from 'date-fns';

const STORAGE_KEY = 'reddit-mastermind-data';

interface StoredData {
  company: Company | null;
  personas: Persona[];
  subreddits: Subreddit[];
  chatgptQueries: ChatGPTQuery[];
  postsPerWeek: number;
}

export default function Home() {
  const [company, setCompany] = useState<Company | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [subreddits, setSubreddits] = useState<Subreddit[]>([]);
  const [chatgptQueries, setChatgptQueries] = useState<ChatGPTQuery[]>([]);
  const [postsPerWeek, setPostsPerWeek] = useState<number>(5);
  const [currentCalendar, setCurrentCalendar] = useState<ContentCalendar | null>(null);
  const [currentPosts, setCurrentPosts] = useState<CalendarPost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: StoredData = JSON.parse(stored);
        if (data.company) setCompany(data.company);
        if (data.personas?.length > 0) setPersonas(data.personas);
        if (data.subreddits?.length > 0) setSubreddits(data.subreddits);
        if (data.chatgptQueries?.length > 0) setChatgptQueries(data.chatgptQueries);
        if (data.postsPerWeek) setPostsPerWeek(data.postsPerWeek);
      }
    } catch (error) {
      console.warn('Failed to load data from localStorage:', error);
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    try {
      const data: StoredData = {
        company,
        personas,
        subreddits,
        chatgptQueries,
        postsPerWeek,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save data to localStorage:', error);
    }
  }, [company, personas, subreddits, chatgptQueries, postsPerWeek]);

  // Clear all data (for CSV import or manual reset)
  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all data? This will reset the form.')) {
      setCompany(null);
      setPersonas([]);
      setSubreddits([]);
      setChatgptQueries([]);
      setPostsPerWeek(5);
      setCurrentCalendar(null);
      setCurrentPosts([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleGenerateCalendar = async () => {
    if (!company || personas.length < 2 || subreddits.length === 0 || chatgptQueries.length === 0) {
      setError('Please fill in all required fields: Company, at least 2 personas, at least 1 subreddit, and at least 1 ChatGPT query.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setWarnings([]);

    try {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      
      const response = await fetch('/api/calendars/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company,
          personas,
          subreddits,
          chatgpt_queries: chatgptQueries,
          posts_per_week: postsPerWeek,
          week_start_date: weekStart.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate calendar');
      }

      const data = await response.json();
      setCurrentCalendar(data.calendar);
      setCurrentPosts(data.posts);
      setWarnings(data.warnings || []);
      
      // Update company with ID if it was just created
      if (data.calendar?.company_id && !company.id) {
        setCompany({ ...company, id: data.calendar.company_id });
      }
      
      // Update personas, subreddits, and queries with database IDs if returned
      if (data.personas && data.personas.length > 0) {
        setPersonas(data.personas);
      }
      if (data.subreddits && data.subreddits.length > 0) {
        setSubreddits(data.subreddits);
      }
      if (data.queries && data.queries.length > 0) {
        setChatgptQueries(data.queries);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateNextWeek = async () => {
    if (!company?.id) {
      setError('Please generate a calendar first or ensure company is saved.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setWarnings([]);

    try {
      const response = await fetch('/api/calendars/generate-next', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id: company.id,
          weeks_ahead: 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate next week calendar');
      }

      const data = await response.json();
      setCurrentCalendar(data.calendar);
      setCurrentPosts(data.posts);
      setWarnings(data.warnings || []);
      
      // Update personas, subreddits, and queries with database IDs if returned
      if (data.personas && data.personas.length > 0) {
        setPersonas(data.personas);
      }
      if (data.subreddits && data.subreddits.length > 0) {
        setSubreddits(data.subreddits);
      }
      if (data.queries && data.queries.length > 0) {
        setChatgptQueries(data.queries);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-soft">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
            Reddit Mastermind (Created by Krystal Galdamez)
          </h1>
          <p className="text-gray-600 text-lg">
            Automate your Reddit content calendar with AI-powered planning ||
            Tech Stack: Next.js, Tailwind CSS, Supabase, React, TypeScript, Vercel, OpenAI
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Personal note for Maddie */}
        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 px-6 py-4 rounded-lg mb-6 shadow-soft">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold mb-1">Hi Maddie!</p>
              <p className="text-sm">
                Just wanted to give you a heads up, I&apos;m using the free tier of the ChatGPT API, so I do have a quota limit. 
                If by the time you&apos;re actively testing the application you see <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">📝 Template</span> badges instead of 
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 ml-1">🤖 AI</span> badges, 
                that&apos;s because there&apos;s no quota available due to the limit. The app will still work perfectly with the template fallbacks. Thank you again :)
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 px-6 py-4 rounded-lg mb-6 shadow-soft">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-800 px-6 py-4 rounded-lg mb-6 shadow-soft">
            <p className="font-semibold mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Warnings
            </p>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((warning, idx) => (
                <li key={idx} className="text-sm">{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Input Forms */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-soft border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Data Import</h2>
                <button
                  onClick={handleClearData}
                  className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                  title="Clear all data to start fresh or import new CSV"
                >
                  Clear Data
                </button>
              </div>
              <DataImporter 
                onDataImported={(data) => {
                  console.log('Received imported data:', data);
                  // CSV import overwrites existing data
                  if (data.company) {
                    console.log('Setting company:', data.company);
                    setCompany(data.company);
                  }
                  if (data.personas.length > 0) {
                    console.log('Setting personas:', data.personas.length);
                    setPersonas(data.personas);
                  }
                  if (data.subreddits.length > 0) {
                    console.log('Setting subreddits:', data.subreddits.length);
                    setSubreddits(data.subreddits);
                  }
                  if (data.queries.length > 0) {
                    console.log('Setting queries:', data.queries.length);
                    setChatgptQueries(data.queries);
                  }
                  if (data.postsPerWeek) {
                    console.log('Setting posts per week:', data.postsPerWeek);
                    setPostsPerWeek(data.postsPerWeek);
                  }
                }}
              />
            </div>
            <CompanyForm company={company} onCompanyChange={setCompany} />
            
            <PersonaManager 
              companyId={company?.id} 
              personas={personas} 
              onPersonasChange={setPersonas} 
            />
            
            <SubredditManager 
              companyId={company?.id} 
              subreddits={subreddits} 
              onSubredditsChange={setSubreddits} 
            />
            
            <QueryManager 
              companyId={company?.id} 
              queries={chatgptQueries} 
              onQueriesChange={setChatgptQueries} 
            />

            <div className="bg-white p-6 rounded-xl shadow-soft border border-gray-100">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Posts per Week
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={postsPerWeek}
                onChange={(e) => setPostsPerWeek(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleGenerateCalendar}
                disabled={isGenerating}
                className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3.5 rounded-lg font-semibold hover:from-primary-700 hover:to-primary-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-medium hover:shadow-large transform hover:-translate-y-0.5 disabled:transform-none"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  "Generate This Week's Calendar"
                )}
              </button>
              
              {currentCalendar && (
                <button
                  onClick={handleGenerateNextWeek}
                  disabled={isGenerating}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-3.5 rounded-lg font-semibold hover:from-emerald-700 hover:to-emerald-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-medium hover:shadow-large transform hover:-translate-y-0.5 disabled:transform-none"
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </span>
                  ) : (
                    'Generate Next Week'
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Right Column - Calendar Display */}
          <div>
            {currentCalendar && currentPosts.length > 0 ? (
              <CalendarDisplay 
                calendar={currentCalendar} 
                posts={currentPosts}
                personas={personas}
                subreddits={subreddits}
              />
            ) : (
              <div className="bg-white p-12 rounded-xl shadow-soft border border-gray-100 text-center">
                <div className="max-w-md mx-auto">
                  <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600 font-medium mb-2">No calendar generated yet.</p>
                  <p className="text-sm text-gray-500">Fill in the form and click &quot;Generate This Week&apos;s Calendar&quot; to get started.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

