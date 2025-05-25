import type { Page } from "playwright"

interface FingerprintConfig {
  userAgent: string
  viewport: { width: number; height: number }
  platform: string
  acceptLanguage: string
  timezone: string
  webglVendor: string
  webglRenderer: string
  hardwareConcurrency: number
  deviceMemory: number
  colorDepth: number
  pixelRatio: number
}

class FingerprintResistance {
  async applyFingerprint(page: Page, config: FingerprintConfig): Promise<void> {
    console.log("🎭 Applying browser fingerprint resistance...")

    // Override navigator properties
    await page.addInitScript((config) => {
      // Override user agent
      Object.defineProperty(navigator, "userAgent", {
        get: () => config.userAgent,
      })

      // Override platform
      Object.defineProperty(navigator, "platform", {
        get: () => config.platform,
      })

      // Override hardware concurrency
      Object.defineProperty(navigator, "hardwareConcurrency", {
        get: () => config.hardwareConcurrency,
      })

      // Override device memory
      Object.defineProperty(navigator, "deviceMemory", {
        get: () => config.deviceMemory,
      })

      // Override languages
      Object.defineProperty(navigator, "languages", {
        get: () => config.acceptLanguage.split(",").map((lang) => lang.split(";")[0].trim()),
      })

      // Override WebGL fingerprinting
      const getParameter = WebGLRenderingContext.prototype.getParameter
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445) {
          // UNMASKED_VENDOR_WEBGL
          return config.webglVendor
        }
        if (parameter === 37446) {
          // UNMASKED_RENDERER_WEBGL
          return config.webglRenderer
        }
        return getParameter.call(this, parameter)
      }

      // Override screen properties
      Object.defineProperty(screen, "width", {
        get: () => config.viewport.width,
      })
      Object.defineProperty(screen, "height", {
        get: () => config.viewport.height,
      })
      Object.defineProperty(screen, "colorDepth", {
        get: () => config.colorDepth,
      })

      // Override pixel ratio
      Object.defineProperty(window, "devicePixelRatio", {
        get: () => config.pixelRatio,
      })

      // Override timezone
      const originalDateTimeFormat = Intl.DateTimeFormat
      Intl.DateTimeFormat = (...args) => {
        if (args.length === 0 || (args[0] === undefined && args[1] === undefined)) {
          args[1] = { ...args[1], timeZone: config.timezone }
        }
        return new originalDateTimeFormat(...args)
      }

      // Override canvas fingerprinting
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        // Add slight noise to canvas data
        const context = this.getContext("2d")
        if (context) {
          const imageData = context.getImageData(0, 0, this.width, this.height)
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] += Math.floor(Math.random() * 3) - 1 // Red
            imageData.data[i + 1] += Math.floor(Math.random() * 3) - 1 // Green
            imageData.data[i + 2] += Math.floor(Math.random() * 3) - 1 // Blue
          }
          context.putImageData(imageData, 0, 0)
        }
        return originalToDataURL.apply(this, args)
      }

      // Override audio context fingerprinting
      const originalCreateAnalyser = AudioContext.prototype.createAnalyser
      AudioContext.prototype.createAnalyser = function () {
        const analyser = originalCreateAnalyser.call(this)
        const originalGetFloatFrequencyData = analyser.getFloatFrequencyData
        analyser.getFloatFrequencyData = function (array) {
          originalGetFloatFrequencyData.call(this, array)
          // Add noise to audio fingerprint
          for (let i = 0; i < array.length; i++) {
            array[i] += Math.random() * 0.0001
          }
        }
        return analyser
      }

      // Override font fingerprinting
      const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")
      const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")

      Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        get: function () {
          const width = originalOffsetWidth.get.call(this)
          return width + (Math.random() - 0.5) * 0.1
        },
      })

      Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        get: function () {
          const height = originalOffsetHeight.get.call(this)
          return height + (Math.random() - 0.5) * 0.1
        },
      })

      // Override performance fingerprinting
      const originalNow = Performance.prototype.now
      Performance.prototype.now = function () {
        return originalNow.call(this) + Math.random() * 0.1
      }

      // Override battery API
      if (navigator.getBattery) {
        navigator.getBattery = () =>
          Promise.resolve({
            charging: true,
            chargingTime: Number.POSITIVE_INFINITY,
            dischargingTime: Number.POSITIVE_INFINITY,
            level: 1,
          })
      }

      // Override permissions API
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query
        navigator.permissions.query = (params) => {
          return Promise.resolve({ state: "prompt" })
        }
      }
    }, config)

    // Set additional headers to mimic real browser
    await page.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": config.acceptLanguage,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": `"${config.platform}"`,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    })

    console.log("✅ Browser fingerprint resistance applied")
  }

  async simulateHumanBehavior(page: Page): Promise<void> {
    console.log("🤖 Simulating human behavior...")

    // Random mouse movements
    await this.randomMouseMovement(page)

    // Random scrolling
    await this.randomScrolling(page)

    // Random focus events
    await this.randomFocusEvents(page)
  }

  private async randomMouseMovement(page: Page): Promise<void> {
    const viewport = page.viewportSize()
    if (!viewport) return

    for (let i = 0; i < 3; i++) {
      const x = Math.random() * viewport.width
      const y = Math.random() * viewport.height

      await page.mouse.move(x, y, { steps: 10 })
      await page.waitForTimeout(100 + Math.random() * 200)
    }
  }

  private async randomScrolling(page: Page): Promise<void> {
    const scrollAmount = Math.random() * 500 + 100
    await page.evaluate((amount) => {
      window.scrollBy(0, amount)
    }, scrollAmount)

    await page.waitForTimeout(500 + Math.random() * 1000)
  }

  private async randomFocusEvents(page: Page): Promise<void> {
    // Simulate tab focus/blur
    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"))
      setTimeout(() => {
        window.dispatchEvent(new Event("focus"))
      }, 100)
    })
  }

  // Generate realistic typing patterns
  async humanTypeText(page: Page, selector: string, text: string): Promise<void> {
    await page.focus(selector)

    for (const char of text) {
      await page.keyboard.type(char)

      // Random typing delay between characters
      const delay = 50 + Math.random() * 100
      await page.waitForTimeout(delay)

      // Occasional longer pauses (thinking)
      if (Math.random() < 0.1) {
        await page.waitForTimeout(200 + Math.random() * 500)
      }
    }
  }

  // Simulate human-like clicking
  async humanClick(page: Page, selector: string): Promise<void> {
    const element = await page.locator(selector)
    const box = await element.boundingBox()

    if (box) {
      // Click slightly off-center to mimic human behavior
      const x = box.x + box.width * (0.3 + Math.random() * 0.4)
      const y = box.y + box.height * (0.3 + Math.random() * 0.4)

      // Move mouse to element first
      await page.mouse.move(x, y, { steps: 5 })
      await page.waitForTimeout(100 + Math.random() * 200)

      // Click with slight delay
      await page.mouse.down()
      await page.waitForTimeout(50 + Math.random() * 100)
      await page.mouse.up()
    }
  }
}

export const fingerprintResistance = new FingerprintResistance()
