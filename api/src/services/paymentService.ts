interface PaymentProcessor {
  name: string
  enabled: boolean
  config: any
}

interface PaymentConfig {
  primaryProcessor: 'api' | 'sitestripe'
  processors: {
    api: PaymentProcessor
    sitestripe: PaymentProcessor
  }
}

interface PaymentRequest {
  amount: number
  currency: string
  description: string
  customerId?: string
  metadata?: any
}

interface PaymentResponse {
  success: boolean
  transactionId?: string
  error?: string
  processor: string
}

class PaymentService {
  private config: PaymentConfig = {
    primaryProcessor: 'api',
    processors: {
      api: {
        name: 'ChoreBlimey API',
        enabled: true,
        config: {
          apiKey: process.env.API_PAYMENT_KEY || '',
          webhookSecret: process.env.API_WEBHOOK_SECRET || ''
        }
      },
      sitestripe: {
        name: 'SiteStripe',
        enabled: false,
        config: {
          apiKey: process.env.SITESTRIPE_API_KEY || '',
          webhookSecret: process.env.SITESTRIPE_WEBHOOK_SECRET || '',
          publishableKey: process.env.SITESTRIPE_PUBLISHABLE_KEY || ''
        }
      }
    }
  }

  // Load configuration from database or environment
  async loadConfig(): Promise<PaymentConfig> {
    // In production, this would load from database
    return this.config
  }

  // Update configuration (called from admin portal)
  async updateConfig(config: PaymentConfig): Promise<void> {
    this.config = config
    console.log('💳 Payment configuration updated:', {
      primaryProcessor: config.primaryProcessor,
      apiEnabled: config.processors.api.enabled,
      sitestripeEnabled: config.processors.sitestripe.enabled
    })
  }

  // Process payment using the configured primary processor
  async processPayment(payment: PaymentRequest): Promise<PaymentResponse> {
    const config = await this.loadConfig()
    const processor = config.processors[config.primaryProcessor]

    if (!processor.enabled) {
      return {
        success: false,
        error: `Payment processor ${processor.name} is disabled`,
        processor: processor.name
      }
    }

    switch (config.primaryProcessor) {
      case 'api':
        return this.processWithAPI(payment, processor.config)
      case 'sitestripe':
        return this.processWithSiteStripe(payment, processor.config)
      default:
        return {
          success: false,
          error: 'Unknown payment processor',
          processor: 'unknown'
        }
    }
  }

  // Process payment using ChoreBlimey API
  private async processWithAPI(payment: PaymentRequest, config: any): Promise<PaymentResponse> {
    try {
      // Simulate API payment processing
      console.log('💳 Processing payment with ChoreBlimey API:', {
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description
      })

      // In a real implementation, this would call your existing payment API
      const transactionId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      return {
        success: true,
        transactionId,
        processor: 'ChoreBlimey API'
      }
    } catch (error) {
      return {
        success: false,
        error: `API payment failed: ${error}`,
        processor: 'ChoreBlimey API'
      }
    }
  }

  // Process payment using SiteStripe
  private async processWithSiteStripe(payment: PaymentRequest, config: any): Promise<PaymentResponse> {
    try {
      console.log('💳 Processing payment with SiteStripe:', {
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description
      })

      // In a real implementation, this would use the SiteStripe SDK
      // const sitestripe = new SiteStripe(config.apiKey)
      // const result = await sitestripe.charges.create({
      //   amount: payment.amount,
      //   currency: payment.currency,
      //   description: payment.description,
      //   customer: payment.customerId,
      //   metadata: payment.metadata
      // })

      // For now, simulate SiteStripe processing
      const transactionId = `sitestripe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      return {
        success: true,
        transactionId,
        processor: 'SiteStripe'
      }
    } catch (error) {
      return {
        success: false,
        error: `SiteStripe payment failed: ${error}`,
        processor: 'SiteStripe'
      }
    }
  }

  // Test payment processor configuration
  async testProcessor(processorName: 'api' | 'sitestripe'): Promise<PaymentResponse> {
    const testPayment: PaymentRequest = {
      amount: 100, // $1.00 test amount
      currency: 'usd',
      description: 'Test payment from ChoreBlimey admin'
    }

    const config = await this.loadConfig()
    const processor = config.processors[processorName]

    if (!processor.enabled) {
      return {
        success: false,
        error: `Payment processor ${processor.name} is disabled`,
        processor: processor.name
      }
    }

    switch (processorName) {
      case 'api':
        return this.processWithAPI(testPayment, processor.config)
      case 'sitestripe':
        return this.processWithSiteStripe(testPayment, processor.config)
      default:
        return {
          success: false,
          error: 'Unknown payment processor',
          processor: 'unknown'
        }
    }
  }

  // Get available payment processors
  async getAvailableProcessors(): Promise<PaymentProcessor[]> {
    const config = await this.loadConfig()
    return Object.values(config.processors)
  }

  // Get current primary processor
  async getPrimaryProcessor(): Promise<string> {
    const config = await this.loadConfig()
    return config.primaryProcessor
  }
}

export const paymentService = new PaymentService()

