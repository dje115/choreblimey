import { FastifyRequest, FastifyReply } from 'fastify'
import { paymentService } from '../services/paymentService.js'

interface PaymentConfigBody {
  primaryProcessor: 'api' | 'sitestripe'
  processors: {
    api: {
      enabled: boolean
      config: {
        apiKey: string
        webhookSecret: string
      }
    }
    sitestripe: {
      enabled: boolean
      config: {
        apiKey: string
        webhookSecret: string
        publishableKey: string
      }
    }
  }
}

/**
 * GET /admin/payment-config
 * Get current payment processor configuration
 */
export const getPaymentConfig = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const config = await paymentService.loadConfig()
    return { config }
  } catch (error) {
    console.error('Error getting payment config:', error)
    reply.status(500).send({ error: 'Failed to get payment configuration' })
  }
}

/**
 * POST /admin/payment-config
 * Update payment processor configuration
 */
export const updatePaymentConfig = async (req: FastifyRequest<{ Body: PaymentConfigBody }>, reply: FastifyReply) => {
  try {
    const config = req.body
    await paymentService.updateConfig(config)
    return { success: true, message: 'Payment configuration updated successfully' }
  } catch (error) {
    console.error('Error updating payment config:', error)
    reply.status(500).send({ error: 'Failed to update payment configuration' })
  }
}

/**
 * POST /admin/test-payment
 * Test payment processor
 */
export const testPaymentProcessor = async (req: FastifyRequest<{ Body: { processor: 'api' | 'sitestripe' } }>, reply: FastifyReply) => {
  try {
    const { processor } = req.body
    const result = await paymentService.testProcessor(processor)
    return { 
      success: result.success, 
      message: result.success ? 'Payment processor test successful' : 'Payment processor test failed',
      result
    }
  } catch (error) {
    console.error('Error testing payment processor:', error)
    reply.status(500).send({ error: 'Failed to test payment processor' })
  }
}

/**
 * GET /admin/payment-processors
 * Get available payment processors
 */
export const getPaymentProcessors = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const processors = await paymentService.getAvailableProcessors()
    const primary = await paymentService.getPrimaryProcessor()
    return { processors, primary }
  } catch (error) {
    console.error('Error getting payment processors:', error)
    reply.status(500).send({ error: 'Failed to get payment processors' })
  }
}

