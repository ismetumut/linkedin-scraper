class DelayManager {
  private readonly MIN_DELAY = 2000 // 2 seconds
  private readonly MAX_DELAY = 10000 // 10 seconds
  private readonly TYPING_DELAY_MIN = 50
  private readonly TYPING_DELAY_MAX = 150
  private readonly MOUSE_DELAY_MIN = 100
  private readonly MOUSE_DELAY_MAX = 300

  // Human-like delay between major actions
  async randomDelay(): Promise<void> {
    const delay = this.getRandomDelay(this.MIN_DELAY, this.MAX_DELAY)
    console.log(`⏱️ Waiting ${delay}ms to mimic human behavior...`)
    await this.sleep(delay)
  }

  // Shorter delay for typing simulation
  async typingDelay(): Promise<void> {
    const delay = this.getRandomDelay(this.TYPING_DELAY_MIN, this.TYPING_DELAY_MAX)
    await this.sleep(delay)
  }

  // Custom delay with jitter
  async customDelay(baseDelay: number, jitterPercent = 20): Promise<void> {
    const jitter = baseDelay * (jitterPercent / 100)
    const delay = this.getRandomDelay(baseDelay - jitter, baseDelay + jitter)
    await this.sleep(delay)
  }

  // Exponential backoff for retries
  async exponentialBackoff(attempt: number, baseDelay = 1000): Promise<void> {
    const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
    console.log(`🔄 Exponential backoff: waiting ${Math.round(delay)}ms (attempt ${attempt + 1})`)
    await this.sleep(delay)
  }

  private getRandomDelay(min: number, max: number): number {
    // Use normal distribution for more human-like timing
    const u1 = Math.random()
    const u2 = Math.random()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)

    // Convert to range and ensure it's within bounds
    const normalized = (z0 + 3) / 6 // Normalize to 0-1 range
    const delay = min + (max - min) * Math.max(0, Math.min(1, normalized))

    return Math.round(delay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Simulate human reading time based on content length
  getReadingDelay(contentLength: number): number {
    // Average reading speed: 200-300 words per minute
    const wordsPerMinute = 250
    const averageWordLength = 5
    const estimatedWords = contentLength / averageWordLength
    const readingTimeMs = (estimatedWords / wordsPerMinute) * 60 * 1000

    // Add some randomness and minimum delay
    const minDelay = 1000
    const maxDelay = Math.max(minDelay, readingTimeMs * 2)

    return this.getRandomDelay(minDelay, maxDelay)
  }
}

export const delayManager = new DelayManager()
