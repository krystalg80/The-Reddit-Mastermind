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
    if (!score) return 'bg-gray-100 text-gray-700';
    if (score >= 8) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 6) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-soft border border-gray-100">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-1">Content Calendar</h2>
            <p className="text-gray-600 font-medium">
              {format(parseISO(calendar.week_start_date), 'MMM d')} - {format(parseISO(calendar.week_end_date), 'MMM d, yyyy')}
            </p>
          </div>
          {calendar.quality_score !== undefined && (
            <div className={`px-5 py-3 rounded-xl border-2 ${qualityColor(calendar.quality_score)} shadow-soft`}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1">Quality Score</div>
              <div className="text-3xl font-bold">{calendar.quality_score.toFixed(1)}/10</div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Posts</div>
            <div className="text-2xl font-bold text-gray-900">{posts.filter(p => p.post_type === 'original').length}</div>
          </div>
          <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Comments</div>
            <div className="text-2xl font-bold text-gray-900">{posts.filter(p => p.post_type === 'comment').length}</div>
          </div>
          <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Posts/Week</div>
            <div className="text-2xl font-bold text-gray-900">{calendar.posts_per_week}</div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {sortedDates.map(date => {
          const dayPosts = postsByDate.get(date)!.sort((a, b) => 
            a.scheduled_time.localeCompare(b.scheduled_time)
          );
          
          return (
            <div key={date} className="border-l-4 border-primary-500 pl-6 mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {format(parseISO(date), 'EEEE, MMMM d')}
              </h3>
              
              <div className="space-y-4">
                {dayPosts.map((post, idx) => (
                  <div 
                    key={idx} 
                    className={`p-5 rounded-xl shadow-soft transition-all hover:shadow-medium ${
                      post.post_type === 'original' 
                        ? 'bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200' 
                        : 'bg-gray-50 border border-gray-200 ml-8'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${
                          post.post_type === 'original' 
                            ? 'bg-primary-100 text-primary-700' 
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {post.post_type === 'original' ? 'POST' : 'COMMENT'}
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {getPersonaName(post.persona_id)}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          (@{getPersonaUsername(post.persona_id)})
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-gray-600 bg-white px-2 py-1 rounded">
                        {post.scheduled_time}
                      </div>
                    </div>
                    
                    <div className="text-sm font-semibold text-primary-700 mb-3 inline-block bg-white px-3 py-1 rounded-lg">
                      r/{getSubredditName(post.subreddit_id)}
                    </div>
                    
                    {post.post_type === 'original' && (
                      <div className="font-bold text-gray-900 mb-3 text-lg">
                        {post.title}
                      </div>
                    )}
                    
                    <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </div>
                    
                    {post.post_type === 'comment' && (
                      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 italic">
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

