-- Supabase Database Schema for Reddit Mastermind

-- Table for companies
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  target_audience TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- The Personas table
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bio TEXT NOT NULL,
  expertise_areas TEXT[] DEFAULT ARRAY[]::TEXT[],
  tone TEXT NOT NULL CHECK (tone IN ('professional', 'casual', 'friendly', 'technical', 'humorous')),
  reddit_username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- The Subreddits table
CREATE TABLE IF NOT EXISTS subreddits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  member_count INTEGER,
  post_frequency_limit INTEGER DEFAULT 2, -- posts per week limit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- The ChatGPT queries table (REQUIRED: Add OPENAI_API_KEY to your .env.local file for AI-generated content)
CREATE TABLE IF NOT EXISTS chatgpt_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('question', 'discussion', 'advice', 'review')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content calendars table
CREATE TABLE IF NOT EXISTS content_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  posts_per_week INTEGER NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  quality_score NUMERIC(3, 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, week_start_date)
);

-- Calendar posts table
CREATE TABLE IF NOT EXISTS calendar_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES content_calendars(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  subreddit_id UUID NOT NULL REFERENCES subreddits(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('original', 'comment')),
  parent_post_id UUID REFERENCES calendar_posts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'posted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_personas_company_id ON personas(company_id);
CREATE INDEX IF NOT EXISTS idx_subreddits_company_id ON subreddits(company_id);
CREATE INDEX IF NOT EXISTS idx_chatgpt_queries_company_id ON chatgpt_queries(company_id);
CREATE INDEX IF NOT EXISTS idx_content_calendars_company_id ON content_calendars(company_id);
CREATE INDEX IF NOT EXISTS idx_content_calendars_week_start ON content_calendars(week_start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_posts_calendar_id ON calendar_posts(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_posts_scheduled_date ON calendar_posts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_calendar_posts_persona_id ON calendar_posts(persona_id);
CREATE INDEX IF NOT EXISTS idx_calendar_posts_subreddit_id ON calendar_posts(subreddit_id);

