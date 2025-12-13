import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must have at least a header row and one data row' },
        { status: 400 }
      );
    }

    // Parse CSV
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const rows = lines.slice(1).map(parseCSVLine);

    const supabase = await createClient();

    // Detect and import data
    const results = {
      company: null as any,
      personas: [] as any[],
      subreddits: [] as any[],
      queries: [] as any[],
    };

    // Import company
    const nameIdx = headers.findIndex(h => ['company', 'company name', 'name'].includes(h));
    const descIdx = headers.findIndex(h => ['description', 'desc', 'about'].includes(h));
    
    if (nameIdx >= 0 && descIdx >= 0 && rows.length > 0) {
      const row = rows[0];
      const websiteIdx = headers.findIndex(h => ['website', 'url'].includes(h));
      const industryIdx = headers.findIndex(h => ['industry'].includes(h));
      const audienceIdx = headers.findIndex(h => ['target audience', 'audience'].includes(h));

      const { data: company, error } = await supabase
        .from('companies')
        .insert({
          name: row[nameIdx] || '',
          description: row[descIdx] || '',
          website: websiteIdx >= 0 ? row[websiteIdx] : null,
          industry: industryIdx >= 0 ? row[industryIdx] : null,
          target_audience: audienceIdx >= 0 ? row[audienceIdx] : null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: `Failed to import company: ${error.message}` },
          { status: 500 }
        );
      }

      results.company = company;

      // Import personas
      const personaNameIdx = headers.findIndex(h => ['persona', 'persona name'].includes(h));
      const bioIdx = headers.findIndex(h => ['bio', 'biography'].includes(h));
      const usernameIdx = headers.findIndex(h => ['reddit username', 'username'].includes(h));
      const toneIdx = headers.findIndex(h => ['tone'].includes(h));
      const expertiseIdx = headers.findIndex(h => ['expertise', 'expertise areas'].includes(h));

      if (personaNameIdx >= 0 && bioIdx >= 0 && usernameIdx >= 0) {
        const personaRows = rows.filter(row => row[personaNameIdx] && row[bioIdx] && row[usernameIdx]);
        
        if (personaRows.length > 0) {
          const personasToInsert = personaRows.map(row => {
            const expertiseStr = expertiseIdx >= 0 ? row[expertiseIdx] : '';
            const expertiseAreas = expertiseStr
              ? expertiseStr.split(/[,;]/).map(e => e.trim()).filter(Boolean)
              : [];

            const tone = toneIdx >= 0 ? (row[toneIdx]?.toLowerCase() || 'casual') : 'casual';
            const validTones = ['professional', 'casual', 'friendly', 'technical', 'humorous'];
            const validTone = validTones.includes(tone) ? tone : 'casual';

            return {
              company_id: company.id,
              name: row[personaNameIdx],
              bio: row[bioIdx],
              reddit_username: row[usernameIdx],
              tone: validTone,
              expertise_areas: expertiseAreas,
            };
          });

          const { data: personas, error: personaError } = await supabase
            .from('personas')
            .insert(personasToInsert)
            .select();

          if (personaError) {
            return NextResponse.json(
              { error: `Failed to import personas: ${personaError.message}` },
              { status: 500 }
            );
          }

          results.personas = personas || [];
        }
      }

      // Import subreddits
      const subredditNameIdx = headers.findIndex(h => ['subreddit', 'subreddit name'].includes(h));
      if (subredditNameIdx >= 0) {
        const subredditRows = rows.filter(row => row[subredditNameIdx]);
        
        if (subredditRows.length > 0) {
          const subredditsToInsert = subredditRows.map(row => {
            let name = row[subredditNameIdx];
            if (name.startsWith('r/')) {
              name = name.substring(2);
            }

            const descIdx = headers.findIndex(h => ['description'].includes(h));
            const limitIdx = headers.findIndex(h => ['post frequency limit', 'limit'].includes(h));

            return {
              company_id: company.id,
              name: name.trim(),
              description: descIdx >= 0 ? row[descIdx] : null,
              post_frequency_limit: limitIdx >= 0 ? parseInt(row[limitIdx]) || 2 : 2,
            };
          });

          const { data: subreddits, error: subredditError } = await supabase
            .from('subreddits')
            .insert(subredditsToInsert)
            .select();

          if (subredditError) {
            return NextResponse.json(
              { error: `Failed to import subreddits: ${subredditError.message}` },
              { status: 500 }
            );
          }

          results.subreddits = subreddits || [];
        }
      }

      // Import queries
      const queryIdx = headers.findIndex(h => ['query', 'chatgpt query'].includes(h));
      if (queryIdx >= 0) {
        const queryRows = rows.filter(row => row[queryIdx]);
        
        if (queryRows.length > 0) {
          const queriesToInsert = queryRows.map(row => {
            const intentIdx = headers.findIndex(h => ['intent'].includes(h));
            const intent = intentIdx >= 0 ? (row[intentIdx]?.toLowerCase() || 'question') : 'question';
            const validIntents = ['question', 'discussion', 'advice', 'review'];
            const validIntent = validIntents.includes(intent) ? intent : 'question';

            return {
              company_id: company.id,
              query: row[queryIdx],
              intent: validIntent,
            };
          });

          const { data: queries, error: queryError } = await supabase
            .from('chatgpt_queries')
            .insert(queriesToInsert)
            .select();

          if (queryError) {
            return NextResponse.json(
              { error: `Failed to import queries: ${queryError.message}` },
              { status: 500 }
            );
          }

          results.queries = queries || [];
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

