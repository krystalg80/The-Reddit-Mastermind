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
    // Skip rate limiting if not on free tier (paid tiers have higher limits)
    if (!this.isFreeTier) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < this.minDelayMs) {
      const waitTime = this.minDelayMs - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCallTime = Date.now();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

