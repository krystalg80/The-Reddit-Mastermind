/**
 * Rate limiter for OpenAI API calls
 * Respects 3 RPM (requests per minute) limit for free tier
 * Adds 20 second delay between requests to stay within limits
 * 
 * Note: In production with paid OpenAI tier, this delay is unnecessary
 * as paid tiers have much higher rate limits (60+ RPM)
 */

class RateLimiter {
  private lastCallTime: number = 0;
  private readonly minDelayMs: number = 20000; // 20 seconds = 3 requests per minute (free tier)
  
  // Check if we're on free tier (can be made configurable)
  private readonly isFreeTier: boolean = true; // Set to false if you upgrade to paid tier

  async waitForNextCall(): Promise<void> {
    // Rate limiting disabled for faster demo experience
    // Note: This may hit free tier limits, but provides better UX for client demos
    return;
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

