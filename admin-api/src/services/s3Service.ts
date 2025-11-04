/**
 * S3/MinIO Service
 * Handles image uploads and storage for gift templates
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://minio:9000'
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minio'
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minio12345'
const S3_BUCKET = process.env.S3_BUCKET || 'gift-images'
const S3_REGION = process.env.S3_REGION || 'us-east-1'

// Create S3 client (works with MinIO and AWS S3)
const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY
  },
  forcePathStyle: true // Required for MinIO
})

/**
 * Initialize the S3 bucket (create if it doesn't exist) and set public read policy
 */
export async function ensureBucketExists(): Promise<void> {
  let bucketCreated = false
  try {
    // Try to check if bucket exists
    await s3Client.send(new HeadBucketCommand({
      Bucket: S3_BUCKET
    }))
    console.log(`✅ Bucket ${S3_BUCKET} exists`)
  } catch (error: any) {
    // Bucket doesn't exist, create it
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      try {
        await s3Client.send(new CreateBucketCommand({
          Bucket: S3_BUCKET
        }))
        console.log(`✅ Created bucket ${S3_BUCKET}`)
        bucketCreated = true
      } catch (createError) {
        console.error(`⚠️ Failed to create bucket ${S3_BUCKET}:`, createError)
        // Continue anyway - MinIO might auto-create on first upload
      }
    } else {
      console.error(`⚠️ Error checking bucket ${S3_BUCKET}:`, error)
    }
  }

  // Always set bucket policy for public read access (works with MinIO)
  // This ensures the policy is applied even if the bucket already existed
  // We use both S3 bucket policy API and MinIO's anonymous access setting
  try {
    // Wait a moment if bucket was just created
    if (bucketCreated) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Method 1: Try S3 bucket policy API (works with AWS S3)
    try {
      const bucketPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${S3_BUCKET}/*`]
          }
        ]
      }

      await s3Client.send(new PutBucketPolicyCommand({
        Bucket: S3_BUCKET,
        Policy: JSON.stringify(bucketPolicy)
      }))
      console.log(`✅ Set public read policy via S3 API for bucket ${S3_BUCKET}`)
    } catch (s3PolicyError: any) {
      // If S3 API fails, try MinIO's anonymous access (Method 2)
      // Note: This requires MinIO client, which may not be available in all environments
      console.log(`   S3 API policy setting failed, MinIO may need manual configuration`)
      console.log(`   Run: docker exec choreblimey-secure-minio-1 mc anonymous set public local/${S3_BUCKET}`)
    }
  } catch (policyError: any) {
    // Log the full error for debugging
    console.error(`❌ Failed to set bucket policy:`, policyError)
    console.log(`⚠️ You may need to set bucket policy manually`)
    console.log(`   Run: docker exec choreblimey-secure-minio-1 mc anonymous set public local/${S3_BUCKET}`)
  }
}

/**
 * Upload an image file to S3/MinIO
 * @param fileBuffer - The image file buffer
 * @param fileName - The desired file name (will be prefixed with timestamp)
 * @param contentType - MIME type (e.g., 'image/jpeg', 'image/png')
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = 'image/jpeg'
): Promise<string> {
  try {
    // Ensure bucket exists (only check once, not every time)
    // We'll call this on server startup instead

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `gift-templates/${timestamp}-${sanitizedFileName}`

    // Ensure bucket exists and has public read policy
    await ensureBucketExists()

    // Upload to S3
    // Note: ACL is not used with MinIO, we use bucket policy instead
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: S3_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType
      }
    })

    await upload.done()

    // Return the public URL
    // For MinIO, we need to use the external URL (localhost:1507) for public access
    // Internal URL (minio:9000) won't work from browser
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || S3_ENDPOINT.replace('minio:9000', 'localhost:1507')
    const publicUrl = `${publicEndpoint}/${S3_BUCKET}/${key}`
    
    console.log(`✅ Uploaded image to S3: ${publicUrl}`)
    return publicUrl
  } catch (error) {
    console.error('❌ Error uploading image to S3:', error)
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Download an image from a URL and upload it to S3
 * @param imageUrl - The external URL of the image
 * @param fileName - Optional custom file name
 * @returns The public URL of the uploaded image
 */
export async function fetchAndUploadImage(
  imageUrl: string,
  fileName?: string
): Promise<string> {
  try {
    console.log(`📥 Fetching image from: ${imageUrl}`)
    
    // Fetch the image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    // Validate it's an image
    if (!contentType.startsWith('image/')) {
      throw new Error(`URL does not point to an image: ${contentType}`)
    }

    // Get file buffer
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (buffer.length > maxSize) {
      throw new Error(`Image too large: ${buffer.length} bytes (max ${maxSize} bytes)`)
    }

    // Generate filename from URL if not provided
    if (!fileName) {
      const urlPath = new URL(imageUrl).pathname
      const urlFileName = urlPath.split('/').pop() || 'image.jpg'
      fileName = urlFileName
      
      // Ensure file extension
      if (!fileName.includes('.')) {
        const ext = contentType.split('/')[1] || 'jpg'
        fileName = `${fileName}.${ext}`
      }
    }

    // Upload to S3
    return await uploadImage(buffer, fileName, contentType)
  } catch (error) {
    console.error('❌ Error fetching and uploading image:', error)
    throw new Error(`Failed to fetch and upload image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Check if an image exists at the given S3 URL
 */
export async function imageExists(s3Url: string): Promise<boolean> {
  try {
    // Extract key from URL
    const url = new URL(s3Url)
    const key = url.pathname.replace(`/${S3_BUCKET}/`, '')
    
    await s3Client.send(new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key
    }))
    
    return true
  } catch (error) {
    return false
  }
}

