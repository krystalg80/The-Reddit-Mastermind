'use client';

import { useState } from 'react';
import { Company, Persona, Subreddit, ChatGPTQuery, ContentCalendar, CalendarPost } from '@/lib/types';
import CompanyForm from '@/components/CompanyForm';
import PersonaManager from '@/components/PersonaManager';
import SubredditManager from '@/components/SubredditManager';
import QueryManager from '@/components/QueryManager';
import CalendarDisplay from '@/components/CalendarDisplay';
import DataImporter from '@/components/DataImporter';
import { format, startOfWeek, addWeeks } from 'date-fns';

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
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Reddit Mastermind
        </h1>
        <p className="text-gray-600 mb-8">
          Automate your Reddit content calendar with AI-powered planning
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-6">
            <p className="font-semibold mb-2">Warnings:</p>
            <ul className="list-disc list-inside">
              {warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Input Forms */}
          <div className="space-y-6">
            <DataImporter 
              onDataImported={(data) => {
                console.log('Received imported data:', data);
                // Always set company if it exists and has data
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

            <div className="bg-white p-6 rounded-lg shadow">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Posts per Week
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={postsPerWeek}
                onChange={(e) => setPostsPerWeek(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleGenerateCalendar}
                disabled={isGenerating}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {isGenerating ? 'Generating...' : 'Generate This Week\'s Calendar'}
              </button>
              
              {currentCalendar && (
                <button
                  onClick={handleGenerateNextWeek}
                  disabled={isGenerating}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                >
                  {isGenerating ? 'Generating...' : 'Generate Next Week'}
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
              <div className="bg-white p-12 rounded-lg shadow text-center text-gray-500">
                <p>No calendar generated yet.</p>
                <p className="mt-2 text-sm">Fill in the form and click "Generate This Week's Calendar" to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

