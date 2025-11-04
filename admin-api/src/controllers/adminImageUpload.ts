/**
 * Image Upload Controller
 * Handles image uploads for gift templates
 */

import { FastifyRequest, FastifyReply } from 'fastify'
import { uploadImage, fetchAndUploadImage } from '../services/s3Service.js'

interface UploadImageBody {
  imageUrl?: string
  fileName?: string
}

/**
 * POST /admin/images/upload
 * Upload an image file or fetch from URL and store in S3
 */
export const uploadImageHandler = async (
  req: FastifyRequest<{ Body: UploadImageBody }>,
  reply: FastifyReply
) => {
  try {
    // Check if this is a multipart file upload
    const isMultipart = req.isMultipart()
    
    let imageUrl: string

    if (isMultipart) {
      // Handle file upload
      const data = await req.file()
      
      if (!data) {
        return reply.status(400).send({ error: 'No file provided' })
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!data.mimetype || !allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ 
          error: 'Invalid file type. Allowed types: JPEG, PNG, GIF, WebP' 
        })
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB
      const buffer = await data.toBuffer()
      
      if (buffer.length > maxSize) {
        return reply.status(400).send({ 
          error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` 
        })
      }

      // Upload to S3
      const fileName = data.filename || `upload-${Date.now()}.${data.mimetype.split('/')[1]}`
      imageUrl = await uploadImage(buffer, fileName, data.mimetype)
    } else {
      // Handle URL fetch
      const body = req.body as UploadImageBody
      
      if (!body.imageUrl) {
        return reply.status(400).send({ error: 'imageUrl is required' })
      }

      // Validate URL
      try {
        new URL(body.imageUrl)
      } catch {
        return reply.status(400).send({ error: 'Invalid URL format' })
      }

      // Fetch and upload to S3
      imageUrl = await fetchAndUploadImage(body.imageUrl, body.fileName)
    }

    return { 
      success: true,
      imageUrl 
    }
  } catch (error) {
    console.error('Error uploading image:', error)
    reply.status(500).send({ 
      error: 'Failed to upload image',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

