import { NextRequest, NextResponse } from 'next/server';
import { CalendarGenerator } from '@/lib/algorithms/calendar-generator';
import { CalendarGenerationInput } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input: CalendarGenerationInput = body;
    
    // Validate required fields
    if (!input.company || !input.personas || !input.subreddits || !input.chatgpt_queries) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Save to database
    const supabase = await createClient();
    
    // Save company if it doesn't have an ID
    let companyId = input.company.id;
    if (!companyId) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: input.company.name,
          description: input.company.description,
          website: input.company.website,
          industry: input.company.industry,
          target_audience: input.company.target_audience,
        })
        .select()
        .single();
      
      if (companyError || !company) {
        console.error('Error saving company:', companyError);
        return NextResponse.json(
          { error: 'Failed to save company', details: companyError?.message },
          { status: 500 }
        );
      }
      
      companyId = company.id;
    }
    
    // Save personas if they don't have IDs (need IDs for foreign keys)
    const personasWithIds = await Promise.all(
      input.personas.map(async (persona) => {
        if (persona.id) return persona;
        
        const { data: savedPersona, error: personaError } = await supabase
          .from('personas')
          .insert({
            company_id: companyId,
            name: persona.name,
            bio: persona.bio,
            expertise_areas: persona.expertise_areas,
            tone: persona.tone,
            reddit_username: persona.reddit_username,
          })
          .select()
          .single();
        
        if (personaError || !savedPersona) {
          throw new Error(`Failed to save persona ${persona.name}: ${personaError?.message}`);
        }
        
        return { ...persona, id: savedPersona.id };
      })
    );
    
    // Save subreddits if they don't have IDs (need IDs for foreign keys)
    const subredditsWithIds = await Promise.all(
      input.subreddits.map(async (subreddit) => {
        if (subreddit.id) return subreddit;
        
        const { data: savedSubreddit, error: subredditError } = await supabase
          .from('subreddits')
          .insert({
            company_id: companyId,
            name: subreddit.name,
            description: subreddit.description,
            post_frequency_limit: subreddit.post_frequency_limit || 2,
          })
          .select()
          .single();
        
        if (subredditError || !savedSubreddit) {
          throw new Error(`Failed to save subreddit ${subreddit.name}: ${subredditError?.message}`);
        }
        
        return { ...subreddit, id: savedSubreddit.id };
      })
    );
    
    // Save ChatGPT queries if they don't have IDs (need to save for "Generate Next Week")
    const queriesWithIds = await Promise.all(
      input.chatgpt_queries.map(async (query) => {
        if (query.id) return query;
        
        const { data: savedQuery, error: queryError } = await supabase
          .from('chatgpt_queries')
          .insert({
            company_id: companyId,
            query: query.query,
            intent: query.intent,
          })
          .select()
          .single();
        
        if (queryError || !savedQuery) {
          throw new Error(`Failed to save query: ${queryError?.message}`);
        }
        
        return { ...query, id: savedQuery.id };
      })
    );
    
    // Generate calendar with entities that now have database IDs
    const generator = new CalendarGenerator({
      company: { ...input.company, id: companyId },
      personas: personasWithIds,
      subreddits: subredditsWithIds,
      chatgpt_queries: queriesWithIds,
      posts_per_week: input.posts_per_week,
      week_start_date: input.week_start_date,
    });
    const result = await generator.generate();
    
    // Check if calendar already exists for this week (to allow regeneration)
    const weekStartDate = result.calendar.week_start_date;
    const { data: existingCalendar } = await supabase
      .from('content_calendars')
      .select('id')
      .eq('company_id', companyId)
      .eq('week_start_date', weekStartDate)
      .single();
    
    // If calendar exists, delete it (posts will be deleted via CASCADE)
    if (existingCalendar) {
      const { error: deleteError } = await supabase
        .from('content_calendars')
        .delete()
        .eq('id', existingCalendar.id);
      
      if (deleteError) {
        console.error('Error deleting existing calendar:', deleteError);
        return NextResponse.json(
          { error: 'Failed to regenerate calendar', details: deleteError.message },
          { status: 500 }
        );
      }
    }
    
    // Insert new calendar
    const { data: calendar, error: calendarError } = await supabase
      .from('content_calendars')
      .insert({
        company_id: companyId,
        week_start_date: result.calendar.week_start_date,
        week_end_date: result.calendar.week_end_date,
        posts_per_week: result.calendar.posts_per_week,
        quality_score: result.quality_score,
      })
      .select()
      .single();
    
    if (calendarError) {
      console.error('Error saving calendar:', calendarError);
      return NextResponse.json(
        { error: 'Failed to save calendar', details: calendarError.message },
        { status: 500 }
      );
    }
    
    // Insert posts with calendar_id (including source tracking)
    const postsWithCalendarId = result.posts.map(post => ({
      ...post,
      calendar_id: calendar.id,
    }));
    
    const { error: postsError } = await supabase
      .from('calendar_posts')
      .insert(postsWithCalendarId);
    
    if (postsError) {
      console.error('Error saving posts:', postsError);
      return NextResponse.json(
        { error: 'Failed to save posts', details: postsError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      ...result,
      calendar,
      personas: personasWithIds, // Return saved personas with IDs
      subreddits: subredditsWithIds, // Return saved subreddits with IDs
      queries: queriesWithIds, // Return saved queries with IDs
    });
  } catch (error) {
    console.error('Error generating calendar:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

