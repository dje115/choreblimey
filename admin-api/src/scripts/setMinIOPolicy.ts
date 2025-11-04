/**
 * Script to set MinIO bucket policy for public read access
 * Run with: npx tsx src/scripts/setMinIOPolicy.ts
 */

import { S3Client, PutBucketPolicyCommand } from '@aws-sdk/client-s3'

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://minio:9000'
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minio'
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minio12345'
const S3_BUCKET = process.env.S3_BUCKET || 'gift-images'

const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY
  },
  forcePathStyle: true
})

async function setBucketPolicy() {
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
    
    console.log(`✅ Successfully set public read policy for bucket ${S3_BUCKET}`)
    process.exit(0)
  } catch (error: any) {
    console.error(`❌ Failed to set bucket policy:`, error.message)
    process.exit(1)
  }
}

setBucketPolicy()

