/**
 * Rate limiter for OpenAI API calls
 * Respects 3 RPM (requests per minute) limit for free tier
 * Adds 20 second delay between requests to stay within limits
 */

class RateLimiter {
  private lastCallTime: number = 0;
  private readonly minDelayMs: number = 20000; // 20 seconds = 3 requests per minute

  async waitForNextCall(): Promise<void> {
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

