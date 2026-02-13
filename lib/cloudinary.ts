/**
 * Cloudinary Upload Helper
 *
 * Server-side only — uploads are always done from API routes, never from the client.
 * This prevents unsigned uploads and keeps API keys secure.
 */

import { v2 as cloudinary } from 'cloudinary';
import {
  MAX_PHOTO_SIZE_BYTES,
  ALLOWED_PHOTO_FORMATS,
  PROFILE_PHOTO_SIZE,
} from './constants';

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Result of a successful photo upload.
 */
export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

/**
 * Upload a profile photo to Cloudinary.
 *
 * - Validates file type (JPEG, PNG only)
 * - Validates file size (max 5MB)
 * - Resizes to 400x400 square (crop to fill)
 * - Stores in the `wonder-woman-fitness/profiles` folder
 *
 * @param file - The file buffer or base64 data URI to upload
 * @param userId - User ID used as the public_id (overwrites previous photo)
 * @returns Upload result with URL and public ID
 * @throws Error if validation fails or upload fails
 */
export async function uploadProfilePhoto(
  file: Buffer | string,
  userId: string
): Promise<UploadResult> {
  // Validate file size if Buffer
  if (Buffer.isBuffer(file) && file.length > MAX_PHOTO_SIZE_BYTES) {
    throw new Error(
      `File size exceeds maximum of ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB`
    );
  }

  let uploadData: string;

  if (Buffer.isBuffer(file)) {
    // Detect MIME type from magic bytes for accurate data URI construction
    const mimeType = detectMimeType(file);
    if (!mimeType || !ALLOWED_PHOTO_FORMATS.includes(mimeType)) {
      throw new Error(
        `Invalid file type. Allowed: ${ALLOWED_PHOTO_FORMATS.join(', ')}`
      );
    }
    uploadData = `data:${mimeType};base64,${file.toString('base64')}`;
  } else {
    uploadData = file;
    // Validate data URI MIME type if present
    if (uploadData.startsWith('data:')) {
      const mimeMatch = uploadData.match(/^data:(image\/\w+);base64,/);
      if (mimeMatch) {
        const mimeType = mimeMatch[1] as (typeof ALLOWED_PHOTO_FORMATS)[number];
        if (!ALLOWED_PHOTO_FORMATS.includes(mimeType)) {
          throw new Error(
            `Invalid file type: ${mimeType}. Allowed: ${ALLOWED_PHOTO_FORMATS.join(', ')}`
          );
        }
      }
    }
    // Note: Cloudinary performs server-side validation as an additional safety net
  }

  const publicId = `wonder-woman-fitness/profiles/${userId}`;

  const result = await cloudinary.uploader.upload(uploadData, {
    public_id: publicId,
    overwrite: true,
    resource_type: 'image',
    transformation: [
      {
        width: PROFILE_PHOTO_SIZE,
        height: PROFILE_PHOTO_SIZE,
        crop: 'fill',
        gravity: 'face',
        quality: 'auto',
        format: 'webp',
      },
    ],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}

/**
 * Delete an image from Cloudinary.
 *
 * @param publicId - The Cloudinary public ID of the image to delete
 * @returns true if deletion was successful, false otherwise
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error(`Failed to delete Cloudinary image ${publicId}:`, error);
    return false;
  }
}

/**
 * Generate a Cloudinary URL with transformations.
 * Useful for generating thumbnails or different sizes on-the-fly.
 *
 * @param publicId - The Cloudinary public ID
 * @param options - Transformation options
 * @returns The transformed image URL
 */
export function getImageUrl(
  publicId: string,
  options: { width?: number; height?: number; crop?: string } = {}
): string {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      {
        width: options.width || PROFILE_PHOTO_SIZE,
        height: options.height || PROFILE_PHOTO_SIZE,
        crop: options.crop || 'fill',
        quality: 'auto',
        format: 'webp',
      },
    ],
  });
}

/**
 * Detect MIME type from file magic bytes.
 * Returns the MIME type string or null if unrecognized.
 */
function detectMimeType(buffer: Buffer): (typeof ALLOWED_PHOTO_FORMATS)[number] | null {
  if (buffer.length < 4) return null;

  // JPEG: starts with FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: starts with 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }

  return null;
}
