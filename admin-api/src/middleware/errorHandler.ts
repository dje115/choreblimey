import { FastifyError, FastifyRequest, FastifyReply } from 'fastify'

export async function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  request.log.error({ error }, 'Global error handler caught an error')

  if (error.statusCode) {
    reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.code || 'Error',
      message: error.message
    })
  } else {
    reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong'
    })
  }
}

export async function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  reply.status(404).send({
    statusCode: 404,
    error: 'Not Found',
    message: `Route ${request.method}:${request.url} not found`
  })
}