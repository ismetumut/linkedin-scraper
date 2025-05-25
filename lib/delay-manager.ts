type DelayType = "human" | "typing" | "mouse" | "custom" | "read"

interface DelayConfig {
  min: number
  max: number
}

class DelayManager {
  private readonly config: Record<DelayType, DelayConfig> = {
    human: { min: 2000, max: 10000 },
    typing: { min: 50, max: 150 },
    mouse: { min: 100, max: 300 },
    custom: { min: 100, max: 1000 },
    read: { min: 1000, max: 5000 },
  }

  async wait(type: DelayType = "human", baseDelay?: number, jitterPercent: number = 20): Promise<void> {
    let min = this.config[type].min
    let max = this.config[type].max

    if (type === "custom" && baseDelay) {
      const jitter = baseDelay * (jitterPercent / 100)
      min = baseDelay - jitter
      max = baseDelay + jitter
    }

    const delay = this.getNormalRandomDelay(min, max)
    // console.log(`[DELAY] Waiting ${delay}ms (${type})`)
    await this.sleep(delay)
  }

  // Human-like typing delay
  async typing(): Promise<void> {
    return this.wait("typing")
  }

  // Mouse event delay
  async mouse(): Promise<void> {
    return this.wait("mouse")
  }

  // Custom delay with optional jitter
  async custom(baseDelay: number, jitterPercent = 20): Promise<void> {
    return this.wait("custom", baseDelay, jitterPercent)
  }

  // Reading delay (based on text length)
  async reading(contentLength: number): Promise<void> {
    const words = Math.max(1, contentLength / 5)
    const ms = (words / 250) * 60 * 1000
    const min = this.config.read.min
    const max = Math.max(this.config.read.max, ms * 2)
    const delay = this.getNormalRandomDelay(min, max)
    await this.sleep(delay)
  }

  // Exponential backoff delay for retries
  async backoff(attempt: number, baseDelay = 1000): Promise<void> {
    const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
    // console.log(`[BACKOFF] Waiting ${Math.round(delay)}ms (attempt ${attempt + 1})`)
    await this.sleep(Math.round(delay))
  }

  // --- Utilities ---

  private getNormalRandomDelay(min: number, max: number): number {
    // Normal distribution with central tendency
    let u = 0, v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
    z = (z + 3) / 6 // Normalize to 0-1
    const bounded = Math.max(0, Math.min(1, z))
    const delay = min + (max - min) * bounded
    return Math.round(delay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // İstersen delay süresini elde etmek için (async beklemeden)
  getDelay(type: DelayType = "human", baseDelay?: number, jitterPercent: number = 20): number {
    let min = this.config[type].min
    let max = this.config[type].max
    if (type === "custom" && baseDelay) {
      const jitter = baseDelay * (jitterPercent / 100)
      min = baseDelay - jitter
      max = baseDelay + jitter
    }
    return this.getNormalRandomDelay(min, max)
  }
}

export const delayManager = new DelayManager()
