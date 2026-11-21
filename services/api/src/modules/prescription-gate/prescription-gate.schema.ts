/**
 * prescription-gate has no request body of its own: the upload link is
 * POST /bookings/prescription/upload-url, owned by `bookings` (BE-2), which accepts these same types.
 */

/** A prescription is a photo (same list as bookings' prescriptionUploadSchema). */
export const PRESCRIPTION_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
