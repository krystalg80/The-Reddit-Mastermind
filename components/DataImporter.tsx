'use client';

import { useState } from 'react';
import { Company, Persona, Subreddit, ChatGPTQuery } from '@/lib/types';

interface DataImporterProps {
  onDataImported: (data: {
    company: Company;
    personas: Persona[];
    subreddits: Subreddit[];
    queries: ChatGPTQuery[];
    postsPerWeek?: number;
  }) => void;
}

export default function DataImporter({ onDataImported }: DataImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      // Parse CSV (handles quoted fields and multi-line values)
      const parseCSVLine = (line: string, isFirstLine: boolean = false): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            // Handle escaped quotes ("")
            if (i + 1 < line.length && line[i + 1] === '"') {
              current += '"';
              i++; // Skip next quote
            } else {
              inQuotes = !inQuotes;
            }
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

      const headers = parseCSVLine(lines[0], true).map(h => h.toLowerCase().trim());
      
      // Handle multi-line quoted values by merging lines that are part of quoted fields
      const mergedLines: string[] = [];
      let currentLine = '';
      let inQuotes = false;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        currentLine += (currentLine ? '\n' : '') + line;
        
        // Count quotes to see if we're still in a quoted field
        const quoteCount = (line.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          inQuotes = !inQuotes;
        }
        
        // If we're not in quotes (or line ends), we have a complete row
        if (!inQuotes || i === lines.length - 1) {
          mergedLines.push(currentLine);
          currentLine = '';
          inQuotes = false;
        }
      }
      
      const rows = mergedLines.map(line => parseCSVLine(line)).filter(row => row.some(cell => cell.trim())); // Filter empty rows
      
      // Debug: Log what we found
      console.log('CSV Headers:', headers);
      console.log('Number of rows:', rows.length);
      if (rows.length > 0) {
        console.log('First row sample:', rows[0].slice(0, 5));
      }

      // Check if file has a "Type" column to indicate row type (for combined files)
      const typeIdx = headers.findIndex(h => ['type', 'data type', 'category'].includes(h));
      const hasTypeColumn = typeIdx >= 0;

      // Detect sheet type based on headers (matching your exact column names)
      // Support combined files with multiple data types
      // More flexible detection - check for any combination of expected fields
      const hasNameField = headers.some(h => ['name', 'company', 'company name'].includes(h));
      const hasDescField = headers.some(h => ['description', 'desc', 'about'].includes(h));
      const hasWebsiteField = headers.some(h => ['website', 'url', 'site'].includes(h));
      const hasSubredditsField = headers.some(h => ['subreddits', 'subreddit'].includes(h));
      const hasPostsPerWeekField = headers.some(h => 
        ['number of posts per week', 'posts per week', 'posts_per_week', 'posts/week'].includes(h)
      );
      
      const hasCompanyFields = hasNameField && (hasDescField || hasWebsiteField || hasSubredditsField);
      
      const hasUsernameField = headers.some(h => 
        ['username', 'reddit username', 'reddit', 'u/', 'author_username'].includes(h)
      );
      const hasInfoField = headers.some(h => 
        ['info', 'bio', 'biography', 'description', 'about'].includes(h)
      );
      const hasPersonaFields = hasUsernameField && hasInfoField;
      
      const hasSubredditFields = headers.some(h => 
        ['subreddit', 'subreddit name', 'r/', 'subreddits'].includes(h) && 
        !hasCompanyFields // Don't confuse with company sheet that has subreddits column
      );
      
      const hasKeywordField = headers.some(h => 
        ['keyword', 'query', 'chatgpt query', 'topic', 'question'].includes(h)
      );
      const hasQueryFields = hasKeywordField;
      
      // Check if this is a calendar output file (not input)
      const isCalendarFile = headers.some(h => 
        ['post_id', 'comment_id', 'scheduled_date', 'scheduled_time', 'calendar'].includes(h)
      );
      
      // Check if this is posts/comments file (reference data, not needed)
      const isPostsCommentsFile = headers.some(h => 
        ['post_id', 'comment_id'].includes(h) && 
        (headers.some(h2 => ['subreddit', 'title', 'body', 'author_username'].includes(h2)) ||
         headers.some(h2 => ['comment_text', 'parent_comment_id'].includes(h2)))
      );

      let company: Company | null = null;
      const personas: Persona[] = [];
      const subreddits: Subreddit[] = [];
      const queries: ChatGPTQuery[] = [];
      let postsPerWeek: number | undefined = undefined;

      // Check if CSV might be transposed (vertical format: field names in first column, values in second)
      // Also check if it's a combined file with sections separated by empty rows
      const mightBeTransposed = headers.length === 2 && 
                                 (headers.some(h => ['name', 'field', 'key', 'label'].includes(h)) ||
                                  (headers[0] && rows.some(row => row[0] && ['name', 'website', 'description'].includes(row[0].toLowerCase())))) &&
                                 rows.length > 0;
      
      if (mightBeTransposed) {
        // Try to parse as transposed format
        // Handle combined file: company section, then personas, then queries
        const fieldIdx = headers.findIndex(h => ['name', 'field', 'key', 'label'].includes(h));
        const valueIdx = fieldIdx === 0 ? 1 : 0;
        
        // Find section breaks (empty rows or header rows)
        let companyEndIdx = rows.length;
        let personasStartIdx = -1;
        let personasEndIdx = rows.length;
        let queriesStartIdx = -1;
        
        // Look for section markers
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const firstCell = row[0]?.toLowerCase().trim() || '';
          
          // Check for personas section start
          if (firstCell === 'username' && row[1]?.toLowerCase().trim() === 'info') {
            companyEndIdx = i;
            personasStartIdx = i + 1;
          }
          
          // Check for queries section start
          if (firstCell === 'keyword_id' && row[1]?.toLowerCase().trim() === 'keyword') {
            if (personasStartIdx >= 0) {
              personasEndIdx = i;
            } else {
              companyEndIdx = i;
            }
            queriesStartIdx = i + 1;
          }
        }
        
        // Parse company section
        const transposedData: Record<string, string> = {};
        let i = 0;
        
        // Check if first row might be a header row (both cells look like field names)
        // If so, skip it and start from row 1
        if (rows.length > 0) {
          const firstRow = rows[0];
          const firstCell = firstRow[fieldIdx]?.toLowerCase().trim();
          const secondCell = firstRow[valueIdx]?.toLowerCase().trim();
          
          // If first row looks like headers (both are common field names), skip it
          const commonFieldNames = ['name', 'website', 'description', 'subreddits', 'company', 'company name'];
          if (commonFieldNames.includes(firstCell) && commonFieldNames.includes(secondCell)) {
            i = 1; // Start from second row
          }
        }
        
        while (i < companyEndIdx) {
          const row = rows[i];
          const fieldName = row[fieldIdx]?.toLowerCase().trim();
          const value = row[valueIdx];
          
          // Skip empty rows
          if (!fieldName || !value) {
            i++;
            continue;
          }
          
          // Found a field name - collect its value
          let fieldValue = value;
          
          // Collect continuation lines (rows without field names)
          i++;
          while (i < companyEndIdx) {
            const nextRow = rows[i];
            const nextFieldName = nextRow[fieldIdx]?.toLowerCase().trim();
            
            // If next row has a field name, we've reached the next field
            if (nextFieldName && nextFieldName.length > 0 && 
                !nextFieldName.match(/^(r\/|http)/)) { // Don't treat URLs or r/ as field names
              break;
            }
            
            // If next row has a value, it's a continuation
            if (nextRow[valueIdx] && nextRow[valueIdx].trim()) {
              fieldValue += '\n' + nextRow[valueIdx];
            }
            
            i++;
          }
          
          transposedData[fieldName] = fieldValue.trim();
        }
        
        // Special case: if "name" field is missing but first row had "Name,Slideforge"
        // The value "Slideforge" might be in the first row's second column
        if (!transposedData['name'] && rows.length > 0) {
          const firstRow = rows[0];
          const firstCell = firstRow[fieldIdx]?.toLowerCase().trim();
          const secondCell = firstRow[valueIdx]?.trim();
          
          // If first cell is "name" and second cell looks like a company name
          if (firstCell === 'name' && secondCell && secondCell.length > 0 && 
              !secondCell.toLowerCase().includes('company') && 
              !secondCell.toLowerCase().includes('info')) {
            transposedData['name'] = secondCell;
          }
        }
        
        // Debug: log transposed data keys
        console.log('Transposed data keys:', Object.keys(transposedData));
        console.log('Transposed data:', transposedData);
        
        // Try to extract company data from transposed format
        // First, check if name is in headers (Name,Slideforge format where Slideforge is treated as header)
        let companyName = '';
        
        // Check if second header looks like a company name (not a field name)
        // This handles the case where CSV has "Name,Slideforge" and Slideforge becomes a header
        if (headers.length === 2 && headers[0]?.toLowerCase().trim() === 'name') {
          const secondHeader = headers[1]?.trim();
          const secondHeaderLower = secondHeader?.toLowerCase();
          const commonFieldNames = ['website', 'description', 'subreddits', 'company', 'company name', 'info', 'keyword', 'keyword_id'];
          
          // If second header doesn't look like a field name, it's probably the company name
          if (secondHeader && 
              !commonFieldNames.includes(secondHeaderLower) &&
              !secondHeaderLower.includes('http') &&
              !secondHeaderLower.includes('.') && // URLs have dots
              secondHeader.length > 0 &&
              secondHeader.length < 50) { // Company names are usually short
            companyName = secondHeader; // Use the original case from headers
            console.log('Found company name in second header:', companyName);
          }
        }
        
        // Also check first data row if name column exists
        if (!companyName && rows.length > 0) {
          const firstRow = rows[0];
          const firstCell = firstRow[fieldIdx]?.toLowerCase().trim();
          const secondCell = firstRow[valueIdx]?.trim();
          
          // If first cell is "name" and second cell looks like a company name
          if (firstCell === 'name' && secondCell && 
              secondCell.length > 0 && 
              !secondCell.toLowerCase().includes('company') && 
              !secondCell.toLowerCase().includes('info')) {
            companyName = secondCell;
            console.log('Found company name in first data row:', companyName);
          }
        }
        
        // Find name field (case-insensitive) in transposedData
        const nameKey = Object.keys(transposedData).find(k => 
          k.toLowerCase() === 'name' || k.toLowerCase() === 'company name' || k.toLowerCase() === 'company'
        );
        const descKey = Object.keys(transposedData).find(k => 
          k.toLowerCase() === 'description' || k.toLowerCase() === 'desc' || k.toLowerCase() === 'about'
        );
        const websiteKey = Object.keys(transposedData).find(k => 
          k.toLowerCase() === 'website' || k.toLowerCase() === 'url' || k.toLowerCase() === 'site'
        );
        
        // Use name from first row if found, otherwise use transposedData
        const finalName = companyName || (nameKey ? transposedData[nameKey] : '');
        
        if (finalName || descKey) {
          company = {
            name: finalName || '',
            description: descKey ? (transposedData[descKey] || '') : '',
            website: websiteKey ? transposedData[websiteKey] : undefined,
          };
          console.log('Created company object:', company);
          console.log('Company name:', company.name);
          console.log('Company description length:', company.description?.length);
          
          // Parse subreddits (handle both comma-separated and line-separated)
          // Check all possible key variations (case-insensitive)
          const subredditKey = Object.keys(transposedData).find(k => 
            k.toLowerCase().includes('subreddit')
          );
          
          console.log('Looking for subreddit key. Available keys:', Object.keys(transposedData));
          console.log('Found subreddit key:', subredditKey);
          
          if (subredditKey) {
            const subredditStr = transposedData[subredditKey];
            console.log('Found subreddits field:', subredditKey, 'Value length:', subredditStr?.length, 'First 100 chars:', subredditStr?.substring(0, 100));
            
            if (subredditStr) {
              // Split by comma/semicolon OR by newlines, then filter out empty lines
              const subredditNames = subredditStr
                .split(/[,;\n\r]+/)  // Split by comma, semicolon, or newline
                .map(s => s.trim())
                .filter(s => {
                  // Filter out empty strings, "subreddits" header, and just whitespace
                  return s && 
                         s.toLowerCase() !== 'subreddits' && 
                         s.toLowerCase() !== 'subreddit' &&
                         s.length > 0 &&
                         s !== 'r/'; // Filter out just "r/"
                });
              
              console.log('Parsed subreddit names:', subredditNames.length, subredditNames.slice(0, 10));
              
              subredditNames.forEach(name => {
                const cleanName = name.startsWith('r/') ? name.substring(2) : name;
                if (cleanName && cleanName.length > 0) {
                  subreddits.push({
                    company_id: '',
                    name: cleanName,
                    post_frequency_limit: 2,
                  });
                }
              });
              
              console.log('Final subreddits array length:', subreddits.length);
            }
          } else {
            console.log('No subreddit key found in transposedData');
          }
          
          // Parse posts per week - check all possible key variations
          const postsPerWeekKey = Object.keys(transposedData).find(k => 
            k.toLowerCase().includes('posts per week') || 
            k.toLowerCase().includes('posts_per_week') ||
            k.toLowerCase().includes('number of posts')
          );
          
          console.log('Looking for posts per week key. Found:', postsPerWeekKey);
          
          if (postsPerWeekKey) {
            const value = transposedData[postsPerWeekKey];
            console.log('Found posts per week field:', postsPerWeekKey, 'Value:', value, 'Type:', typeof value);
            const parsed = parseInt(value);
            console.log('Parsed value:', parsed, 'Is valid:', !isNaN(parsed) && parsed > 0);
            if (!isNaN(parsed) && parsed > 0) {
              postsPerWeek = parsed;
              console.log('Set postsPerWeek to:', postsPerWeek);
            }
          } else {
            console.log('No posts per week key found. Available keys:', Object.keys(transposedData));
          }
        }
        
        // Parse personas section
        if (personasStartIdx >= 0 && personasEndIdx > personasStartIdx) {
          const usernameIdx = 0;
          const infoIdx = 1;
          
          let i = personasStartIdx;
          while (i < personasEndIdx) {
            const row = rows[i];
            const username = row[usernameIdx]?.trim();
            const firstCell = username?.toLowerCase();
            
            // Skip header row and empty rows
            if (!username || firstCell === 'username' || firstCell === 'info') {
              i++;
              continue;
            }
            
            // Found a username - this is the start of a new persona
            if (username && username.includes('_')) {
              let bio = row[infoIdx] || '';
              
              // Collect all following rows that don't have a username (continuation of bio)
              i++;
              while (i < personasEndIdx) {
                const nextRow = rows[i];
                const nextUsername = nextRow[usernameIdx]?.trim();
                
                // If next row has a username, we've reached the next persona
                if (nextUsername && nextUsername.includes('_')) {
                  break;
                }
                
                // If next row has bio content, append it
                if (nextRow[infoIdx] && nextRow[infoIdx].trim()) {
                  bio += '\n' + nextRow[infoIdx];
                }
                
                i++;
              }
              
              // Create persona
              const name = username.split('_')[0] || username;
              personas.push({
                company_id: '',
                name: name.charAt(0).toUpperCase() + name.slice(1),
                bio: bio.trim(),
                reddit_username: username,
                tone: 'casual' as Persona['tone'],
                expertise_areas: [],
              });
            } else {
              i++;
            }
          }
        }
        
        // Parse queries section
        if (queriesStartIdx >= 0) {
          const keywordIdx = 1; // keyword is in second column
          
          for (let i = queriesStartIdx; i < rows.length; i++) {
            const row = rows[i];
            if (row[keywordIdx] && row[0]?.toLowerCase().trim() !== 'keyword_id') {
              const keyword = row[keywordIdx].trim();
              if (keyword && keyword.toLowerCase() !== 'keyword') {
                queries.push({
                  company_id: '',
                  query: keyword,
                  intent: 'question' as ChatGPTQuery['intent'],
                });
              }
            }
          }
        }
      }
      
      // Parse rows based on detected type
      // Handle combined files: if Type column exists, filter rows by type
      // Otherwise, process all rows based on which fields are present
      
      if (hasCompanyFields && !mightBeTransposed) {
        // Company data - matching your exact columns
        const nameIdx = headers.findIndex(h => 
          ['company', 'company name', 'name'].includes(h)
        );
        const descIdx = headers.findIndex(h => 
          ['description', 'desc', 'about'].includes(h)
        );
        const websiteIdx = headers.findIndex(h => 
          ['website', 'url', 'site'].includes(h)
        );
        const subredditsIdx = headers.findIndex(h => 
          ['subreddits', 'subreddit'].includes(h)
        );
        const postsPerWeekIdx = headers.findIndex(h => 
          ['number of posts per week', 'posts per week', 'posts_per_week'].includes(h)
        );

        // If Type column exists, only process rows marked as "company"
        // Otherwise, process first row that has company fields
        const companyRows = hasTypeColumn
          ? rows.filter(row => row[typeIdx]?.toLowerCase().includes('company'))
          : rows.filter(row => {
              // Check if row has company data (name and description columns have values)
              return nameIdx >= 0 && descIdx >= 0 && 
                     row[nameIdx] && row[descIdx];
            });

        if (companyRows.length > 0) {
          const row = companyRows[0]; // Use first company row
          company = {
            name: row[nameIdx] || '',
            description: row[descIdx] || '',
            website: websiteIdx >= 0 ? row[websiteIdx] : undefined,
          };

          // Parse subreddits from company sheet if present
          if (subredditsIdx >= 0 && row[subredditsIdx]) {
            const subredditNames = row[subredditsIdx]
              .split(/[,;]/)
              .map(s => s.trim())
              .filter(Boolean);
            
            subredditNames.forEach(name => {
              // Remove r/ prefix if present
              const cleanName = name.startsWith('r/') ? name.substring(2) : name;
              subreddits.push({
                company_id: '',
                name: cleanName,
                post_frequency_limit: 2, // Default
              });
            });
          }

          // Extract posts per week from company sheet
          if (postsPerWeekIdx >= 0 && row[postsPerWeekIdx]) {
            const parsed = parseInt(row[postsPerWeekIdx]);
            if (!isNaN(parsed) && parsed > 0) {
              postsPerWeek = parsed;
            }
          }
        }
      }

      if (hasPersonaFields) {
        // Personas data - matching your exact columns: Username, Info
        const usernameIdx = headers.findIndex(h => 
          ['username', 'reddit username', 'reddit', 'u/'].includes(h)
        );
        const infoIdx = headers.findIndex(h => 
          ['info', 'bio', 'biography', 'description', 'about'].includes(h)
        );
        const nameIdx = headers.findIndex(h => 
          ['persona', 'persona name', 'name'].includes(h)
        );
        const toneIdx = headers.findIndex(h => 
          ['tone', 'style', 'voice'].includes(h)
        );
        const expertiseIdx = headers.findIndex(h => 
          ['expertise', 'expertise areas', 'skills', 'areas'].includes(h)
        );

        // If Type column exists, only process rows marked as "persona"
        // Otherwise, process all rows that have persona fields
        const personaRows = hasTypeColumn
          ? rows.filter(row => row[typeIdx]?.toLowerCase().includes('persona'))
          : rows.filter(row => {
              // Check if row has persona data (username and info columns have values)
              return usernameIdx >= 0 && infoIdx >= 0 && 
                     row[usernameIdx] && row[infoIdx];
            });

        personaRows.forEach(row => {
          if (usernameIdx >= 0 && infoIdx >= 0) {
            // Use Username as both reddit_username and name (if name not provided)
            const username = row[usernameIdx] || '';
            const bio = row[infoIdx] || '';
            
            // Try to extract name from username or use username as name
            const name = nameIdx >= 0 && row[nameIdx] 
              ? row[nameIdx] 
              : username.split('_')[0] || username; // Use part before underscore as name

            const expertiseStr = expertiseIdx >= 0 ? row[expertiseIdx] : '';
            const expertiseAreas = expertiseStr
              ? expertiseStr.split(/[,;]/).map(e => e.trim()).filter(Boolean)
              : [];

            const tone = toneIdx >= 0 
              ? (row[toneIdx]?.toLowerCase() || 'casual')
              : 'casual';

            // Validate tone
            const validTones = ['professional', 'casual', 'friendly', 'technical', 'humorous'];
            const validTone = validTones.includes(tone) ? tone : 'casual';

            personas.push({
              company_id: '', // Will be set when company is saved
              name: name,
              bio: bio,
              reddit_username: username,
              tone: validTone as Persona['tone'],
              expertise_areas: expertiseAreas,
            });
          }
        });
      }

      if (hasSubredditFields) {
        // Subreddits data
        const nameIdx = headers.findIndex(h => 
          ['subreddit', 'subreddit name', 'name', 'r/'].includes(h)
        );
        const descIdx = headers.findIndex(h => 
          ['description', 'desc', 'about'].includes(h)
        );
        const limitIdx = headers.findIndex(h => 
          ['post frequency limit', 'limit', 'posts per week', 'frequency'].includes(h)
        );

        rows.forEach(row => {
          if (nameIdx >= 0) {
            let name = row[nameIdx] || '';
            // Remove r/ prefix if present
            if (name.startsWith('r/')) {
              name = name.substring(2);
            }

            subreddits.push({
              company_id: '', // Will be set when company is saved
              name: name.trim(),
              description: descIdx >= 0 ? row[descIdx] : undefined,
              post_frequency_limit: limitIdx >= 0 
                ? parseInt(row[limitIdx]) || 2 
                : 2,
            });
          }
        });
      }

      if (hasQueryFields) {
        // ChatGPT queries data - matching your exact columns: keyword_id, keyword
        const keywordIdx = headers.findIndex(h => 
          ['keyword', 'query', 'chatgpt query', 'topic', 'question'].includes(h)
        );
        const intentIdx = headers.findIndex(h => 
          ['intent', 'type', 'category'].includes(h)
        );

        // If Type column exists, only process rows marked as "query" or "keyword"
        // Otherwise, process all rows that have query fields
        const queryRows = hasTypeColumn
          ? rows.filter(row => {
              const type = row[typeIdx]?.toLowerCase() || '';
              return type.includes('query') || type.includes('keyword') || type.includes('chatgpt');
            })
          : rows.filter(row => {
              // Check if row has query data (keyword column has value)
              return keywordIdx >= 0 && row[keywordIdx];
            });

        queryRows.forEach(row => {
          if (keywordIdx >= 0) {
            const intent = intentIdx >= 0 
              ? (row[intentIdx]?.toLowerCase() || 'question')
              : 'question';

            // Validate intent
            const validIntents = ['question', 'discussion', 'advice', 'review'];
            const validIntent = validIntents.includes(intent) ? intent : 'question';

            queries.push({
              company_id: '', // Will be set when company is saved
              query: row[keywordIdx] || '',
              intent: validIntent as ChatGPTQuery['intent'],
            });
          }
        });
      }

      // Check if this is a calendar output file
      if (isCalendarFile) {
        throw new Error(
          'This appears to be a Content Calendar output file (contains posts/comments). ' +
          'Please import your INPUT data files instead:\n' +
          '• Company.csv (with columns: Name, Website, Description, Subreddits, Number of posts per week)\n' +
          '• Personas.csv (with columns: Username, Info)\n' +
          '• Queries.csv (with columns: keyword_id, keyword)\n\n' +
          'Found headers: ' + headers.join(', ')
        );
      }

      // Check if this is posts/comments file (reference data, not needed for calendar generation)
      if (isPostsCommentsFile) {
        throw new Error(
          'This appears to be a Posts/Comments reference file. ' +
          'This file contains historical Reddit data and is not needed for calendar generation.\n\n' +
          'Please import your INPUT data file instead, which should contain:\n' +
          '• Company info (Name, Website, Description, Subreddits, Number of posts per week)\n' +
          '• Personas (Username, Info)\n' +
          '• ChatGPT Queries (keyword_id, keyword)\n\n' +
          'Found headers: ' + headers.join(', ')
        );
      }

      // Validate we got something
      if (!company && personas.length === 0 && subreddits.length === 0 && queries.length === 0) {
        // Provide more helpful error with suggestions
        const suggestions = [];
        if (hasNameField && !hasDescField) {
          suggestions.push('Found "name" column but missing "description". Add a Description column.');
        }
        if (hasNameField && hasDescField && rows.length === 0) {
          suggestions.push('Found headers but no data rows. Check if your CSV has data below the header.');
        }
        if (headers.length === 2 && headers.includes('name') && headers.some(h => h !== 'name')) {
          suggestions.push('Your CSV might be transposed (rows/columns swapped). Try transposing it in Excel/Sheets.');
        }
        
        let errorMsg = 'Could not detect data type. Please check your CSV headers match the expected format.\n\n';
        errorMsg += 'Found headers: ' + headers.join(', ') + '\n';
        errorMsg += 'Number of data rows: ' + rows.length + '\n\n';
        
        if (suggestions.length > 0) {
          errorMsg += 'Suggestions:\n' + suggestions.map(s => '• ' + s).join('\n') + '\n\n';
        }
        
        errorMsg += 'Expected formats:\n';
        errorMsg += '• Company: Name, Website, Description, Subreddits, Number of posts per week\n';
        errorMsg += '• Personas: Username, Info\n';
        errorMsg += '• Subreddits: Subreddit Name (or import from Company sheet)\n';
        errorMsg += '• Queries: keyword (or query), intent (optional)\n\n';
        errorMsg += 'Tip: Make sure your CSV has a header row as the first line.';
        
        throw new Error(errorMsg);
      }

      // Call callback with imported data
      const importedCompany = company || { name: '', description: '' };
      
      // Debug logging
      console.log('Importing data:', {
        company: importedCompany,
        personasCount: personas.length,
        subredditsCount: subreddits.length,
        queriesCount: queries.length,
        postsPerWeek,
      });
      
      onDataImported({
        company: importedCompany,
        personas,
        subreddits,
        queries,
        postsPerWeek,
      });

      const importedItems = [];
      if (company?.name) importedItems.push('Company');
      if (personas.length > 0) importedItems.push(`${personas.length} persona${personas.length > 1 ? 's' : ''}`);
      if (subreddits.length > 0) importedItems.push(`${subreddits.length} subreddit${subreddits.length > 1 ? 's' : ''}`);
      if (queries.length > 0) importedItems.push(`${queries.length} quer${queries.length > 1 ? 'ies' : 'y'}`);
      if (postsPerWeek) importedItems.push(`${postsPerWeek} posts/week`);
      
      setSuccess(`Successfully imported: ${importedItems.join(', ')}`);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import data');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
      >
        {isOpen ? '▼ Hide' : '📥 Import from CSV/Google Sheets'}
      </button>

      {isOpen && (
        <div className="mt-4 bg-white p-6 rounded-lg shadow border-2 border-purple-200">
          <h3 className="text-lg font-semibold mb-4">Import Data from CSV</h3>
          
          <div className="mb-4 text-sm text-gray-600 space-y-2">
            <p><strong>How to export from Google Sheets:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Open your Google Sheet</li>
              <li>File → Download → Comma Separated Values (.csv)</li>
              <li>Upload the CSV file below</li>
            </ol>
            
            <p className="mt-4"><strong>Expected CSV formats:</strong></p>
            <div className="bg-gray-50 p-3 rounded text-xs font-mono">
              <p><strong>Company:</strong> company/name, description, website, industry, target audience</p>
              <p><strong>Personas:</strong> persona/name, bio, reddit username, tone, expertise</p>
              <p><strong>Subreddits:</strong> subreddit/name, description, post frequency limit</p>
              <p><strong>Queries:</strong> query, intent</p>
            </div>
          </div>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={importing}
            className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          {importing && (
            <div className="text-center text-gray-600">
              Importing...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

