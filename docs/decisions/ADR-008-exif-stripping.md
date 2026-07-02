# ADR-008: EXIF Metadata Stripping

## Status

Accepted

## Context

SPEC §10 Q11 asks: Which EXIF fields should be removed from uploaded photos?

GPS data must be stripped for privacy. Other metadata may contain identifying information.

## Decision

Strip the following EXIF fields from all uploaded photos:

- GPS coordinates (latitude, longitude, altitude)
- Camera serial number
- Lens serial number
- Date/timeoriginal (removes capture timestamp)
- Software/version

Keep the following EXIF fields:

- Image dimensions (width, height) - needed for display
- Orientation - needed for correct rotation
- Color profile information

### Rationale

1. GPS removal is non-negotiable for privacy
2. Serial numbers can identify camera equipment owned
3. Capture timestamps could reveal user patterns
4. Dimensions are required for proper rendering
5. Orientation is essential for correct image display

### Implementation Notes

- EXIF stripping happens server-side before S3 upload
- Use `exiftool` or `sharp` library for stripping
- Preserve JFIF/PNG headers for dimensions
- Test with various camera brands (Canon, Nikon, Sony, iPhone, Android)
- Log when unexpected EXIF fields are encountered

## Consequences

- Requires server-side processing before S3 upload
- Original EXIF data is lost permanently
- May need to handle RAW formats differently

## Related

- SPEC §10 Q11
- Photo upload flow
