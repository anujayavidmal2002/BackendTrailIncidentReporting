require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { Sequelize, DataTypes } = require("sequelize");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const exifr = require("exifr");

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL Connection using Sequelize
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in .env file");
}

// Check if it's a local or remote database
const isLocalDB =
  DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1");

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: isLocalDB
    ? {}
    : {
        ssl: {
          rejectUnauthorized: false,
        },
      },
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Test database connection with enhanced logging
console.log("🔍 Attempting database connection...");
console.log(
  "📋 DATABASE_URL format:",
  DATABASE_URL ? DATABASE_URL.substring(0, 30) + "..." : "MISSING"
);
console.log("📋 SSL Enabled:", !isLocalDB);

sequelize
  .authenticate()
  .then(() => {
    console.log("✅ Connected to PostgreSQL database successfully!");
  })
  .catch((err) => {
    console.error("❌ PostgreSQL connection error!");
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
    console.error("Error Code:", err.code || "N/A");
    console.error("Full Error:", err);
    process.exit(1);
  });

// Define Incident Model for PostgreSQL
const Incident = sequelize.define(
  "Incident",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING,
    },
    locationText: {
      type: DataTypes.STRING,
    },
    latitude: {
      type: DataTypes.DOUBLE,
      defaultValue: null,
    },
    longitude: {
      type: DataTypes.DOUBLE,
      defaultValue: null,
    },
    severity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    date: {
      type: DataTypes.STRING,
    },
    time: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "Open",
    },
    photos: {
      type: DataTypes.JSONB, // PostgreSQL JSONB for array of photo objects
      defaultValue: [],
    },
    photoUrl: {
      type: DataTypes.STRING,
    },
    photoKey: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "incidents",
    timestamps: true, // Automatically adds createdAt and updatedAt
    underscored: false, // Use camelCase field names
  }
);

// Sync database (create tables if they don't exist)
sequelize
  .sync()
  .then(() => {
    console.log("✅ Database tables synced");
  })
  .catch((err) => {
    console.error("❌ Error syncing database:", err.message);
  });

const AWS_REGION = process.env.AWS_REGION;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

if (
  !AWS_REGION ||
  !AWS_S3_BUCKET ||
  !AWS_ACCESS_KEY_ID ||
  !AWS_SECRET_ACCESS_KEY
) {
  throw new Error("AWS credentials must be set in .env file");
}

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const storage = multer.memoryStorage();
function fileFilter(req, file, cb) {
  if (!file.mimetype || !file.mimetype.startsWith("image/")) {
    return cb(new Error("File must be an image."), false);
  }
  cb(null, true);
}
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}); // 5MB

function createObjectKey(filename = "") {
  const ext = path.extname(filename);
  const unique = crypto.randomBytes(6).toString("hex");
  return `incidents/${Date.now()}-${unique}${ext}`;
}

function buildPublicUrl(key) {
  if (process.env.AWS_S3_PUBLIC_BASE_URL) {
    return `${process.env.AWS_S3_PUBLIC_BASE_URL}/${key}`;
  }
  return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

async function uploadToS3(file) {
  const key = createObjectKey(file.originalname);
  await s3.send(
    new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );
  return { key, url: buildPublicUrl(key) };
}

async function deleteFromS3(key) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key }));
  } catch (err) {
    // Swallow deletion failures; not critical for API flow
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`,
      { timeout: 5000 }
    );
    if (!response.ok) throw new Error("Reverse geocoding failed");
    const data = await response.json();
    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (err) {
    console.warn("Reverse geocoding failed:", err.message);
    return `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

async function extractGpsFromFiles(files = []) {
  console.log(`\n🔍 extractGpsFromFiles called with ${files.length} file(s)`);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      console.log(
        `   📸 Processing file ${i + 1}/${files.length}: ${
          file.originalname
        } (${file.size} bytes)`
      );

      // Use exifr.parse with GPS option to extract GPS data
      const exif = await exifr.parse(file.buffer, { gps: true });

      if (!exif) {
        console.log(`   ⚠️ No EXIF data found in ${file.originalname}`);
        continue;
      }

      console.log(
        `   ✅ EXIF found in ${
          file.originalname
        }. Keys available: ${Object.keys(exif).slice(0, 15).join(", ")}`
      );

      // Try modern format first (latitude/longitude)
      let lat = exif.latitude;
      let lng = exif.longitude;

      // Fallback to GPSLatitude/GPSLongitude
      if (lat === undefined && exif.GPSLatitude !== undefined) {
        lat = exif.GPSLatitude;
        lng = exif.GPSLongitude;
      }

      console.log(
        `   📍 Raw GPS values in EXIF: Latitude=${lat}, Longitude=${lng}`
      );

      // Convert to numbers if they're not already
      const latNum = typeof lat === "number" ? lat : parseFloat(lat);
      const lngNum = typeof lng === "number" ? lng : parseFloat(lng);

      console.log(
        `   🔢 After conversion: lat=${latNum} (${typeof latNum}), lng=${lngNum} (${typeof lngNum})`
      );

      if (!isNaN(latNum) && !isNaN(lngNum) && latNum !== 0 && lngNum !== 0) {
        const gps = { latitude: latNum, longitude: lngNum };
        console.log(
          `   ✅ GPS extracted successfully from ${file.originalname}:`,
          gps
        );
        return gps;
      } else {
        console.log(
          `   ⚠️ GPS data invalid or missing: lat=${latNum}, lng=${lngNum}`
        );
      }
    } catch (err) {
      console.error(
        `   ❌ Error extracting EXIF from ${file.originalname}:`,
        err.message
      );
      // ignore parse failures and continue to next file
    }
  }
  console.log("❌ No GPS data found in any of the photos");
  return null;
}

app.use(cors());
app.use(express.json());

// Debug middleware: log incoming Authorization header to verify gateway forwarding
app.use((req, res, next) => {
  try {
    console.log('➡️ Incoming request:', req.method, req.originalUrl);
    console.log('   Authorization header:', req.headers.authorization || '<<missing>>');
  } catch (e) {
    // ignore logging errors
  }
  next();
});

// --- ROUTES ---
// Get all incidents
app.get("/api/incidents", async (req, res) => {
  try {
    const incidents = await Incident.findAll({
      order: [["createdAt", "DESC"]],
    });
    res.json(incidents);
  } catch (err) {
    console.error("Error fetching incidents:", err.message);
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

// Get single incident
app.get("/api/incidents/:id", async (req, res) => {
  try {
    const incident = await Incident.findByPk(req.params.id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch incident" });
  }
});

// Create new incident (supports multiple photos and EXIF-based GPS)
app.post("/api/incidents", upload.array("photos", 5), async (req, res) => {
  const {
    type,
    description,
    severity,
    latitude,
    longitude,
    locationText,
    locationMode,
  } = req.body;
  const files = req.files || [];

  console.log(`\n${"=".repeat(80)}`);
  console.log(`📝 NEW INCIDENT CREATION`);
  console.log(`${"=".repeat(80)}`);
  console.log(`Mode: ${locationMode || "unknown"}`);
  console.log(`Files: ${files.length}, LocationText: "${locationText}"`);
  console.log(
    `📡 From Frontend - Latitude: ${latitude}, Longitude: ${longitude} (types: ${typeof latitude}, ${typeof longitude})`
  );

  const hasLocationText =
    typeof locationText === "string" && locationText.trim().length > 0;

  // Parse coordinates to check if they're valid numbers
  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);
  const hasCoordsInput =
    !isNaN(latNum) && !isNaN(lngNum) && latNum !== 0 && lngNum !== 0;

  console.log(
    `hasLocationText: ${hasLocationText}, hasCoordsInput: ${hasCoordsInput}`
  );

  // Only attempt EXIF extraction if no valid coords provided and we have files
  let gpsFromImages = null;
  if (!hasCoordsInput && files.length > 0) {
    console.log("🔍 Attempting EXIF GPS extraction from photos...");
    gpsFromImages = await extractGpsFromFiles(files);
    console.log(`Result from extractGpsFromFiles:`, gpsFromImages);
  }

  const hasExifCoords = !!gpsFromImages;
  console.log(`hasExifCoords: ${hasExifCoords}`);

  if (
    !type ||
    !description ||
    !severity ||
    (!hasLocationText && !hasCoordsInput && !hasExifCoords)
  ) {
    console.log("❌ VALIDATION FAILED - Missing required data");
    return res.status(400).json({
      error: "Provide location text, coordinates, or a geotagged photo.",
    });
  }

  let uploads = [];
  if (files.length) {
    try {
      uploads = await Promise.all(files.map(uploadToS3));
      console.log(`✅ ${uploads.length} photo(s) uploaded to S3`);
    } catch (err) {
      console.error("S3 upload failed (create):", err.message || err);
      return res.status(500).json({ error: "Image upload failed." });
    }
  }

  // Parse and validate coordinates - only set if valid numbers
  let resolvedLatitude = null;
  let resolvedLongitude = null;

  if (hasCoordsInput) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      resolvedLatitude = lat;
      resolvedLongitude = lng;
      console.log(
        `✅ Using input coordinates: ${resolvedLatitude}, ${resolvedLongitude}`
      );
    }
  } else if (gpsFromImages) {
    const lat = parseFloat(gpsFromImages.latitude);
    const lng = parseFloat(gpsFromImages.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      resolvedLatitude = lat;
      resolvedLongitude = lng;
      console.log(
        `✅ Using EXIF GPS coordinates: ${resolvedLatitude}, ${resolvedLongitude}`
      );
    }
  }

  // Generate location text - if we have GPS coords, use reverse geocoding
  let resolvedLocationText = "";
  if (hasLocationText) {
    resolvedLocationText = locationText;
    console.log(`✅ Using location text: ${resolvedLocationText}`);
  } else if (resolvedLatitude !== null && resolvedLongitude !== null) {
    // Perform reverse geocoding for GPS coordinates
    console.log(
      `🌍 Performing reverse geocoding for ${resolvedLatitude}, ${resolvedLongitude}...`
    );
    resolvedLocationText = await reverseGeocode(
      resolvedLatitude,
      resolvedLongitude
    );
    console.log(`✓ Reverse geocoded to: ${resolvedLocationText}`);
  }

  // Fallback: if still no location text but we have coords, create a basic GPS label
  if (
    !resolvedLocationText &&
    resolvedLatitude !== null &&
    resolvedLongitude !== null
  ) {
    resolvedLocationText = `GPS: ${resolvedLatitude.toFixed(
      6
    )}, ${resolvedLongitude.toFixed(6)}`;
    console.log(
      `⚠️ Using GPS coordinates as fallback location text: ${resolvedLocationText}`
    );
  }

  console.log(`✨ RESOLVED DATA:`);
  console.log(`   Latitude: ${resolvedLatitude}`);
  console.log(`   Longitude: ${resolvedLongitude}`);
  console.log(`   Location Text: "${resolvedLocationText}"`);
  console.log(`${"=".repeat(80)}\n`);

  const now = new Date();
  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString();
  const photos = uploads.map((u, idx) => ({
    url: u.url,
    key: u.key,
    name: files[idx]?.originalname || "",
  }));

  try {
    const incident = await Incident.create({
      type,
      description,
      location: resolvedLocationText,
      locationText: resolvedLocationText,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
      severity,
      date,
      time,
      status: "Open",
      photos,
      photoUrl: photos[0]?.url || null,
      photoKey: photos[0]?.key || null,
    });

    console.log(`✅ Incident saved successfully with ID: ${incident.id}`);
    res.status(201).json(incident);
  } catch (err) {
    console.error("Error creating incident:", err.message);
    res.status(500).json({ error: "Failed to create incident" });
  }
});

// Update incident
app.put("/api/incidents/:id", upload.array("photos", 5), async (req, res) => {
  try {
    const incident = await Incident.findByPk(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    const {
      type,
      description,
      location,
      severity,
      status,
      latitude,
      longitude,
    } = req.body;

    if (type) incident.type = type;
    if (description) incident.description = description;
    if (location) incident.location = location;
    if (severity) incident.severity = severity;
    if (status) incident.status = status;

    if (latitude && longitude) {
      incident.latitude = parseFloat(latitude);
      incident.longitude = parseFloat(longitude);
    }

    const files = req.files || [];
    if (files.length) {
      try {
        const uploads = await Promise.all(files.map(uploadToS3));

        // Delete old photos from S3
        if (incident.photos && incident.photos.length) {
          await Promise.all(incident.photos.map((p) => deleteFromS3(p.key)));
        } else if (incident.photoKey) {
          await deleteFromS3(incident.photoKey);
        }

        incident.photos = uploads.map((u, idx) => ({
          url: u.url,
          key: u.key,
          name: files[idx]?.originalname || "",
        }));
        incident.photoUrl = incident.photos[0]?.url || null;
        incident.photoKey = incident.photos[0]?.key || null;
      } catch (err) {
        console.error("S3 upload failed (update):", err.message || err);
        return res.status(500).json({ error: "Image upload failed." });
      }
    }

    await incident.save();
    res.json(incident);
  } catch (err) {
    console.error("Error updating incident:", err.message);
    res.status(500).json({ error: "Failed to update incident" });
  }
});

// Delete incident
app.delete("/api/incidents/:id", async (req, res) => {
  try {
    const incident = await Incident.findByPk(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    // Delete photos from S3
    if (incident.photos && incident.photos.length) {
      await Promise.all(incident.photos.map((p) => deleteFromS3(p.key)));
    } else if (incident.photoKey) {
      await deleteFromS3(incident.photoKey);
    }

    await incident.destroy();
    res.json({ message: "Incident deleted." });
  } catch (err) {
    console.error("Error deleting incident:", err.message);
    res.status(500).json({ error: "Failed to delete incident" });
  }
});

// Stats endpoint
app.get("/api/stats", async (req, res) => {
  try {
    const incidents = await Incident.findAll();
    const stats = {
      total: incidents.length,
      bySeverity: { Low: 0, Medium: 0, High: 0 },
      byType: {},
    };
    incidents.forEach((i) => {
      stats.bySeverity[i.severity] = (stats.bySeverity[i.severity] || 0) + 1;
      stats.byType[i.type] = (stats.byType[i.type] || 0) + 1;
    });
    res.json(stats);
  } catch (err) {
    console.error("Error fetching stats:", err.message);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Root
app.get("/", (req, res) => {
  res.send("Trail Incident Reporting Backend Running with PostgreSQL.");
});
// Error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(413).json({ error: "File too large or upload error." });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
