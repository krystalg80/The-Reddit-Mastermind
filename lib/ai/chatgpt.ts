import OpenAI from 'openai';

// Initialize OpenAI client only if API key is available
let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} else {
  console.warn('OPENAI_API_KEY not found in environment variables. ChatGPT features will use template fallbacks.');
}

/**
 * Generate Reddit post title using ChatGPT
 */
export async function generatePostTitle(
  topic: string,
  intent: string,
  personaTone: string,
  subredditName: string
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }
  
  try {
    const prompt = `Generate a natural, engaging Reddit post title for r/${subredditName}. 

Topic: ${topic}
Intent: ${intent}
Persona tone: ${personaTone}

Requirements:
- Sound natural and authentic (like a real Reddit user)
- Match the ${personaTone} tone
- Be engaging and encourage discussion
- Keep it under 100 characters
- Don't be overly promotional

Just return the title, nothing else.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an expert at writing engaging Reddit post titles that feel authentic and natural.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 50,
      temperature: 0.8,
    });

    const title = completion.choices[0]?.message?.content?.trim() || '';
    // Remove quotes if ChatGPT adds them
    return title.replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Error generating post title with ChatGPT:', error);
    throw error;
  }
}

/**
 * Generate Reddit post content using ChatGPT
 */
export async function generatePostContent(
  topic: string,
  intent: string,
  personaTone: string,
  personaBio: string,
  expertiseAreas: string[],
  subredditName: string
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }
  
  try {
    const expertise = expertiseAreas.length > 0 ? expertiseAreas.join(', ') : 'general';
    
    const prompt = `Write a natural, engaging Reddit post for r/${subredditName} about "${topic}".

Persona context:
- Tone: ${personaTone}
- Bio: ${personaBio}
- Expertise: ${expertise}
- Intent: ${intent}

Requirements:
- Sound authentic and natural (like a real Reddit user wrote this)
- Match the ${personaTone} tone throughout
- Be conversational and engaging
- Ask questions to encourage discussion
- Don't be overly promotional or salesy
- Keep it 2-4 short paragraphs
- End with a question or call for discussion

Write the post content:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an expert at writing authentic Reddit posts that feel natural and encourage genuine discussion.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.8,
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Error generating post content with ChatGPT:', error);
    throw error;
  }
}

/**
 * Generate Reddit comment using ChatGPT
 */
export async function generateComment(
  originalPostTitle: string,
  originalPostContent: string,
  topic: string,
  intent: string,
  commenterTone: string,
  commenterBio: string,
  expertiseAreas: string[],
  commentType: 'share_experience' | 'add_value' | 'agree_and_expand' | 'ask_followup' | 'provide_tip' | 'relate_personally'
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }
  
  try {
    const expertise = expertiseAreas.length > 0 ? expertiseAreas.join(', ') : 'general';
    
    const commentTypeInstructions = {
      share_experience: 'Share your personal experience with the topic in a helpful way',
      add_value: 'Add valuable information or insights to the discussion',
      agree_and_expand: 'Agree with the post and expand on the topic with your own perspective',
      ask_followup: 'Ask a thoughtful follow-up question to continue the conversation',
      provide_tip: 'Provide a helpful tip or recommendation',
      relate_personally: 'Relate to the post personally and share your own similar experience'
    };

    const prompt = `Write a natural Reddit comment responding to this post:

Title: ${originalPostTitle}
Content: ${originalPostContent}

Your comment should:
- Comment type: ${commentTypeInstructions[commentType]}
- Topic: ${topic}
- Your tone: ${commenterTone}
- Your background: ${commenterBio}
- Your expertise: ${expertise}
- Sound authentic and natural (like a real Reddit user)
- Match the ${commenterTone} tone
- Be helpful and engaging
- Reference the topic naturally
- Keep it 1-2 short paragraphs
- Don't be overly promotional

Write the comment:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an expert at writing authentic Reddit comments that feel natural and add value to discussions.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.8,
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Error generating comment with ChatGPT:', error);
    throw error;
  }
}

