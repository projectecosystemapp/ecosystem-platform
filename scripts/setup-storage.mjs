#!/usr/bin/env node

// Script to set up Supabase storage buckets
// Run with: node scripts/setup-storage.mjs

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupStorageBuckets() {
  console.log('🚀 Setting up Supabase storage buckets...\n')

  // Create provider-images bucket
  console.log('Creating provider-images bucket...')
  const { data: providerBucket, error: providerError } = await supabase
    .storage
    .createBucket('provider-images', {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    })

  if (providerError && !providerError.message.includes('already exists')) {
    console.error('❌ Error:', providerError.message)
  } else if (providerError?.message.includes('already exists')) {
    console.log('✅ provider-images bucket already exists')
  } else {
    console.log('✅ provider-images bucket created')
  }

  // Create provider-galleries bucket
  console.log('\nCreating provider-galleries bucket...')
  const { data: galleryBucket, error: galleryError } = await supabase
    .storage
    .createBucket('provider-galleries', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    })

  if (galleryError && !galleryError.message.includes('already exists')) {
    console.error('❌ Error:', galleryError.message)
  } else if (galleryError?.message.includes('already exists')) {
    console.log('✅ provider-galleries bucket already exists')
  } else {
    console.log('✅ provider-galleries bucket created')
  }

  // Create testimonial-images bucket
  console.log('\nCreating testimonial-images bucket...')
  const { data: testimonialBucket, error: testimonialError } = await supabase
    .storage
    .createBucket('testimonial-images', {
      public: true,
      fileSizeLimit: 2097152, // 2MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    })

  if (testimonialError && !testimonialError.message.includes('already exists')) {
    console.error('❌ Error:', testimonialError.message)
  } else if (testimonialError?.message.includes('already exists')) {
    console.log('✅ testimonial-images bucket already exists')
  } else {
    console.log('✅ testimonial-images bucket created')
  }

  console.log('\n✨ Storage setup complete!')
}

setupStorageBuckets().catch(console.error)