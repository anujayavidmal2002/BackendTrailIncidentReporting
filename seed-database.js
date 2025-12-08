require("dotenv").config();
const mongoose = require("mongoose");

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("MONGODB_URI must be set in .env file");
}

// Define Incident Schema
const incidentSchema = new mongoose.Schema({
  type: String,
  description: String,
  location: String,
  locationText: String,
  latitude: Number,
  longitude: Number,
  severity: String,
  date: String,
  time: String,
  status: String,
  photos: [{ url: String, key: String, name: String }],
  photoUrl: String,
  photoKey: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Incident = mongoose.model("Incident", incidentSchema);

// Sample incident data
const sampleIncidents = [
  {
    type: "Fallen trees blocking trail",
    description:
      "Large oak tree has fallen across the main hiking trail near the creek crossing. Trail is completely blocked.",
    location:
      "Horton Plains National Park, Nuwara Eliya District, Central Province, Sri Lanka",
    locationText:
      "Horton Plains National Park, Nuwara Eliya District, Central Province, Sri Lanka",
    latitude: 6.8103,
    longitude: 80.7985,
    severity: "High",
    status: "Open",
    photos: [],
    photoUrl: null,
    photoKey: null,
  },
  {
    type: "Wildlife encounter",
    description:
      "Spotted a wild elephant herd near the trail entrance. Keep safe distance of at least 50 meters.",
    location: "Udawalawe National Park, Sabaragamuwa Province, Sri Lanka",
    locationText: "Udawalawe National Park, Sabaragamuwa Province, Sri Lanka",
    latitude: 6.4384,
    longitude: 80.882,
    severity: "Medium",
    status: "Open",
    photos: [],
    photoUrl: null,
    photoKey: null,
  },
  {
    type: "Trail erosion",
    description:
      "Severe erosion along the mountain path due to recent heavy rains. Sections of the trail are unstable.",
    location:
      "Adams Peak (Sri Pada), Ratnapura District, Sabaragamuwa Province, Sri Lanka",
    locationText:
      "Adams Peak (Sri Pada), Ratnapura District, Sabaragamuwa Province, Sri Lanka",
    latitude: 6.8095,
    longitude: 80.4993,
    severity: "High",
    status: "Open",
    photos: [],
    photoUrl: null,
    photoKey: null,
  },
  {
    type: "Damaged signage",
    description:
      "Trail marker sign at junction point is broken and lying on ground. May cause confusion for hikers.",
    location: "Sinharaja Forest Reserve, Sabaragamuwa Province, Sri Lanka",
    locationText: "Sinharaja Forest Reserve, Sabaragamuwa Province, Sri Lanka",
    latitude: 6.4016,
    longitude: 80.4011,
    severity: "Low",
    status: "Open",
    photos: [],
    photoUrl: null,
    photoKey: null,
  },
  {
    type: "Trail maintenance needed",
    description:
      "Overgrown vegetation making trail difficult to navigate. Needs clearing.",
    location:
      "Knuckles Mountain Range, Matale District, Central Province, Sri Lanka",
    locationText:
      "Knuckles Mountain Range, Matale District, Central Province, Sri Lanka",
    latitude: 7.45,
    longitude: 80.7833,
    severity: "Medium",
    status: "Open",
    photos: [],
    photoUrl: null,
    photoKey: null,
  },
  {
    type: "Hazardous conditions",
    description:
      "Slippery rocks near waterfall. Two minor slip incidents reported this week. Use extreme caution.",
    location: "Bambarakanda Falls, Badulla District, Uva Province, Sri Lanka",
    locationText:
      "Bambarakanda Falls, Badulla District, Uva Province, Sri Lanka",
    latitude: 6.8167,
    longitude: 80.9833,
    severity: "High",
    status: "Open",
    photos: [],
    photoUrl: null,
    photoKey: null,
  },
  {
    type: "Bridge damage",
    description:
      "Wooden footbridge over stream has loose planks. Needs immediate repair for safety.",
    location:
      "Ella Rock Trail, Ella, Badulla District, Uva Province, Sri Lanka",
    locationText:
      "Ella Rock Trail, Ella, Badulla District, Uva Province, Sri Lanka",
    latitude: 6.8667,
    longitude: 81.0467,
    severity: "Medium",
    status: "Resolved",
    photos: [],
    photoUrl: null,
    photoKey: null,
  },
];

async function seedDatabase() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("\n🗑️  Clearing existing incidents...");
    await Incident.deleteMany({});
    console.log("✅ Cleared existing data");

    console.log("\n🌱 Seeding sample incidents...");
    for (let i = 0; i < sampleIncidents.length; i++) {
      const incident = sampleIncidents[i];
      const now = new Date();
      // Create incidents with different timestamps (spaced 1 hour apart)
      const createdAt = new Date(now.getTime() - i * 60 * 60 * 1000);

      const newIncident = new Incident({
        ...incident,
        date: createdAt.toLocaleDateString(),
        time: createdAt.toLocaleTimeString(),
        createdAt: createdAt,
        updatedAt: createdAt,
      });

      await newIncident.save();
      console.log(
        `   ✓ Added: ${incident.type} (${incident.severity} - ${incident.status})`
      );
    }

    console.log(
      "\n✅ Successfully seeded database with",
      sampleIncidents.length,
      "incidents"
    );
    console.log("\n📊 Database Summary:");
    console.log("   - Total incidents:", sampleIncidents.length);
    console.log(
      "   - Open incidents:",
      sampleIncidents.filter((i) => i.status === "Open").length
    );
    console.log(
      "   - Resolved incidents:",
      sampleIncidents.filter((i) => i.status === "Resolved").length
    );
    console.log(
      "   - High severity:",
      sampleIncidents.filter((i) => i.severity === "High").length
    );
    console.log(
      "   - Medium severity:",
      sampleIncidents.filter((i) => i.severity === "Medium").length
    );
    console.log(
      "   - Low severity:",
      sampleIncidents.filter((i) => i.severity === "Low").length
    );

    console.log(
      "\n✨ You can now open the Admin Dashboard to see these incidents!"
    );
    console.log("   URL: http://localhost:3000");
  } catch (err) {
    console.error("❌ Error seeding database:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

seedDatabase();
