require("dotenv").config();
const { Sequelize, DataTypes } = require("sequelize");

const DATABASE_URL = process.env.DATABASE_URL;

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      rejectUnauthorized: false,
    },
  },
  logging: false,
});

// Define Incident model
const Incident = sequelize.define(
  "Incident",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    latitude: DataTypes.DECIMAL(10, 8),
    longitude: DataTypes.DECIMAL(11, 8),
    locationText: DataTypes.STRING,
    description: DataTypes.TEXT,
    severity: DataTypes.ENUM("low", "medium", "high", "critical"),
    incidentType: DataTypes.STRING,
    reportedBy: DataTypes.STRING,
    photoUrls: DataTypes.JSON,
    status: {
      type: DataTypes.ENUM("reported", "acknowledged", "resolved"),
      defaultValue: "reported",
    },
  },
  {
    timestamps: true,
    tableName: "Incidents",
  }
);

async function seedData() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection successful");

    // Sync the database schema first
    console.log("🔄 Syncing database schema...");
    await sequelize.sync({ alter: true });
    console.log("✅ Database schema synced");

    const sampleIncidents = [
      {
        latitude: 6.9271,
        longitude: 80.7789,
        locationText: "Adam's Peak, Nuwara Eliya District, Central Province",
        description:
          "Trail erosion near the main hiking route. Severe soil loss affecting the path stability.",
        severity: "high",
        incidentType: "Trail Erosion",
        reportedBy: "John Silva",
        status: "reported",
      },
      {
        latitude: 7.2906,
        longitude: 80.7689,
        locationText: "Ella Gap, Badulla District, Uva Province",
        description:
          "Fallen tree blocking the trail. Immediate clearance needed.",
        severity: "medium",
        incidentType: "Fallen Tree",
        reportedBy: "Maria Fernando",
        status: "acknowledged",
      },
      {
        latitude: 6.8271,
        longitude: 80.9135,
        locationText: "Horton Plains, Nuwara Eliya District, Central Province",
        description:
          "Water accumulation creating muddy sections. Drainage improvement needed.",
        severity: "low",
        incidentType: "Drainage Issue",
        reportedBy: "Ravi Kumar",
        status: "reported",
      },
      {
        latitude: 6.7245,
        longitude: 80.5678,
        locationText:
          "Knuckles Mountain Range, Matale District, Central Province",
        description:
          "Trail markers missing. Hikers getting lost. Urgent marker replacement needed.",
        severity: "critical",
        incidentType: "Missing Markers",
        reportedBy: "Sandra Perera",
        status: "reported",
      },
      {
        latitude: 7.1234,
        longitude: 81.2456,
        locationText: "Ravana Caves Area, Matara District, Southern Province",
        description: "Rock slides blocking access. Safety barriers installed.",
        severity: "high",
        incidentType: "Rock Slide",
        reportedBy: "Anura Jayasekera",
        status: "resolved",
      },
      {
        latitude: 6.5432,
        longitude: 80.3421,
        locationText:
          "Sigiriya Rock Fortress, Matale District, Central Province",
        description: "Minor potholes on the lower trail section.",
        severity: "low",
        incidentType: "Potholes",
        reportedBy: "Lisa Wong",
        status: "acknowledged",
      },
      {
        latitude: 6.9876,
        longitude: 80.1234,
        locationText:
          "World's End, Nuwara Eliya District, Central Province, Horton Plains",
        description:
          "Severe weathering of stone steps. High risk of slipping.",
        severity: "critical",
        incidentType: "Step Deterioration",
        reportedBy: "Kiran Mendis",
        status: "reported",
      },
      {
        latitude: 7.4321,
        longitude: 81.5678,
        locationText: "Pigeon Island National Park, Mullaitivu District, North",
        description:
          "Vegetation overgrowth along the trail. Limited visibility.",
        severity: "medium",
        incidentType: "Overgrowth",
        reportedBy: "Amara Senevirathne",
        status: "acknowledged",
      },
    ];

    // Clear existing data (optional - comment out if you want to keep old data)
    // await Incident.destroy({ where: {} });
    // console.log("🗑️  Cleared existing incidents");

    // Insert sample data
    const result = await Incident.bulkCreate(sampleIncidents);
    console.log(`\n✨ Successfully inserted ${result.length} sample incidents!\n`);

    result.forEach((incident, index) => {
      console.log(`${index + 1}. ${incident.incidentType}`);
      console.log(
        `   Location: ${incident.locationText} (${incident.latitude}, ${incident.longitude})`
      );
      console.log(`   Severity: ${incident.severity.toUpperCase()}`);
      console.log(`   Status: ${incident.status}`);
      console.log(`   ID: ${incident.id}\n`);
    });

    // Get total count
    const count = await Incident.count();
    console.log(`📊 Total incidents in database: ${count}`);
  } catch (error) {
    console.error("❌ Error seeding data:", error.message);
  } finally {
    await sequelize.close();
  }
}

seedData();
