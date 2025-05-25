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
    await page.addInitScript((cfg) => {
      // USER AGENT
      try {
        Object.defineProperty(navigator, "userAgent", { get: () => cfg.userAgent })
        Object.defineProperty(navigator, "platform", { get: () => cfg.platform })
        Object.defineProperty(navigator, "hardwareConcurrency", { get: () => cfg.hardwareConcurrency })
        Object.defineProperty(navigator, "deviceMemory", { get: () => cfg.deviceMemory })
        Object.defineProperty(navigator, "languages", {
          get: () => cfg.acceptLanguage.split(",").map((l: string) => l.split(";")[0].trim()),
        })
      } catch {}
      // VIEWPORT & SCREEN
      try {
        Object.defineProperty(screen, "width", { get: () => cfg.viewport.width })
        Object.defineProperty(screen, "height", { get: () => cfg.viewport.height })
        Object.defineProperty(screen, "colorDepth", { get: () => cfg.colorDepth })
        Object.defineProperty(window, "devicePixelRatio", { get: () => cfg.pixelRatio })
      } catch {}
      // WEBGL
      try {
        const getParameter = WebGLRenderingContext.prototype.getParameter
        WebGLRenderingContext.prototype.getParameter = function (param) {
          if (param === 37445) return cfg.webglVendor
          if (param === 37446) return cfg.webglRenderer
          return getParameter.call(this, param)
        }
      } catch {}
      // TIMEZONE
      try {
        const RealDateTimeFormat = Intl.DateTimeFormat
        Intl.DateTimeFormat = function (...args: any[]) {
          if (!args[1]) args[1] = {}
          args[1].timeZone = cfg.timezone
          return new RealDateTimeFormat(...args)
        } as any
      } catch {}
      // CANVAS FINGERPRINTING
      try {
        const origToDataURL = HTMLCanvasElement.prototype.toDataURL
        HTMLCanvasElement.prototype.toDataURL = function (...args: any[]) {
          const ctx = this.getContext("2d")
          if (ctx) {
            const imgData = ctx.getImageData(0, 0, this.width, this.height)
            for (let i = 0; i < imgData.data.length; i += 4) {
              imgData.data[i] += Math.floor(Math.random() * 3) - 1
              imgData.data[i + 1] += Math.floor(Math.random() * 3) - 1
              imgData.data[i + 2] += Math.floor(Math.random() * 3) - 1
            }
            ctx.putImageData(imgData, 0, 0)
          }
          return origToDataURL.apply(this, args)
        }
      } catch {}
      // AUDIO FINGERPRINTING
      try {
        const origCreateAnalyser = AudioContext.prototype.createAnalyser
        AudioContext.prototype.createAnalyser = function () {
          const analyser = origCreateAnalyser.call(this)
          const origGetFloatFrequencyData = analyser.getFloatFrequencyData
          analyser.getFloatFrequencyData = function (array: Float32Array) {
            origGetFloatFrequencyData.call(this, array)
            for (let i = 0; i < array.length; i++) {
              array[i] += Math.random() * 0.0001
            }
          }
          return analyser
        }
      } catch {}
      // FONT FINGERPRINTING
      try {
        const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")
        const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")
        if (origOffsetWidth && origOffsetWidth.get) {
          Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
            get: function () {
              return origOffsetWidth.get.call(this) + (Math.random() - 0.5) * 0.1
            },
          })
        }
        if (origOffsetHeight && origOffsetHeight.get) {
          Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
            get: function () {
              return origOffsetHeight.get.call(this) + (Math.random() - 0.5) * 0.1
            },
          })
        }
      } catch {}
      // PERFORMANCE NOW
      try {
        const origNow = Performance.prototype.now
        Performance.prototype.now = function () {
          return origNow.call(this) + Math.random() * 0.1
        }
      } catch {}
      // BATTERY
      try {
        if (navigator.getBattery) {
          navigator.getBattery = () =>
            Promise.resolve({
              charging: true,
              chargingTime: Number.POSITIVE_INFINITY,
              dischargingTime: Number.POSITIVE_INFINITY,
              level: 1,
            })
        }
      } catch {}
      // PERMISSIONS
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const origQuery = navigator.permissions.query
          navigator.permissions.query = (params: any) => Promise.resolve({ state: "prompt" })
        }
      } catch {}
    }, config)

    // HTTP Headers
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
  }
}

export const fingerprintResistance = new FingerprintResistance()
