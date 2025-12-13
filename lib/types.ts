export interface Company {
  id?: string;
  name: string;
  description: string;
  website?: string;
  industry?: string;
  target_audience?: string;
  created_at?: string;
}

export interface Persona {
  id?: string;
  company_id: string;
  name: string;
  bio: string;
  expertise_areas: string[];
  tone: 'professional' | 'casual' | 'friendly' | 'technical' | 'humorous';
  reddit_username: string;
  created_at?: string;
}

export interface Subreddit {
  id?: string;
  company_id: string;
  name: string;
  description?: string;
  member_count?: number;
  post_frequency_limit?: number; // posts per week
  created_at?: string;
}

export interface ChatGPTQuery {
  id?: string;
  company_id: string;
  query: string;
  intent: 'question' | 'discussion' | 'advice' | 'review';
  created_at?: string;
}

export interface CalendarPost {
  id?: string;
  calendar_id: string;
  persona_id: string;
  subreddit_id: string;
  title: string;
  content: string;
  scheduled_date: string;
  scheduled_time: string;
  post_type: 'original' | 'comment';
  parent_post_id?: string; // For comments
  status: 'pending' | 'scheduled' | 'posted';
  created_at?: string;
}

export interface ContentCalendar {
  id?: string;
  company_id: string;
  week_start_date: string;
  week_end_date: string;
  posts_per_week: number;
  generated_at: string;
  quality_score?: number;
  created_at?: string;
}

export interface CalendarGenerationInput {
  company: Company;
  personas: Persona[];
  subreddits: Subreddit[];
  chatgpt_queries: ChatGPTQuery[];
  posts_per_week: number;
  week_start_date: Date;
}

export interface CalendarGenerationResult {
  calendar: ContentCalendar;
  posts: CalendarPost[];
  quality_score: number;
  warnings: string[];
}

