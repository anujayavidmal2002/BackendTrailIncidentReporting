require("dotenv").config();
const { Sequelize } = require("sequelize");

console.log("🔍 Testing PostgreSQL Connection...\n");

// Get connection string from .env
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in .env file");
  process.exit(1);
}

console.log("📋 Connection Details:");
console.log("Database URL:", DATABASE_URL.substring(0, 40) + "...");
console.log("");

// Create Sequelize instance
const sequelize = new Sequelize(DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
});

// Test connection
async function testConnection() {
  try {
    console.log("⏳ Attempting to connect...\n");

    await sequelize.authenticate();

    console.log("✅ SUCCESS! PostgreSQL connection established!\n");

    // Get database info
    const [results] = await sequelize.query(
      "SELECT version(), current_database(), current_user"
    );

    console.log("📊 Database Information:");
    console.log("Version:", results[0].version);
    console.log("Database:", results[0].current_database);
    console.log("User:", results[0].current_user);
    console.log("");

    // Test table listing
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    if (tables.length > 0) {
      console.log("📋 Existing Tables:");
      tables.forEach((table) => console.log("  -", table.table_name));
    } else {
      console.log("📋 No tables found (database is empty)");
    }

    console.log("\n✅ Connection test completed successfully!");
  } catch (error) {
    console.error("❌ CONNECTION FAILED!\n");
    console.error("Error Type:", error.name);
    console.error("Error Message:", error.message);
    console.error("\n🔧 Troubleshooting:");

    if (error.message.includes("ENOTFOUND")) {
      console.error("- Check hostname in DATABASE_URL");
      console.error("- Verify internet connection");
    } else if (error.message.includes("ETIMEDOUT")) {
      console.error("- Database server may be down");
      console.error("- Check firewall settings");
      console.error("- Verify Aiven service is running");
    } else if (error.message.includes("authentication failed")) {
      console.error("- Check username/password in DATABASE_URL");
      console.error("- Verify credentials in Aiven console");
    } else if (error.message.includes("SSL")) {
      console.error("- SSL/TLS connection issue");
      console.error("- Verify ?sslmode=require in connection string");
    }

    console.error("\n📝 Full Error Details:");
    console.error(error);

    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

testConnection();
