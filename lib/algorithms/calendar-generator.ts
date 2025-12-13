import { 
  CalendarGenerationInput, 
  CalendarGenerationResult, 
  ContentCalendar, 
  CalendarPost, 
  Persona, 
  Subreddit,
  ChatGPTQuery 
} from '@/lib/types';
import { format, addDays, startOfWeek, endOfWeek, parseISO } from 'date-fns';

/**
 * Core algorithm for generating Reddit content calendars
 * 
 * Key principles:
 * - Natural conversation flow between personas
 * - Avoid overposting in subreddits
 * - Distribute posts evenly across the week
 * - Create engaging, authentic content
 * - Quality over quantity
 */
export class CalendarGenerator {
  private input: CalendarGenerationInput;
  private warnings: string[] = [];

  constructor(input: CalendarGenerationInput) {
    this.input = input;
  }

  /**
   * Main entry point for calendar generation
   */
  async generate(): Promise<CalendarGenerationResult> {
    this.warnings = [];
    
    // Validate inputs
    this.validateInputs();
    
    // Calculate week dates
    const weekStart = startOfWeek(this.input.week_start_date, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(this.input.week_start_date, { weekStartsOn: 1 }); // Sunday
    
    // Create calendar
    const calendar: ContentCalendar = {
      company_id: this.input.company.id || '',
      week_start_date: format(weekStart, 'yyyy-MM-dd'),
      week_end_date: format(weekEnd, 'yyyy-MM-dd'),
      posts_per_week: this.input.posts_per_week,
      generated_at: new Date().toISOString(),
    };

    // Generate posts
    const posts = this.generatePosts(weekStart, weekEnd);
    
    // Calculate quality score
    const qualityScore = this.calculateQualityScore(posts);
    calendar.quality_score = qualityScore;

    return {
      calendar,
      posts,
      quality_score: qualityScore,
      warnings: this.warnings,
    };
  }

  /**
   * Validate inputs before generation
   */
  private validateInputs(): void {
    if (this.input.personas.length < 2) {
      throw new Error('At least 2 personas are required');
    }
    
    if (this.input.subreddits.length === 0) {
      throw new Error('At least 1 subreddit is required');
    }
    
    if (this.input.chatgpt_queries.length === 0) {
      throw new Error('At least 1 ChatGPT query is required');
    }
    
    if (this.input.posts_per_week < 1) {
      throw new Error('Posts per week must be at least 1');
    }

    // Check for duplicate Reddit usernames
    const usernames = this.input.personas.map(p => p.reddit_username.toLowerCase());
    const duplicates = usernames.filter((u, i) => usernames.indexOf(u) !== i);
    if (duplicates.length > 0) {
      this.warnings.push(`Duplicate Reddit usernames detected: ${duplicates.join(', ')}`);
    }
  }

  /**
   * Generate posts distributed across the week
   */
  private generatePosts(weekStart: Date, weekEnd: Date): CalendarPost[] {
    const posts: CalendarPost[] = [];
    const daysOfWeek = this.getDaysOfWeek(weekStart, weekEnd);
    const totalPosts = this.input.posts_per_week;
    
    // Calculate distribution: spread posts across the week
    const postsPerDay = Math.floor(totalPosts / 7);
    const extraPosts = totalPosts % 7;
    
    // Track subreddit posting frequency
    const subredditPostCount: Map<string, number> = new Map();
    this.input.subreddits.forEach(sub => {
      subredditPostCount.set(sub.id || sub.name, 0);
    });
    
    // Track persona activity to ensure variety
    const personaPostCount: Map<string, number> = new Map();
    this.input.personas.forEach(persona => {
      personaPostCount.set(persona.id || persona.name, 0);
    });
    
    // Track topics to avoid overlap
    const usedTopics: Set<string> = new Set();
    
    let postIndex = 0;
    
    // Generate original posts first
    for (let dayIndex = 0; dayIndex < daysOfWeek.length; dayIndex++) {
      const day = daysOfWeek[dayIndex];
      const postsThisDay = postsPerDay + (dayIndex < extraPosts ? 1 : 0);
      
      for (let i = 0; i < postsThisDay; i++) {
        // Select subreddit (avoid overposting)
        const subreddit = this.selectSubreddit(subredditPostCount);
        if (!subreddit) break;
        
        // Select persona (ensure variety)
        const persona = this.selectPersona(personaPostCount, subreddit.id || '');
        
        // Select topic (avoid overlap)
        const topic = this.selectTopic(usedTopics);
        
        // Generate post content
        const post = this.generateOriginalPost(
          persona,
          subreddit,
          topic,
          day,
          postIndex
        );
        
        posts.push(post);
        postIndex++;
        
        // Update tracking
        subredditPostCount.set(subreddit.id || subreddit.name, 
          (subredditPostCount.get(subreddit.id || subreddit.name) || 0) + 1);
        personaPostCount.set(persona.id || persona.name, 
          (personaPostCount.get(persona.id || persona.name) || 0) + 1);
        usedTopics.add(topic.query);
        
        // Check for overposting warning
        const limit = subreddit.post_frequency_limit || 2;
        const count = subredditPostCount.get(subreddit.id || subreddit.name) || 0;
        if (count > limit) {
          this.warnings.push(
            `Overposting detected: ${subreddit.name} has ${count} posts (limit: ${limit})`
          );
        }
      }
    }
    
    // Generate comments to create conversation flow
    const comments = this.generateComments(posts, personaPostCount);
    posts.push(...comments);
    
    return posts.sort((a, b) => {
      const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date);
      if (dateCompare !== 0) return dateCompare;
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });
  }

  /**
   * Get array of dates for the week
   */
  private getDaysOfWeek(weekStart: Date, weekEnd: Date): Date[] {
    const days: Date[] = [];
    let current = new Date(weekStart);
    
    while (current <= weekEnd) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    
    return days;
  }

  /**
   * Select subreddit with consideration for posting limits
   */
  private selectSubreddit(postCount: Map<string, number>): Subreddit | null {
    // Filter subreddits that haven't exceeded their limit
    const available = this.input.subreddits.filter(sub => {
      const limit = sub.post_frequency_limit || 2;
      const count = postCount.get(sub.id || sub.name) || 0;
      return count < limit;
    });
    
    if (available.length === 0) {
      // All subreddits at limit, use least posted one
      const sorted = [...this.input.subreddits].sort((a, b) => {
        const countA = postCount.get(a.id || a.name) || 0;
        const countB = postCount.get(b.id || b.name) || 0;
        return countA - countB;
      });
      return sorted[0] || null;
    }
    
    // Weighted selection: prefer subreddits with fewer posts
    const weights = available.map(sub => {
      const count = postCount.get(sub.id || sub.name) || 0;
      return 1 / (count + 1); // Inverse weight
    });
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < available.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return available[i];
      }
    }
    
    return available[0];
  }

  /**
   * Select persona ensuring variety
   */
  private selectPersona(postCount: Map<string, number>, subredditId: string): Persona {
    // Prefer personas with fewer posts
    const sorted = [...this.input.personas].sort((a, b) => {
      const countA = postCount.get(a.id || a.name) || 0;
      const countB = postCount.get(b.id || b.name) || 0;
      return countA - countB;
    });
    
    // Sometimes use the least active persona, sometimes randomize
    if (Math.random() < 0.7) {
      return sorted[0];
    }
    
    // Random selection from bottom half
    const half = Math.ceil(sorted.length / 2);
    const candidates = sorted.slice(0, half);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Select topic avoiding overlap
   */
  private selectTopic(usedTopics: Set<string>): ChatGPTQuery {
    // Filter unused topics
    const unused = this.input.chatgpt_queries.filter(q => !usedTopics.has(q.query));
    
    if (unused.length === 0) {
      // All topics used, reset or reuse least recent
      return this.input.chatgpt_queries[
        Math.floor(Math.random() * this.input.chatgpt_queries.length)
      ];
    }
    
    // Random selection from unused topics
    return unused[Math.floor(Math.random() * unused.length)];
  }

  /**
   * Generate an original post
   */
  private generateOriginalPost(
    persona: Persona,
    subreddit: Subreddit,
    topic: ChatGPTQuery,
    scheduledDate: Date,
    index: number
  ): CalendarPost {
    const calendarId = 'temp'; // Will be set after calendar creation
    
    // Generate title based on topic and persona tone
    const title = this.generatePostTitle(topic, persona, subreddit);
    
    // Generate content based on persona and topic
    const content = this.generatePostContent(topic, persona, subreddit);
    
    // Distribute posts throughout the day (9 AM - 9 PM)
    const hour = 9 + Math.floor(Math.random() * 12);
    const minute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
    
    return {
      calendar_id: calendarId,
      persona_id: persona.id || '',
      subreddit_id: subreddit.id || '',
      title,
      content,
      scheduled_date: format(scheduledDate, 'yyyy-MM-dd'),
      scheduled_time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      post_type: 'original',
      status: 'pending',
    };
  }

  /**
   * Generate comments to create natural conversation flow
   */
  private generateComments(
    originalPosts: CalendarPost[],
    personaPostCount: Map<string, number>
  ): CalendarPost[] {
    const comments: CalendarPost[] = [];
    
    // For each original post, potentially add 1-2 comments from other personas
    for (const post of originalPosts) {
      if (post.post_type !== 'original') continue;
      
      // 60% chance of getting a comment
      if (Math.random() < 0.6) {
        // Select a different persona
        const otherPersonas = this.input.personas.filter(
          p => (p.id || p.name) !== post.persona_id
        );
        
        if (otherPersonas.length > 0) {
          const commenter = otherPersonas[
            Math.floor(Math.random() * otherPersonas.length)
          ];
          
          // Comment should be posted 2-6 hours after original
          const postDate = parseISO(post.scheduled_date);
          const [postHour, postMinute] = post.scheduled_time.split(':').map(Number);
          const commentHour = Math.min(21, postHour + 2 + Math.floor(Math.random() * 4));
          const commentMinute = Math.floor(Math.random() * 4) * 15;
          
          // If comment hour exceeds same day, move to next day
          let commentDate = new Date(postDate);
          if (commentHour >= 22) {
            commentDate = addDays(commentDate, 1);
          }
          
          const commentContent = this.generateCommentContent(post, commenter);
          
          comments.push({
            calendar_id: post.calendar_id,
            persona_id: commenter.id || '',
            subreddit_id: post.subreddit_id,
            title: '', // Comments don't have titles
            content: commentContent,
            scheduled_date: format(commentDate, 'yyyy-MM-dd'),
            scheduled_time: `${commentHour.toString().padStart(2, '0')}:${commentMinute.toString().padStart(2, '0')}`,
            post_type: 'comment',
            parent_post_id: post.id,
            status: 'pending',
          });
          
          // Update persona count
          personaPostCount.set(commenter.id || commenter.name, 
            (personaPostCount.get(commenter.id || commenter.name) || 0) + 1);
        }
      }
    }
    
    return comments;
  }

  /**
   * Generate post title
   */
  private generatePostTitle(
    topic: ChatGPTQuery,
    persona: Persona,
    subreddit: Subreddit
  ): string {
    // Base title on query intent and persona tone
    const queryLower = topic.query.toLowerCase();
    
    if (topic.intent === 'question') {
      if (persona.tone === 'casual' || persona.tone === 'friendly') {
        return `Has anyone tried ${this.extractKeyTerms(topic.query)}? Looking for advice`;
      } else if (persona.tone === 'technical') {
        return `Question about ${this.extractKeyTerms(topic.query)} - Best practices?`;
      } else {
        return `Looking for insights on ${this.extractKeyTerms(topic.query)}`;
      }
    } else if (topic.intent === 'discussion') {
      return `Thoughts on ${this.extractKeyTerms(topic.query)}?`;
    } else if (topic.intent === 'advice') {
      return `Need advice: ${this.extractKeyTerms(topic.query)}`;
    } else {
      return `Review: ${this.extractKeyTerms(topic.query)}`;
    }
  }

  /**
   * Generate post content
   */
  private generatePostContent(
    topic: ChatGPTQuery,
    persona: Persona,
    subreddit: Subreddit
  ): string {
    const tone = persona.tone;
    const expertise = persona.expertise_areas.join(', ');
    
    let content = '';
    
    if (tone === 'casual') {
      content = `Hey everyone! I've been thinking about ${topic.query} and wanted to get your thoughts.\n\n`;
      if (expertise) {
        content += `I work in ${expertise}, so I'm coming at this from that angle. `;
      }
      content += `What's your experience been like? Any tips or things to watch out for?\n\n`;
      content += `Thanks in advance!`;
    } else if (tone === 'professional') {
      content = `I'd like to discuss ${topic.query} with this community.\n\n`;
      if (expertise) {
        content += `My background is in ${expertise}, and I'm interested in understanding `;
        content += `how others approach this topic.\n\n`;
      }
      content += `What strategies or solutions have worked well for you?`;
    } else if (tone === 'technical') {
      content = `Technical question about ${topic.query}:\n\n`;
      if (expertise) {
        content += `I'm working with ${expertise} and need to understand `;
        content += `the best practices here.\n\n`;
      }
      content += `Looking for insights from those who have experience with this. `;
      content += `What approaches have you found most effective?`;
    } else if (tone === 'friendly') {
      content = `Hi r/${subreddit.name}! 👋\n\n`;
      content += `I'm curious about ${topic.query}. `;
      if (expertise) {
        content += `I have some experience with ${expertise}, but I'd love to hear `;
        content += `what you all think!\n\n`;
      }
      content += `What's worked for you? Any lessons learned?`;
    } else { // humorous
      content = `Alright, let's talk about ${topic.query}... `;
      content += `because apparently I need more opinions in my life! 😅\n\n`;
      if (expertise) {
        content += `I'm in ${expertise}, so I know just enough to be dangerous. `;
      }
      content += `What's your take?`;
    }
    
    return content;
  }

  /**
   * Generate comment content
   */
  private generateCommentContent(
    originalPost: CalendarPost,
    commenter: Persona
  ): string {
    const tone = commenter.tone;
    const expertise = commenter.expertise_areas.join(', ');
    
    let content = '';
    
    if (tone === 'casual') {
      content = `Great question! `;
      if (expertise) {
        content += `I've been working with ${expertise} for a while, `;
      }
      content += `and here's what I've found...`;
    } else if (tone === 'professional') {
      content = `Thanks for bringing this up. `;
      if (expertise) {
        content += `From my experience in ${expertise}, `;
      }
      content += `I'd add that...`;
    } else if (tone === 'technical') {
      content = `Good point. `;
      if (expertise) {
        content += `In ${expertise}, we typically see... `;
      }
      content += `Here's a technical perspective:`;
    } else if (tone === 'friendly') {
      content = `Love this discussion! `;
      if (expertise) {
        content += `I work with ${expertise} and have found that... `;
      }
      content += `Hope this helps!`;
    } else { // humorous
      content = `Ha! I've been there. `;
      if (expertise) {
        content += `As someone who's dealt with ${expertise}, `;
      }
      content += `here's my two cents...`;
    }
    
    return content;
  }

  /**
   * Extract key terms from query for title generation
   */
  private extractKeyTerms(query: string): string {
    // Simple extraction - take first 5-7 words
    const words = query.split(' ').slice(0, 7);
    return words.join(' ');
  }

  /**
   * Calculate quality score for the generated calendar
   */
  private calculateQualityScore(posts: CalendarPost[]): number {
    let score = 10.0;
    
    // Check for overposting in subreddits
    const subredditCounts: Map<string, number> = new Map();
    posts.forEach(post => {
      if (post.post_type === 'original') {
        const count = subredditCounts.get(post.subreddit_id) || 0;
        subredditCounts.set(post.subreddit_id, count + 1);
      }
    });
    
    subredditCounts.forEach((count, subredditId) => {
      const subreddit = this.input.subreddits.find(s => 
        (s.id || s.name) === subredditId
      );
      const limit = subreddit?.post_frequency_limit || 2;
      if (count > limit) {
        score -= 1.5; // Penalty for overposting
      }
    });
    
    // Check for persona variety
    const personaCounts: Map<string, number> = new Map();
    posts.forEach(post => {
      const count = personaCounts.get(post.persona_id) || 0;
      personaCounts.set(post.persona_id, count + 1);
    });
    
    const personaValues = Array.from(personaCounts.values());
    const maxPersonaPosts = Math.max(...personaValues);
    const minPersonaPosts = Math.min(...personaValues);
    const personaSpread = maxPersonaPosts - minPersonaPosts;
    
    if (personaSpread > 3) {
      score -= 1.0; // Penalty for uneven distribution
    }
    
    // Check for topic diversity
    const uniqueTopics = new Set(
      posts
        .filter(p => p.post_type === 'original')
        .map(p => p.title)
    );
    
    if (uniqueTopics.size < posts.filter(p => p.post_type === 'original').length * 0.7) {
      score -= 1.0; // Penalty for repetitive topics
    }
    
    // Check for natural conversation flow (comments responding to posts)
    const originalPosts = posts.filter(p => p.post_type === 'original');
    const comments = posts.filter(p => p.post_type === 'comment');
    const commentRatio = comments.length / originalPosts.length;
    
    if (commentRatio < 0.3) {
      score -= 0.5; // Not enough conversation
    } else if (commentRatio > 1.5) {
      score -= 0.5; // Too many comments, looks artificial
    }
    
    // Check for time distribution
    const timeSlots: Set<string> = new Set();
    posts.forEach(post => {
      timeSlots.add(`${post.scheduled_date}-${post.scheduled_time.substring(0, 2)}`);
    });
    
    const timeSpread = timeSlots.size / posts.length;
    if (timeSpread < 0.5) {
      score -= 0.5; // Posts too clustered in time
    }
    
    // Ensure score is between 0 and 10
    return Math.max(0, Math.min(10, score));
  }
}

