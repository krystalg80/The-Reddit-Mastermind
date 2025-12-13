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
import { generatePostTitle, generatePostContent, generateComment } from '@/lib/ai/chatgpt';

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
    const posts = await this.generatePosts(weekStart, weekEnd);
    
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
  private async generatePosts(weekStart: Date, weekEnd: Date): Promise<CalendarPost[]> {
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
        
        // Generate post content (async with ChatGPT)
        const post = await this.generateOriginalPost(
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
    const comments = await this.generateComments(posts, personaPostCount);
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
   * Generate an original post using ChatGPT
   */
  private async generateOriginalPost(
    persona: Persona,
    subreddit: Subreddit,
    topic: ChatGPTQuery,
    scheduledDate: Date,
    index: number
  ): Promise<CalendarPost> {
    const calendarId = 'temp'; // Will be set after calendar creation
    
    // Generate title using ChatGPT (with fallback to template)
    let title: string;
    let titleSource: 'chatgpt' | 'template' = 'template';
    try {
      title = await generatePostTitle(
        topic.query,
        topic.intent,
        persona.tone,
        subreddit.name
      );
      titleSource = 'chatgpt'; // Successfully generated by ChatGPT
    } catch (error: any) {
      // Check if it's a quota/rate limit error - fall back gracefully
      const isQuotaError = error?.code === 'insufficient_quota' || 
                          error?.type === 'insufficient_quota' ||
                          error?.message?.includes('quota') ||
                          error?.message?.includes('rate limit');
      
      if (isQuotaError) {
        console.warn('OpenAI quota exceeded, using template fallback for title');
      } else {
        console.warn('ChatGPT title generation failed, using template:', error);
      }
      title = this.generatePostTitle(topic, persona, subreddit);
      titleSource = 'template';
    }
    
    // Generate content using ChatGPT (with fallback to template)
    let content: string;
    let contentSource: 'chatgpt' | 'template' = 'template';
    try {
      content = await generatePostContent(
        topic.query,
        topic.intent,
        persona.tone,
        persona.bio,
        persona.expertise_areas,
        subreddit.name
      );
      contentSource = 'chatgpt'; // Successfully generated by ChatGPT
    } catch (error: any) {
      // Check if it's a quota/rate limit error - fall back gracefully
      const isQuotaError = error?.code === 'insufficient_quota' || 
                          error?.type === 'insufficient_quota' ||
                          error?.message?.includes('quota') ||
                          error?.message?.includes('rate limit');
      
      if (isQuotaError) {
        console.warn('OpenAI quota exceeded, using template fallback for content');
      } else {
        console.warn('ChatGPT content generation failed, using template:', error);
      }
      content = this.generatePostContent(topic, persona, subreddit);
      contentSource = 'template';
    }
    
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
      title_source: titleSource,
      content_source: contentSource,
    };
  }

  /**
   * Generate comments to create natural conversation flow using ChatGPT
   */
  private async generateComments(
    originalPosts: CalendarPost[],
    personaPostCount: Map<string, number>
  ): Promise<CalendarPost[]> {
    const comments: CalendarPost[] = [];
    
    // For each original post, ensure it gets at least one comment from another persona
    // This matches the business goal: "When we create posts and have our own accounts reply, clients get way more inbound"
    for (const post of originalPosts) {
      if (post.post_type !== 'original') continue;
      
      // Select a different persona to comment
      const otherPersonas = this.input.personas.filter(
        p => (p.id || p.name) !== post.persona_id
      );
      
      if (otherPersonas.length > 0) {
        // Always add at least one comment per post
        const numComments = Math.random() < 0.3 ? 2 : 1; // 30% chance of 2 comments, 70% chance of 1
        
        for (let i = 0; i < numComments; i++) {
          // Select a different persona for each comment (avoid same persona commenting twice on same post)
          const availablePersonas = otherPersonas.filter(
            p => !comments.some(c => c.parent_post_id === post.id && c.persona_id === (p.id || p.name))
          );
          
          if (availablePersonas.length === 0) break; // No more personas available
          
          const commenter = availablePersonas[
            Math.floor(Math.random() * availablePersonas.length)
          ];
          
          // Comment should be posted 2-6 hours after original (or after previous comment if multiple)
          const postDate = parseISO(post.scheduled_date);
          const [postHour, postMinute] = post.scheduled_time.split(':').map(Number);
          
          // If this is a second comment, space it out more
          const hoursAfterPost = i === 0 ? 2 + Math.floor(Math.random() * 4) : 4 + Math.floor(Math.random() * 3);
          const commentHour = Math.min(21, postHour + hoursAfterPost);
          const commentMinute = Math.floor(Math.random() * 4) * 15;
          
          // If comment hour exceeds same day, move to next day
          let commentDate = new Date(postDate);
          if (commentHour >= 22) {
            commentDate = addDays(commentDate, 1);
          }
          
          // Find the original topic used for this post to get better context
          const originalTopic = this.findTopicForPost(post);
          
          // Generate comment using ChatGPT (with fallback to template)
          let commentContent: string;
          let commentSource: 'chatgpt' | 'template' = 'template';
          try {
            const commentTypes: Array<'share_experience' | 'add_value' | 'agree_and_expand' | 'ask_followup' | 'provide_tip' | 'relate_personally'> = [
              'share_experience',
              'add_value',
              'agree_and_expand',
              'ask_followup',
              'provide_tip',
              'relate_personally'
            ];
            const commentType = commentTypes[Math.floor(Math.random() * commentTypes.length)];
            
            commentContent = await generateComment(
              post.title,
              post.content,
              originalTopic?.query || this.extractTopicFromTitle(post.title),
              originalTopic?.intent || 'question',
              commenter.tone,
              commenter.bio,
              commenter.expertise_areas,
              commentType
            );
            commentSource = 'chatgpt'; // Successfully generated by ChatGPT
          } catch (error: any) {
            // Check if it's a quota/rate limit error - fall back gracefully
            const isQuotaError = error?.code === 'insufficient_quota' || 
                                error?.type === 'insufficient_quota' ||
                                error?.message?.includes('quota') ||
                                error?.message?.includes('rate limit');
            
            if (isQuotaError) {
              console.warn('OpenAI quota exceeded, using template fallback for comment');
            } else {
              console.warn('ChatGPT comment generation failed, using template:', error);
            }
            commentContent = this.generateCommentContent(post, commenter, originalTopic);
            commentSource = 'template';
          }
          
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
            content_source: commentSource, // Comments only have content, no title
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
   * Generate post title - improved fallback templates
   */
  private generatePostTitle(
    topic: ChatGPTQuery,
    persona: Persona,
    subreddit: Subreddit
  ): string {
    const queryLower = topic.query.toLowerCase();
    const isComparison = queryLower.includes(' vs ') || queryLower.includes(' versus ') || queryLower.includes(' compare');
    const keyTerms = this.extractKeyTerms(topic.query);
    
    // Title variations based on intent and tone
    const titleVariations: Record<string, string[]> = {
      'question-casual': [
        `Has anyone tried ${keyTerms}?`,
        `Looking for advice on ${keyTerms}`,
        `Anyone have experience with ${keyTerms}?`,
        `Thoughts on ${keyTerms}?`
      ],
      'question-friendly': [
        `Hey! Anyone tried ${keyTerms}?`,
        `Looking for advice: ${keyTerms}`,
        `What do you think about ${keyTerms}?`
      ],
      'question-professional': [
        `Looking for insights on ${keyTerms}`,
        `Question about ${keyTerms} - best practices?`,
        `Seeking advice on ${keyTerms}`
      ],
      'question-technical': [
        `Question about ${keyTerms} - best practices?`,
        `Technical discussion: ${keyTerms}`,
        `Looking for technical insights on ${keyTerms}`
      ],
      'comparison': [
        `${keyTerms} - which is better?`,
        `Comparing ${keyTerms}`,
        `Has anyone tried both ${keyTerms}?`,
        `Need help choosing: ${keyTerms}`
      ],
      'discussion': [
        `Thoughts on ${keyTerms}?`,
        `Discussion: ${keyTerms}`,
        `What's your take on ${keyTerms}?`
      ],
      'advice': [
        `Need advice: ${keyTerms}`,
        `Looking for recommendations on ${keyTerms}`,
        `Help choosing: ${keyTerms}`
      ],
      'review': [
        `Review: ${keyTerms}`,
        `Has anyone reviewed ${keyTerms}?`,
        `Looking for reviews of ${keyTerms}`
      ]
    };
    
    // Select appropriate variations
    let variations: string[] = [];
    if (isComparison) {
      variations = titleVariations['comparison'];
    } else {
      const key = `${topic.intent}-${persona.tone}`;
      variations = titleVariations[key] || titleVariations[`${topic.intent}-casual`] || [`Question about ${keyTerms}`];
    }
    
    // Return random variation for naturalness
    return variations[Math.floor(Math.random() * variations.length)];
  }

  /**
   * Generate post content - improved fallback templates
   * IF OPENAI FAILS, THIS IS THE FALLBACK!!!!
   */
  private generatePostContent(
    topic: ChatGPTQuery,
    persona: Persona,
    subreddit: Subreddit
  ): string {
    const tone = persona.tone;
    const expertise = persona.expertise_areas.join(', ');
    const queryLower = topic.query.toLowerCase();
    const isComparison = queryLower.includes(' vs ') || queryLower.includes(' versus ') || queryLower.includes(' compare');
    
    let content = '';
    
    // Handle comparison questions specially
    if (isComparison) {
      const comparisonParts = topic.query.split(/ vs | versus | compare/i);
      const item1 = comparisonParts[0]?.trim() || '';
      const item2 = comparisonParts[1]?.trim() || '';
      
      if (tone === 'casual') {
        content = `I'm trying to decide between ${item1} and ${item2}.\n\n`;
        if (expertise) {
          content += `I work in ${expertise}, so I'm looking for something that fits that workflow. `;
        }
        content += `Has anyone tried both? What are the main differences you noticed?\n\n`;
        content += `I'd love to hear your experiences with either one!`;
      } else if (tone === 'professional') {
        content = `I'm evaluating ${item1} versus ${item2} for my use case.\n\n`;
        if (expertise) {
          content += `My background is in ${expertise}, and I'm looking for the best fit. `;
        }
        content += `Has anyone compared these? What were the key factors in your decision?\n\n`;
        content += `Appreciate any insights!`;
      } else if (tone === 'friendly') {
        content = `Hi r/${subreddit.name}! 👋\n\n`;
        content += `I'm trying to choose between ${item1} and ${item2}. `;
        if (expertise) {
          content += `I have some experience with ${expertise}, `;
        }
        content += `but I'd love to hear what you all think!\n\n`;
        content += `What's been your experience with either one?`;
      } else {
        content = `Looking to compare ${item1} and ${item2}.\n\n`;
        if (expertise) {
          content += `I'm working with ${expertise} and `;
        }
        content += `trying to figure out which would work better. Any thoughts?`;
      }
      return content;
    }
    
    // Regular questions
    if (tone === 'casual') {
      const openings = [
        `Hey everyone! I've been looking into ${topic.query} and wanted to get your thoughts.`,
        `Anyone have experience with ${topic.query}?`,
        `I'm curious about ${topic.query} - what's everyone's take?`
      ];
      content = openings[Math.floor(Math.random() * openings.length)] + '\n\n';
      
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
   * Find the original topic/query used for a post
   */
  private findTopicForPost(post: CalendarPost): ChatGPTQuery | null {
    // Try to match the post title/content with a query
    const titleLower = post.title.toLowerCase();
    const contentLower = post.content.toLowerCase();
    
    for (const query of this.input.chatgpt_queries) {
      const queryLower = query.query.toLowerCase();
      // Check if query appears in title or content
      if (titleLower.includes(queryLower) || contentLower.includes(queryLower)) {
        return query;
      }
    }
    
    // Fallback: extract from title
    const extracted = this.extractTopicFromTitle(post.title);
    return { 
      query: extracted, 
      intent: 'question',
      company_id: this.input.company.id || ''
    };
  }

  /**
   * Generate comment content - varied and natural responses that actually make sense
   */
  private generateCommentContent(
    originalPost: CalendarPost,
    commenter: Persona,
    topic: ChatGPTQuery | null
  ): string {
    const tone = commenter.tone;
    const expertise = commenter.expertise_areas.join(', ');
    
    // Use the actual topic query if available, otherwise extract from title
    const keyTerms = topic ? topic.query : this.extractTopicFromTitle(originalPost.title);
    const intent = topic?.intent || 'question';
    const keyTermsLower = keyTerms.toLowerCase();
    
    // Detect comparison questions
    const isComparison = keyTermsLower.includes(' vs ') || keyTermsLower.includes(' versus ') || 
                        keyTermsLower.includes(' compare') || originalPost.title.toLowerCase().includes(' vs ') ||
                        originalPost.title.toLowerCase().includes('versus') || originalPost.title.toLowerCase().includes('comparing');
    
    // Extract comparison items if it's a comparison
    let comparisonItem1 = '';
    let comparisonItem2 = '';
    if (isComparison) {
      const comparisonMatch = keyTerms.match(/(.+?)\s+(?:vs|versus|compare)\s+(.+)/i) || 
                             originalPost.title.match(/(.+?)\s+(?:vs|versus|comparing)\s+(.+)/i);
      if (comparisonMatch) {
        comparisonItem1 = comparisonMatch[1]?.trim() || '';
        comparisonItem2 = comparisonMatch[2]?.trim() || '';
      } else {
        // Fallback: try to split on common patterns
        const parts = keyTerms.split(/ vs | versus | compare/i);
        comparisonItem1 = parts[0]?.trim() || '';
        comparisonItem2 = parts[1]?.trim() || '';
      }
    }
    
    // Determine if this is a tool/product name vs a question/how-to
    const isToolOrProduct = this.isToolOrProduct(keyTerms) && !isComparison;
    const isHowToQuestion = keyTermsLower.includes('how to') || 
                            keyTermsLower.includes('how do') ||
                            keyTermsLower.startsWith('how');
    
    // Determine what the post is asking for based on intent
    const isAskingForRecommendation = intent === 'question' || intent === 'advice';
    const isAskingForOpinion = intent === 'discussion';
    const isAskingForReview = intent === 'review';
    
    // Different comment types for variety
    const commentTypes = [
      'share_experience',
      'add_value',
      'agree_and_expand',
      'ask_followup',
      'provide_tip',
      'relate_personally'
    ];
    const commentType = commentTypes[Math.floor(Math.random() * commentTypes.length)];
    
    let content = '';
    
    if (tone === 'casual') {
      switch (commentType) {
        case 'share_experience':
          if (isComparison) {
            // Handle comparison comments properly
            if (comparisonItem1 && comparisonItem2) {
              content = `I've used both ${comparisonItem1} and ${comparisonItem2}. `;
              if (expertise) {
                content += `I'm in ${expertise}, `;
              }
              const usedMore = Math.random() > 0.5 ? comparisonItem1 : comparisonItem2;
              content += `and I've spent more time with ${usedMore}. `;
              content += `It's been working really well for my workflow. `;
              content += `The other one was fine, but ${usedMore} just clicked better for me. `;
              content += `What are you hoping to use it for?`;
            } else {
              content = `I've tried both options. `;
              if (expertise) {
                content += `In ${expertise}, `;
              }
              content += `they're both solid choices. `;
              content += `The main difference for me was the learning curve and how well it fit my existing workflow. `;
              content += `What's your main use case?`;
            }
          } else if (isToolOrProduct && isAskingForRecommendation) {
            content = `I've been using ${keyTerms} for about 6 months now. `;
            if (expertise) {
              content += `I'm in ${expertise}, `;
            }
            content += `and it's been working really well for my needs. `;
            content += `The learning curve wasn't too steep, which was a plus. `;
            content += `What are you hoping to use it for?`;
          } else if (isHowToQuestion) {
            content = `I've been doing ${keyTerms} for a while now. `;
            if (expertise) {
              content += `In ${expertise}, `;
            }
            content += `the key is finding a workflow that works for you. `;
            content += `I've found that starting with the basics and building from there helps a lot. `;
            content += `What's your current process like?`;
          } else {
            content = `I've had experience with ${keyTerms}. `;
            if (expertise) {
              content += `From a ${expertise} perspective, `;
            }
            content += `it's been pretty solid overall. `;
            content += `Happy to share more details if you have specific questions.`;
          }
          break;
        case 'add_value':
          if (isComparison) {
            // Handle comparison comments properly
            if (comparisonItem1 && comparisonItem2) {
              content = `I've tried both ${comparisonItem1} and ${comparisonItem2}. `;
              if (expertise) {
                content += `In ${expertise}, `;
              }
              const preferred = Math.random() > 0.5 ? comparisonItem1 : comparisonItem2;
              const other = preferred === comparisonItem1 ? comparisonItem2 : comparisonItem1;
              content += `I ended up going with ${preferred} because `;
              const reasons = [
                `it fit my workflow better`,
                `the interface was more intuitive`,
                `it had better integration options`,
                `it was faster for my use case`,
                `the learning curve was gentler`
              ];
              content += reasons[Math.floor(Math.random() * reasons.length)] + `. `;
              content += `${other} was solid too, but ${preferred} just worked better for me. `;
              content += `What are you planning to use it for?`;
            } else {
              content = `I've tried both options you mentioned. `;
              if (expertise) {
                content += `From a ${expertise} perspective, `;
              }
              content += `they each have their strengths. `;
              content += `What's your main use case? That might help narrow it down.`;
            }
          } else if (isToolOrProduct && isAskingForRecommendation) {
            content = `I'd definitely recommend checking out ${keyTerms}. `;
            if (expertise) {
              content += `I work in ${expertise} and `;
            }
            content += `it's saved me a ton of time. `;
            content += `The main thing I like is how straightforward it is to get started. `;
            content += `What's your main use case?`;
          } else if (isHowToQuestion) {
            content = `For ${keyTerms}, `;
            if (expertise) {
              content += `I've found that in ${expertise}, `;
            }
            content += `the best approach is to start with templates or examples. `;
            content += `That way you can see what works and adapt it to your needs. `;
            content += `Have you tried that approach?`;
          } else {
            content = `Good question! `;
            if (expertise) {
              content += `In ${expertise}, `;
            }
            content += `I've found ${keyTerms} to be really useful. `;
            content += `The key is finding the right approach for your workflow.`;
          }
          break;
        case 'agree_and_expand':
          if (isToolOrProduct) {
            content = `Yeah, ${keyTerms} is worth looking into. `;
            if (expertise) {
              content += `I've been using it for ${expertise} work and `;
            }
            content += `it's made things a lot easier. `;
            const aspects = ['automation features', 'user interface', 'integration options', 'customization', 'speed'];
            const aspect = aspects[Math.floor(Math.random() * aspects.length)];
            content += `The best part is probably how it handles ${aspect}. `;
            content += `Have you tried it yet or still researching?`;
          } else if (isHowToQuestion) {
            content = `Yeah, ${keyTerms} is definitely doable. `;
            if (expertise) {
              content += `I do this regularly in ${expertise} and `;
            }
            content += `there are a few tricks that help. `;
            content += `The main thing is to set up a good workflow from the start. `;
            content += `What's your current setup?`;
          } else {
            content = `I agree this is worth exploring. `;
            if (expertise) {
              content += `In ${expertise}, `;
            }
            content += `${keyTerms} can be really helpful. `;
            content += `What are you hoping to accomplish?`;
          }
          break;
        case 'ask_followup':
          if (isHowToQuestion) {
            content = `What's your current process for ${keyTerms}? `;
            if (expertise) {
              content += `I'm in ${expertise} and `;
            }
            content += `might be able to suggest some improvements based on what you're already doing.`;
          } else {
            content = `What are you trying to accomplish with ${keyTerms}? `;
            if (expertise) {
              content += `I'm in ${expertise} and `;
            }
            content += `might be able to give you more targeted advice based on your specific needs.`;
          }
          break;
        case 'provide_tip':
          if (isHowToQuestion) {
            content = `For ${keyTerms}, `;
            if (expertise) {
              content += `in ${expertise} I've found that `;
            }
            content += `using templates or shortcuts helps a lot. `;
            content += `Start with the basics and then build up your workflow from there. `;
            content += `That's what worked for me!`;
          } else if (isToolOrProduct) {
            content = `My advice: start with a trial or free version of ${keyTerms} if they offer one. `;
            if (expertise) {
              content += `That's what I did when I was working on ${expertise} projects, `;
            }
            content += `and it helped me figure out if it was the right fit before committing. `;
            content += `Worth checking out!`;
          } else {
            content = `One thing that's helped me: `;
            if (expertise) {
              content += `in ${expertise}, `;
            }
            content += `I focus on ${keyTerms} by breaking it down into smaller steps. `;
            content += `Makes it much more manageable.`;
          }
          break;
        default: // relate_personally
          if (isHowToQuestion) {
            content = `I was trying to figure out ${keyTerms} not too long ago! `;
            if (expertise) {
              content += `Working in ${expertise}, `;
            }
            content += `I found that the key is to start simple and iterate. `;
            content += `What's your current approach?`;
          } else if (isToolOrProduct) {
            content = `I was in the same boat a few months ago! `;
            if (expertise) {
              content += `Working in ${expertise}, `;
            }
            content += `I ended up going with ${keyTerms} and it's been great. `;
            content += `What made you start looking into this?`;
          } else {
            content = `I've been working on ${keyTerms} for a while. `;
            if (expertise) {
              content += `In ${expertise}, `;
            }
            content += `it's been really helpful for my workflow. `;
            content += `What are you hoping to achieve?`;
          }
      }
    } else if (tone === 'professional') {
      switch (commentType) {
        case 'share_experience':
          if (isToolOrProduct && isAskingForRecommendation) {
            content = `We've been using ${keyTerms} for the past year. `;
            if (expertise) {
              content += `Our team works in ${expertise}, `;
            }
            content += `and it's been effective for our use cases. `;
            content += `The ROI has been solid, especially in terms of time saved. `;
            content += `What's your primary objective with this?`;
          } else if (isHowToQuestion) {
            content = `We've been implementing ${keyTerms} in our workflow. `;
            if (expertise) {
              content += `In ${expertise}, `;
            }
            content += `the key has been establishing clear processes from the start. `;
            content += `It's made a significant difference in our efficiency. `;
            content += `What's your current approach?`;
          } else {
            content = `I've had good results with ${keyTerms}. `;
            if (expertise) {
              content += `In ${expertise}, `;
            }
            content += `it addresses the key pain points we were facing. `;
            content += `Happy to discuss specifics if helpful.`;
          }
          break;
        case 'add_value':
          if (isToolOrProduct && isAskingForRecommendation) {
            content = `I'd recommend ${keyTerms} based on my experience. `;
            if (expertise) {
              content += `In ${expertise}, `;
            }
            content += `it's proven to be reliable and efficient. `;
            content += `The implementation was straightforward, which was important for us. `;
            content += `What are your main requirements?`;
          } else if (isHowToQuestion) {
            content = `For ${keyTerms}, `;
            if (expertise) {
              content += `in ${expertise} I've found that `;
            }
            content += `establishing a systematic approach works best. `;
            content += `Start with the core process and then optimize from there. `;
            content += `Have you mapped out your current workflow?`;
          } else {
            content = `This is worth exploring. `;
            if (expertise) {
              content += `From a ${expertise} standpoint, `;
            }
            content += `${keyTerms} can be quite valuable. `;
            content += `The key is ensuring it aligns with your workflow.`;
          }
          break;
        case 'agree_and_expand':
          if (isToolOrProduct) {
            content = `I agree that ${keyTerms} is worth considering. `;
            if (expertise) {
              content += `We've implemented it in ${expertise} contexts and `;
            }
            content += `seen positive results. `;
            const professionalAspects = ['integration capabilities', 'scalability', 'user experience', 'reporting features', 'security'];
            const aspect = professionalAspects[Math.floor(Math.random() * professionalAspects.length)];
            content += `The ${aspect} have been particularly strong. `;
            content += `Are you evaluating multiple options or focused on this one?`;
          } else if (isHowToQuestion) {
            content = `I agree that ${keyTerms} is achievable. `;
            if (expertise) {
              content += `In ${expertise}, `;
            }
            content += `we've found that having a structured approach helps significantly. `;
            content += `The key is consistency and iteration. `;
            content += `What challenges are you facing?`;
          } else {
            content = `I agree this is worth exploring. `;
            if (expertise) {
              content += `In ${expertise}, `;
            }
            content += `${keyTerms} can be quite valuable. `;
            content += `What are your main goals?`;
          }
          break;
        case 'ask_followup':
          content = `To provide more relevant guidance: `;
          if (expertise) {
            content += `what's your experience level with ${expertise}? `;
          }
          content += `Understanding your context would help me give better recommendations for ${keyTerms}.`;
          break;
        case 'provide_tip':
          content = `My recommendation: start with a proof of concept for ${keyTerms}. `;
          if (expertise) {
            content += `That's what we did in ${expertise}, `;
          }
          content += `and it helped us validate the fit before committing fully. `;
          content += `It's a low-risk way to evaluate.`;
          break;
        default: // relate_personally
          content = `We faced a similar decision recently. `;
          if (expertise) {
            content += `In our ${expertise} work, `;
          }
          content += `we ended up choosing ${keyTerms} and it's worked well. `;
          content += `What's driving your interest in this?`;
      }
    } else if (tone === 'technical') {
      switch (commentType) {
        case 'share_experience':
          content = `I've been working with ${keyTerms} for a bit. `;
          if (expertise) {
            content += `From a ${expertise} standpoint, `;
          }
          content += `the technical implementation is pretty straightforward once you understand the architecture. `;
          content += `Are you looking at any specific technical requirements?`;
          break;
        case 'add_value':
          content = `Good question. `;
          if (expertise) {
            content += `In ${expertise}, `;
          }
          content += `there are a few technical considerations with ${keyTerms} worth noting. `;
          content += `The main ones are performance, scalability, and integration points.`;
          break;
        case 'agree_and_expand':
          content = `This aligns with what I've seen. `;
          if (expertise) {
            content += `Technically speaking, in ${expertise}, `;
          }
          content += `${keyTerms} works well when you have the right infrastructure. `;
          content += `What's your current setup looking like?`;
          break;
        case 'ask_followup':
          content = `To dive deeper: `;
          if (expertise) {
            content += `what's your experience level with ${expertise}? `;
          }
          content += `That would help me tailor the technical advice for ${keyTerms}.`;
          break;
        case 'provide_tip':
          content = `Technical tip: `;
          if (expertise) {
            content += `if you're working with ${expertise}, `;
          }
          content += `make sure to consider the API limitations and rate limits for ${keyTerms}. `;
          content += `That's caught me off guard before.`;
          break;
        default: // relate_personally
          content = `I've debugged similar issues. `;
          if (expertise) {
            content += `In ${expertise}, `;
          }
          content += `the problem with ${keyTerms} often comes down to configuration. `;
          content += `What environment are you running this in?`;
      }
    } else if (tone === 'friendly') {
      switch (commentType) {
        case 'share_experience':
          content = `Hey! I've been using ${keyTerms} and it's been great so far. `;
          if (expertise) {
            content += `I'm in ${expertise}, `;
          }
          content += `so if that's relevant to you, happy to share what's worked! `;
          content += `What are you hoping to get out of it?`;
          break;
        case 'add_value':
          content = `Love that you're asking about ${keyTerms}! `;
          if (expertise) {
            content += `I work with ${expertise} and `;
          }
          content += `I think it could be a good fit depending on your needs. `;
          content += `What specific features are you looking for in ${keyTerms}?`;
          break;
        case 'agree_and_expand':
          content = `Yes! This is exactly what I was thinking. `;
          if (expertise) {
            content += `From my ${expertise} perspective, `;
          }
          content += `${keyTerms} has been a game changer. `;
          content += `Have you tried it yet, or still researching?`;
          break;
        case 'ask_followup':
          content = `Ooh, good question! `;
          if (expertise) {
            content += `Are you working in ${expertise}? `;
          }
          content += `That would help me give you better advice about ${keyTerms}. `;
          content += `What's your main use case?`;
          break;
        case 'provide_tip':
          content = `Quick heads up: `;
          if (expertise) {
            content += `if you're in ${expertise}, `;
          }
          content += `I'd suggest starting with the basics of ${keyTerms} and building from there. `;
          content += `That's what worked for me!`;
          break;
        default: // relate_personally
          content = `I was asking the same thing a few months ago! `;
          if (expertise) {
            content += `Coming from ${expertise}, `;
          }
          content += `I found that ${keyTerms} really depends on what you're trying to accomplish. `;
          content += `What's your situation?`;
      }
    } else { // humorous
      switch (commentType) {
        case 'share_experience':
          content = `Oh man, I've been down this rabbit hole! `;
          if (expertise) {
            content += `As someone who's dealt with ${expertise}, `;
          }
          content += `I can tell you ${keyTerms} is... interesting. `;
          content += `It's great until it isn't, you know? 😅`;
          break;
        case 'add_value':
          content = `Haha, I feel this. `;
          if (expertise) {
            content += `In the world of ${expertise}, `;
          }
          content += `${keyTerms} is one of those things that sounds simple but gets complicated fast. `;
          content += `What's your experience been so far?`;
          break;
        case 'agree_and_expand':
          content = `100% agree, but also... `;
          if (expertise) {
            content += `as someone in ${expertise}, `;
          }
          content += `I have THOUGHTS about ${keyTerms}. `;
          content += `Want to hear my hot take? 😄`;
          break;
        case 'ask_followup':
          content = `Okay but real talk: `;
          if (expertise) {
            content += `are you in ${expertise}? `;
          }
          content += `Because that changes my entire answer about ${keyTerms}. `;
          content += `The struggle is real either way though!`;
          break;
        case 'provide_tip':
          content = `Pro tip (learned the hard way): `;
          if (expertise) {
            content += `if you're dealing with ${expertise}, `;
          }
          content += `don't go all-in on ${keyTerms} right away. `;
          content += `Start small, make mistakes, then scale. Trust me on this one!`;
          break;
        default: // relate_personally
          content = `Are you me from 6 months ago? `;
          if (expertise) {
            content += `I was doing ${expertise} and `;
          }
          content += `had the exact same question about ${keyTerms}. `;
          content += `Here's what I wish I knew then...`;
      }
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
   * Check if key terms refer to a tool/product vs a question
   */
  private isToolOrProduct(keyTerms: string): boolean {
    const lower = keyTerms.toLowerCase();
    // If it starts with "how to", "how do", "what is", etc., it's a question
    if (lower.startsWith('how to') || lower.startsWith('how do') || 
        lower.startsWith('what is') || lower.startsWith('what are') ||
        lower.startsWith('why') || lower.startsWith('when') || lower.startsWith('where')) {
      return false;
    }
    // If it contains "tool", "software", "app", "platform", "service", it's likely a product
    if (lower.includes('tool') || lower.includes('software') || lower.includes('app') ||
        lower.includes('platform') || lower.includes('service') || lower.includes('alternative')) {
      return true;
    }
    // Short phrases (1-3 words) are more likely to be product names
    const wordCount = keyTerms.split(' ').length;
    return wordCount <= 3;
  }

  /**
   * Extract actual topic from post title by removing question words
   */
  private extractTopicFromTitle(title: string): string {
    // Common question/prefix words to remove
    const questionWords = [
      'has', 'anyone', 'tried', 'looking', 'for', 'advice', 'question', 'about',
      'thoughts', 'on', 'need', 'review', 'best', 'practices', 'insights',
      'what', 'are', 'your', 'experience', 'been', 'like', 'tips', 'things',
      'watch', 'out', 'thanks', 'advance', 'discuss', 'with', 'this', 'community',
      'working', 'understand', 'how', 'others', 'approach', 'topic', 'strategies',
      'solutions', 'worked', 'well', 'you', 'curious', 'interested', 'in'
    ];
    
    // Split title into words and filter out question words
    const words = title.toLowerCase()
      .replace(/[?.,!:-]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 0 && !questionWords.includes(word));
    
    // Take the meaningful words (usually 3-5 words)
    const topicWords = words.slice(0, 5);
    
    // If we got nothing meaningful, fall back to a simpler extraction
    if (topicWords.length === 0) {
      // Try to find words after common patterns
      const patterns = [
        /(?:has anyone tried|looking for|question about|thoughts on|need advice|review:)\s+(.+?)(?:\?|$)/i,
        /(?:best|tools?|alternatives?|how to|ways to)\s+(.+?)(?:\?|$)/i,
      ];
      
      for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
          const extracted = match[1].trim().split(/\s+/).slice(0, 5).join(' ');
          if (extracted.length > 0) {
            return extracted;
          }
        }
      }
      
      // Last resort: take words 3-7 (skip first few question words)
      return title.split(/\s+/).slice(2, 7).join(' ') || 'this';
    }
    
    return topicWords.join(' ') || 'this';
  }

  /**
   * Calculate quality score for the generated calendar
   * 
   * Evaluates:
   * - Subreddit posting limits (avoiding overposting)
   * - Persona variety and distribution
   * - Topic diversity
   * - Comment-to-post ratio (natural conversation flow)
   * - Time distribution across the week
   * 
   * Score range: 0-10
   * - 9-10: Excellent (well-distributed, natural, diverse)
   * - 7-8: Good (minor issues)
   * - 5-6: Fair (some problems)
   * - 0-4: Poor (significant issues)
   */
  private calculateQualityScore(posts: CalendarPost[]): number {
    let score = 5.0; // Start at base score, earn points for quality
    
    const originalPosts = posts.filter(p => p.post_type === 'original');
    const comments = posts.filter(p => p.post_type === 'comment');
    
    if (originalPosts.length === 0) {
      return 0; // No posts = no quality
    }
    
    // 1. SUBREDDIT POSTING LIMITS (max +2 points, -1.5 per violation)
    let subredditScore = 2.0;
    const subredditCounts: Map<string, number> = new Map();
    originalPosts.forEach(post => {
      const count = subredditCounts.get(post.subreddit_id) || 0;
      subredditCounts.set(post.subreddit_id, count + 1);
    });
    
    let overpostingViolations = 0;
    subredditCounts.forEach((count, subredditId) => {
      const subreddit = this.input.subreddits.find(s => 
        (s.id || s.name) === subredditId
      );
      const limit = subreddit?.post_frequency_limit || 2;
      if (count > limit) {
        overpostingViolations++;
        subredditScore -= 1.5; // Penalty per violation
      }
    });
    
    // Bonus if no violations
    if (overpostingViolations === 0) {
      subredditScore = 2.0;
    }
    score += Math.max(0, subredditScore);
    
    // 2. PERSONA VARIETY (max +1.5 points)
    const personaCounts: Map<string, number> = new Map();
    posts.forEach(post => {
      const count = personaCounts.get(post.persona_id) || 0;
      personaCounts.set(post.persona_id, count + 1);
    });
    
    const personaValues = Array.from(personaCounts.values());
    const maxPersonaPosts = Math.max(...personaValues);
    const minPersonaPosts = Math.min(...personaValues);
    const personaSpread = maxPersonaPosts - minPersonaPosts;
    const uniquePersonas = personaCounts.size;
    
    let personaScore = 0;
    if (personaSpread <= 1) {
      personaScore = 1.5; // Excellent distribution
    } else if (personaSpread <= 2) {
      personaScore = 1.0; // Good distribution
    } else if (personaSpread <= 3) {
      personaScore = 0.5; // Fair distribution
    }
    // Bonus for using multiple personas
    if (uniquePersonas >= 3) {
      personaScore += 0.3;
    }
    score += Math.min(1.5, personaScore);
    
    // 3. TOPIC DIVERSITY (max +1.5 points)
    const uniqueTopics = new Set(
      originalPosts.map(p => p.title.toLowerCase().trim())
    );
    const topicDiversityRatio = uniqueTopics.size / originalPosts.length;
    
    let topicScore = 0;
    if (topicDiversityRatio >= 0.9) {
      topicScore = 1.5; // Excellent diversity (all unique)
    } else if (topicDiversityRatio >= 0.7) {
      topicScore = 1.0; // Good diversity
    } else if (topicDiversityRatio >= 0.5) {
      topicScore = 0.5; // Fair diversity
    }
    score += topicScore;
    
    // 4. COMMENT-TO-POST RATIO (max +1.5 points)
    // Ideal: 0.8-1.2 comments per post (natural conversation)
    const commentRatio = comments.length / originalPosts.length;
    
    let commentScore = 0;
    if (commentRatio >= 0.8 && commentRatio <= 1.2) {
      commentScore = 1.5; // Perfect ratio
    } else if (commentRatio >= 0.6 && commentRatio <= 1.5) {
      commentScore = 1.0; // Good ratio
    } else if (commentRatio >= 0.4 && commentRatio <= 2.0) {
      commentScore = 0.5; // Acceptable ratio
    } else if (commentRatio < 0.3) {
      commentScore = -0.5; // Too few comments
    } else {
      commentScore = -0.5; // Too many comments (looks artificial)
    }
    score += commentScore;
    
    // 5. TIME DISTRIBUTION (max +1.0 points)
    const timeSlots: Set<string> = new Set();
    posts.forEach(post => {
      timeSlots.add(`${post.scheduled_date}-${post.scheduled_time.substring(0, 2)}`);
    });
    
    const timeSpread = timeSlots.size / posts.length;
    let timeScore = 0;
    if (timeSpread >= 0.7) {
      timeScore = 1.0; // Excellent distribution
    } else if (timeSpread >= 0.5) {
      timeScore = 0.5; // Good distribution
    } else if (timeSpread < 0.3) {
      timeScore = -0.5; // Too clustered
    }
    score += timeScore;
    
    // Ensure score is between 0 and 10, round to 1 decimal
    return Math.round(Math.max(0, Math.min(10, score)) * 10) / 10;
  }
}

