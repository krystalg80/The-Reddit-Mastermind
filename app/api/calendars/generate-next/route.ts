import { NextRequest, NextResponse } from 'next/server';
import { CalendarGenerator } from '@/lib/algorithms/calendar-generator';
import { CalendarGenerationInput } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';
import { addWeeks, startOfWeek } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, weeks_ahead = 1 } = body;
    
    if (!company_id) {
      return NextResponse.json(
        { error: 'company_id is required' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // Get company data
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();
    
    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }
    
    // Get personas
    const { data: personas, error: personasError } = await supabase
      .from('personas')
      .select('*')
      .eq('company_id', company_id);
    
    if (personasError || !personas || personas.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 personas required' },
        { status: 400 }
      );
    }
    
    // Get subreddits
    const { data: subreddits, error: subredditsError } = await supabase
      .from('subreddits')
      .select('*')
      .eq('company_id', company_id);
    
    if (subredditsError || !subreddits || subreddits.length === 0) {
      return NextResponse.json(
        { error: 'At least 1 subreddit required' },
        { status: 400 }
      );
    }
    
    // Get ChatGPT queries
    const { data: chatgpt_queries, error: queriesError } = await supabase
      .from('chatgpt_queries')
      .select('*')
      .eq('company_id', company_id);
    
    if (queriesError || !chatgpt_queries || chatgpt_queries.length === 0) {
      return NextResponse.json(
        { error: 'At least 1 ChatGPT query required' },
        { status: 400 }
      );
    }
    
    // Get latest calendar to determine posts_per_week
    const { data: latestCalendar } = await supabase
      .from('content_calendars')
      .select('posts_per_week')
      .eq('company_id', company_id)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .single();
    
    const postsPerWeek = latestCalendar?.posts_per_week || 5;
    
    // Calculate next week start date
    const nextWeekStart = startOfWeek(addWeeks(new Date(), weeks_ahead), { weekStartsOn: 1 });
    
    // Prepare input
    const input: CalendarGenerationInput = {
      company,
      personas,
      subreddits,
      chatgpt_queries,
      posts_per_week: postsPerWeek,
      week_start_date: nextWeekStart,
    };
    
    // Generate calendar
    const generator = new CalendarGenerator(input);
    const result = await generator.generate();
    
    // Save to database
    const { data: calendar, error: calendarError } = await supabase
      .from('content_calendars')
      .insert({
        company_id: company.id,
        week_start_date: result.calendar.week_start_date,
        week_end_date: result.calendar.week_end_date,
        posts_per_week: result.calendar.posts_per_week,
        quality_score: result.quality_score,
      })
      .select()
      .single();
    
    if (calendarError) {
      return NextResponse.json(
        { error: 'Failed to save calendar', details: calendarError.message },
        { status: 500 }
      );
    }
    
    // Insert posts
    const postsWithCalendarId = result.posts.map(post => ({
      ...post,
      calendar_id: calendar.id,
    }));
    
    const { error: postsError } = await supabase
      .from('calendar_posts')
      .insert(postsWithCalendarId);
    
    if (postsError) {
      return NextResponse.json(
        { error: 'Failed to save posts', details: postsError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      ...result,
      calendar,
      personas, // Return personas with IDs
      subreddits, // Return subreddits with IDs
      queries: chatgpt_queries, // Return queries with IDs
    });
  } catch (error) {
    console.error('Error generating next week calendar:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

