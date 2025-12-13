import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get calendar
    const { data: calendar, error: calendarError } = await supabase
      .from('content_calendars')
      .select('*')
      .eq('id', params.id)
      .single();
    
    if (calendarError || !calendar) {
      return NextResponse.json(
        { error: 'Calendar not found' },
        { status: 404 }
      );
    }
    
    // Get posts
    const { data: posts, error: postsError } = await supabase
      .from('calendar_posts')
      .select('*')
      .eq('calendar_id', params.id)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });
    
    if (postsError) {
      return NextResponse.json(
        { error: 'Failed to fetch posts' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      calendar,
      posts: posts || [],
    });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar' },
      { status: 500 }
    );
  }
}

