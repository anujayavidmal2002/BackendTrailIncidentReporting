/**
 * Simple EXIF extraction test
 * Usage: node test-exif.js <image-path>
 */
const fs = require('fs');
const path = require('path');
const exifr = require('exifr');

async function testExif(imagePath) {
  if (!imagePath) {
    console.error('Usage: node test-exif.js <image-path>');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  console.log(`\n🔍 Testing EXIF extraction on: ${path.basename(imagePath)}`);
  console.log(`   Size: ${fs.statSync(imagePath).size} bytes\n`);

  try {
    const buffer = fs.readFileSync(imagePath);
    
    // Test 1: Full EXIF parsing
    console.log('Test 1: Full EXIF parse()');
    const exif = await exifr.parse(buffer);
    if (exif) {
      console.log(`✓ EXIF data found (${Object.keys(exif).length} tags)`);
      console.log(`  - DateTime: ${exif.DateTime}`);
      console.log(`  - GPSLatitude: ${exif.GPSLatitude}`);
      console.log(`  - GPSLongitude: ${exif.GPSLongitude}`);
      console.log(`  - GPSAltitude: ${exif.GPSAltitude}`);
      console.log(`  - Orientation: ${exif.Orientation}`);
      console.log(`  - Make: ${exif.Make}`);
    } else {
      console.log('✗ No EXIF data found');
    }

    // Test 2: GPS-specific extraction
    console.log('\nTest 2: GPS-specific gps()');
    const gps = await exifr.gps(buffer);
    if (gps) {
      console.log(`✓ GPS data found:`, gps);
    } else {
      console.log('✗ No GPS data found');
    }

    // Test 3: All tags
    console.log('\nTest 3: All available tags');
    const allTags = await exifr.parse(buffer, { exif: true, gps: true, ifd: true });
    if (allTags) {
      const tagKeys = Object.keys(allTags).sort();
      console.log(`Found ${tagKeys.length} tags:`, tagKeys.join(', '));
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testExif(process.argv[2]);
