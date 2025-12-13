'use client';

import { ContentCalendar, CalendarPost, Persona, Subreddit } from '@/lib/types';
import { format, parseISO } from 'date-fns';

interface CalendarDisplayProps {
  calendar: ContentCalendar;
  posts: CalendarPost[];
  personas: Persona[];
  subreddits: Subreddit[];
}

export default function CalendarDisplay({ calendar, posts, personas, subreddits }: CalendarDisplayProps) {
  const getPersonaName = (personaId: string) => {
    return personas.find(p => (p.id || p.name) === personaId)?.name || 'Unknown';
  };

  const getPersonaUsername = (personaId: string) => {
    return personas.find(p => (p.id || p.name) === personaId)?.reddit_username || 'unknown';
  };

  const getSubredditName = (subredditId: string) => {
    return subreddits.find(s => (s.id || s.name) === subredditId)?.name || 'unknown';
  };

  // Group posts by date
  const postsByDate: Map<string, CalendarPost[]> = new Map();
  posts.forEach(post => {
    const date = post.scheduled_date;
    if (!postsByDate.has(date)) {
      postsByDate.set(date, []);
    }
    postsByDate.get(date)!.push(post);
  });

  const sortedDates = Array.from(postsByDate.keys()).sort();

  const qualityColor = (score?: number) => {
    if (!score) return 'bg-gray-200';
    if (score >= 8) return 'bg-green-200 text-green-800';
    if (score >= 6) return 'bg-yellow-200 text-yellow-800';
    return 'bg-red-200 text-red-800';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Content Calendar</h2>
            <p className="text-gray-600">
              {format(parseISO(calendar.week_start_date), 'MMM d')} - {format(parseISO(calendar.week_end_date), 'MMM d, yyyy')}
            </p>
          </div>
          {calendar.quality_score !== undefined && (
            <div className={`px-4 py-2 rounded-lg ${qualityColor(calendar.quality_score)}`}>
              <div className="text-sm font-medium">Quality Score</div>
              <div className="text-2xl font-bold">{calendar.quality_score.toFixed(1)}/10</div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Posts:</span>
            <span className="ml-2 font-semibold">{posts.filter(p => p.post_type === 'original').length}</span>
          </div>
          <div>
            <span className="text-gray-600">Total Comments:</span>
            <span className="ml-2 font-semibold">{posts.filter(p => p.post_type === 'comment').length}</span>
          </div>
          <div>
            <span className="text-gray-600">Posts/Week:</span>
            <span className="ml-2 font-semibold">{calendar.posts_per_week}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {sortedDates.map(date => {
          const dayPosts = postsByDate.get(date)!.sort((a, b) => 
            a.scheduled_time.localeCompare(b.scheduled_time)
          );
          
          return (
            <div key={date} className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {format(parseISO(date), 'EEEE, MMMM d')}
              </h3>
              
              <div className="space-y-4">
                {dayPosts.map((post, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-lg ${
                      post.post_type === 'original' 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'bg-gray-50 border border-gray-200 ml-8'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          post.post_type === 'original' 
                            ? 'bg-blue-200 text-blue-800' 
                            : 'bg-gray-200 text-gray-800'
                        }`}>
                          {post.post_type === 'original' ? 'POST' : 'COMMENT'}
                        </span>
                        <span className="text-sm font-semibold text-gray-700">
                          {getPersonaName(post.persona_id)}
                        </span>
                        <span className="text-xs text-gray-500">
                          (@{getPersonaUsername(post.persona_id)})
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {post.scheduled_time}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      r/{getSubredditName(post.subreddit_id)}
                    </div>
                    
                    {post.post_type === 'original' && (
                      <div className="font-semibold text-gray-900 mb-2">
                        {post.title}
                      </div>
                    )}
                    
                    <div className="text-gray-700 text-sm whitespace-pre-wrap">
                      {post.content}
                    </div>
                    
                    {post.post_type === 'comment' && (
                      <div className="mt-2 text-xs text-gray-500 italic">
                        Replying to: {dayPosts.find(p => p.id === post.parent_post_id)?.title || 'Original post'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

