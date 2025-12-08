# EXIF GPS Extraction Guide

## Overview

The Trail Incident Reporting system can automatically extract GPS location from photos that contain EXIF metadata. This guide explains how to test and troubleshoot the feature.

## How EXIF Extraction Works

1. User uploads photos in **Photo Metadata** mode
2. Backend receives files via multer (memory storage)
3. `exifr.parse()` reads EXIF tags from the image buffer
4. GPS coordinates (`GPSLatitude`, `GPSLongitude`) are extracted if present
5. Coordinates are stored and a Google Maps link is generated

## Requirements for EXIF GPS to Work

- **Photo must have GPS metadata**: Photo was taken with GPS enabled on phone/camera
- **Common sources**:
  - Smartphone photos (iOS/Android with location services enabled)
  - GPS-enabled cameras (most modern digital cameras)
  - Drone photos (DJI, etc.)
- **Won't work**:
  - Screenshots
  - Photos from web (usually stripped of EXIF)
  - Photos taken with GPS disabled
  - Certain edited photos (depends on editor)

## Testing EXIF Extraction Locally

### Step 1: Use the test-exif.js helper

```bash
cd backend
node test-exif.js /path/to/your/geotagged/photo.jpg
```

Expected output:
```
🔍 Testing EXIF extraction on: photo.jpg
   Size: 2456789 bytes

Test 1: Full EXIF parse()
✓ EXIF data found (47 tags)
  - DateTime: 2025-12-06T14:32:15
  - GPSLatitude: 40.7128
  - GPSLongitude: -74.0060
  - GPSAltitude: 15.5
  - Orientation: 1
  - Make: Apple
```

If GPS is NOT found, the output will show:
```
✓ EXIF data found (XX tags)
  - GPSLatitude: undefined
  - GPSLongitude: undefined
```

### Step 2: Test via the API

Using curl (with your geotagged photo):

```bash
curl -X POST http://localhost:3001/api/incidents \
  -F "type=Fallen trees blocking trail" \
  -F "severity=High" \
  -F "description=Large oak tree down on main path" \
  -F "locationText=Main Trail West Section" \
  -F "locationMode=photo_metadata" \
  -F "photos=@/path/to/geotagged-photo.jpg"
```

Check the backend console for extraction logs:
```
📝 Creating incident - Mode: photo_metadata
   Files: 1, LocationText: "Main Trail West Section", Coords: (undefined, undefined)
🔍 Attempting EXIF GPS extraction from photos...
✓ GPS extracted from geotagged-photo.jpg: { latitude: 40.7128, longitude: -74.0060 }
✅ 1 photo(s) uploaded to S3
✨ Incident resolved - Lat: 40.7128, Lng: -74.0060, Location: "Main Trail West Section"
```

### Step 3: Test via the UI

1. Start frontend: `npm start` (in `frontend/` directory)
2. Navigate to "Report Incident"
3. Toggle to **"Photo Metadata"** mode
4. Upload a geotagged photo
5. Submit the form
6. Check backend console for extraction logs
7. Go to "Reported Incidents" and click the location link to verify it opens Google Maps

## Troubleshooting

### Issue: "No GPS data found in any photos"

**Possible causes:**
1. Photo doesn't have GPS metadata
   - **Solution**: Use a photo taken with GPS enabled
   - **Test**: Run `node test-exif.js photo.jpg` - check if GPSLatitude/Longitude are undefined

2. Photo format not supported by exifr
   - **Solution**: Try different formats (JPG, PNG with EXIF, HEIC)
   - **Test**: Check if `exifr.parse()` reads any EXIF tags at all

3. Photo EXIF was stripped
   - **Solution**: Don't crop/edit in certain apps; use original
   - **Test**: Use a fresh photo from your phone

### Issue: EXIF found but coordinates are wrong

- Check if GPSLatitude/Longitude are actual coordinates (numbers)
- Some cameras store GPS in different formats; exifr should handle standard ones
- Check backend console output for exact values being extracted

### Issue: Form submission fails with "Provide location text, coordinates, or a geotagged photo"

- All three location sources failed
- **Solutions**:
  1. Add locationText (description) even if using photo
  2. Verify photo has GPS via `node test-exif.js photo.jpg`
  3. Try a different photo
  4. Fall back to GPS/Text mode

## Backend Code

**Location**: `backend/server.js`, function `extractGpsFromFiles()`

Key implementation:
```javascript
async function extractGpsFromFiles(files = []) {
  for (const file of files) {
    try {
      const exif = await exifr.parse(file.buffer);
      const gps = exif?.GPSLatitude && exif?.GPSLongitude
        ? { latitude: exif.GPSLatitude, longitude: exif.GPSLongitude }
        : null;
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        console.log(`✓ GPS extracted from ${file.originalname}:`, gps);
        return gps;
      }
    } catch (err) {
      console.error(`Error extracting EXIF from ${file.originalname}:`, err.message);
    }
  }
  console.log('No GPS data found in any photos');
  return null;
}
```

## Getting a Geotagged Photo for Testing

### Option 1: Use your smartphone
1. Enable location services
2. Open camera app
3. Take a photo (iOS/Android will embed GPS)
4. Download the photo to your computer

### Option 2: Use a test image online
Some websites host sample geotagged photos:
- Search "sample exif gps jpg" on Google Images
- Download and test locally with `node test-exif.js`

### Option 3: Simulate (advanced)
Use `exiftool` or `piexif` to add GPS metadata to a photo:
```bash
# Install exiftool (macOS)
brew install exiftool

# Add GPS to a photo
exiftool -GPSLatitude=40.7128 -GPSLongitude=-74.0060 photo.jpg
```

## Frontend Behavior

- **GPS/Text mode**: Shows GPS button, location map, coordinates hidden
- **Photo Metadata mode**: Shows info message, expects geotagged photo, optional location name
- Both modes send `locationMode` to backend so it knows which strategy to use

## Logs to Monitor

In the backend console, watch for:
- `🔍 Attempting EXIF GPS extraction` - extraction started
- `✓ GPS extracted from photo.jpg` - success!
- `No GPS data found in any photos` - failed (photo probably not geotagged)
- `✨ Incident resolved - Lat: X, Lng: Y` - final incident created with coordinates

---

**Need help?** Check the test-exif.js output first—it's the best indicator of whether your photo has GPS.
