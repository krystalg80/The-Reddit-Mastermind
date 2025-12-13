# Reddit Mastermind

Hi Maddie :) This is my solution for the Reddit Mastermind challenge. With the help of Cursor I built an algorithm that automates Reddit content calendar generation - taking company info, personas, subreddits, and ChatGPT queries as inputs, and outputting a full week's content calendar with posts and comments. You will also find a System Design Image that I went ahead and created prior to coding!

## What I Built

Needed to create an algorithm that:
- Takes company info, personas (2+), subreddits, ChatGPT queries, and posts per week
- Generates a content calendar for the week
- Can generate calendars for subsequent weeks
- Creates natural, engaging conversations (not manufactured)
Built a full web app with:
- CSV import from Google Sheets
- Database persistence with Supabase
- ChatGPT API integration with intelligent fallbacks
- Quality scoring system
- Visual indicators for AI vs template content
- Data persistence across refreshes

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **AI**: OpenAI ChatGPT API (with template fallbacks)
- **Deployment**: Vercel

## Key Features

### 1. Content Generation Algorithm

The `CalendarGenerator` class that:
- Distributes posts evenly across the week
- Selects subreddits with weighted randomness (avoids overposting)
- Ensures persona variety (no back-to-back same persona)
- Avoids topic overlap
- Generates natural comments that respond to posts
- Calculates quality scores based on distribution, variety, and engagement

### 2. ChatGPT Integration

I integrated the OpenAI API for more natural content:
- Post titles generated based on topic, persona tone, and subreddit
- Post content that matches persona bio and expertise
- Comments that actually respond to the original post context

**Important**: I'm using the free tier, so there's rate limiting (3 requests/minute). The app includes intelligent fallbacks that had to be hardcoded but is used incase of a Fallback is needed.

### 3. Fallback System

When ChatGPT isn't available (quota exceeded, API errors, etc.), the app falls back to template-based generation. Wanted to make sure these templates felt natural:
- Handles comparison questions properly (e.g., "Claude vs Slideforge")
- Varied comment types (share experience, add value, ask follow-up, etc.)
- Different tones (casual, professional, technical, friendly, humorous)
- Context-aware responses

You can see which content came from ChatGPT vs templates using the badges (🤖 AI vs 📝 Template). This was added only so you could understand whats happening behind the scenes, realistically this wouldn't be on a published site more for a development side.

### 4. Quality Scoring

Each calendar gets a quality score (0-10) based on:
- Subreddit posting limits (penalizes overposting)
- Persona variety and distribution
- Topic diversity
- Comment-to-post ratio (natural conversation flow)
- Time distribution across the week
- MOST LIKELY you will recieve a 10/10 because the goal from my end is to not deliver anything under a 10! 

### 5. CSV Import

Had to install a CSV Importer! The importer handles:
- Transposed CSV formats (field names in first column)
- Multi-line fields (persona bios with line breaks)
- Combined sheets (company + personas + queries in one file)
- Flexible field name matching
- Makes it easier so you could just upload the sample data created in google sheets!

### 6. Data Persistence

- Auto-saves to localStorage (survives page refreshes) 
- Saves to Supabase database (persists across sessions)
- Clear Data button to reset everything

## Setup

### Prerequisites

- Node.js 20.9.0+
- Supabase account (free tier works)
- OpenAI API key (app also works without it)

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd The-Reddit-Mastermind

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase URL, anon key, and OpenAI API key
# this has been done in vercel already so not needed unless you are operating on own environment / development server.
```

### Database Setup

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `lib/database/schema.sql`
3. Run it

The schema includes:
- Companies table
- Personas table (with tone validation)
- Subreddits table (with posting limits)
- ChatGPT queries table
- Content calendars table
- Calendar posts table (with source tracking)


## How It Works

1. **Import or Enter Data**: Upload CSV files or manually enter company info, personas, subreddits, and queries
2. **Set Posts Per Week**: Choose how many posts you want
3. **Generate Calendar**: Click "Generate This Week's Calendar"
4. **Review**: Check the quality score and see which content was AI-generated vs template
5. **Generate Next Week**: Click "Generate Next Week" for subsequent weeks

## Algorithm Details

Posts are distributed evenly across the week:
- Calculates posts per day based on total posts per week
- Distributes extra posts across first few days
- Schedules posts between 9 AM - 9 PM
- 24 HOUR CLOCK (can be edited to be a 12 hour clock based off of the users timezone and timestamps)

### Subreddit Selection

Uses weighted randomness to avoid overposting:
- Tracks how many times each subreddit has been used
- Prefers subreddits that haven't hit their limit
- Warns if overposting is detected

### Persona Selection

Ensures variety:
- Tracks persona activity
- Avoids same persona posting back-to-back
- Distributes posts evenly across personas

### Comment Generation

Every post gets at least one comment (sometimes two):
- Comments are posted 2-6 hours after original post
- Different persona than the original poster
- Comments reference the original post's topic
- Varied comment types for natural conversation

### Quality Scoring

The algorithm evaluates:
- **Subreddit limits**: -1.5 points per overposting violation
- **Persona variety**: +1.5 for even distribution
- **Topic diversity**: +1.5 for unique topics
- **Comment ratio**: +1.5 for ideal ratio (0.8-1.2 comments per post)
- **Time distribution**: +1.0 for well-spread posts
- **SHOULD JUST BE A 10/10**

## Rate Limiting

I added rate limiting to respect OpenAI's free tier limits (3 RPM):
- Adds 20-second delays between API calls
- Prevents hitting rate limits
- Can be disabled for paid tiers (set `isFreeTier = false` in `rate-limiter.ts`)

**Note**: Generation takes ~2 minutes with free tier due to rate limiting. In production with a paid tier, this would be under 10 seconds.

## File Structure

```
├── app/
│   ├── api/
│   │   └── calendars/
│   │       ├── generate/route.ts      # Generate current week calendar
│   │       └── generate-next/route.ts # Generate next week calendar
│   ├── page.tsx                        # Main app page
│   └── layout.tsx                      # Root layout
├── components/
│   ├── CalendarDisplay.tsx             # Calendar visualization
│   ├── CompanyForm.tsx                 # Company info form
│   ├── DataImporter.tsx                # CSV import component
│   ├── PersonaManager.tsx              # Persona management
│   ├── QueryManager.tsx                # ChatGPT queries management
│   └── SubredditManager.tsx            # Subreddit management
├── lib/
│   ├── ai/
│   │   ├── chatgpt.ts                  # ChatGPT API integration
│   │   └── rate-limiter.ts             # Rate limiting utility
│   ├── algorithms/
│   │   └── calendar-generator.ts       # Core algorithm
│   ├── database/
│   │   └── schema.sql                  # Database schema
│   ├── supabase/
│   │   ├── client.ts                   # Client-side Supabase
│   │   └── server.ts                   # Server-side Supabase
│   └── types.ts                        # TypeScript types
└── README.md
```

## Solutions I came across

1. **Natural Conversations**: Made comments actually respond to posts, not just generic responses
2. **Comparison Questions**: Handled "X vs Y" questions properly (not treating them as single tools)
3. **Overposting Detection**: Algorithm warns when subreddit limits are exceeded
4. **CSV Import Edge Cases**: Handled transposed formats, multi-line fields, combined sheets
5. **Rate Limiting**: Built rate limiter to work within free tier constraints
6. **Error Handling**: Graceful fallbacks when API fails
7. **Data Persistence**: localStorage + Supabase for reliable data storage

## Future Improvements

If I had more time, I'd add:
- Batch API calls to reduce rate limit delays
- More sophisticated comment threading
- Analytics dashboard for calendar performance
- Export calendars to CSV/PDF
- If funding was available I am sure we would get the expected result in seconds
- Schedule posts directly to Reddit (mentioned in requirements as assumed)

## Deployment

Deployed on Vercel. Made sure to set environment variables

## Notes for Testing

- The app works perfectly without OpenAI API key (uses templates)
- If you see template badges, it means ChatGPT quota was exceeded (expected on free tier)
- Generation takes ~2 minutes due to rate limiting (normal for free tier)
- All data persists in Supabase and localStorage

## Development Tools

I used **Cursor** to build this project. It definitely has been a new addition to the software engineering world and I may say AI really does help me deliver more efficiently in a sooner time matter as well!

---

Built by Krystal Galdamez

