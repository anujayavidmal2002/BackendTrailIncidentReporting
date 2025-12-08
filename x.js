// Load environment variables
require('dotenv').config();

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

console.log("Script started");

// Debug: Check if env variables are loaded
console.log("AWS Access Key ID:", process.env.AWS_ACCESS_KEY_ID ? "SET" : "NOT SET");
console.log("AWS Secret Access Key:", process.env.AWS_SECRET_ACCESS_KEY ? "SET" : "NOT SET");
console.log("AWS Region:", process.env.AWS_REGION ? "SET" : "NOT SET");
console.log("S3 Bucket:", process.env.AWS_S3_BUCKET ? "SET" : "NOT SET");

// Initialize S3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Test S3 access
async function testS3() {
  try {
    const command = new ListObjectsV2Command({ Bucket: process.env.AWS_S3_BUCKET });
    const data = await s3.send(command);
    console.log("\n✅ S3 Connection Successful!");
    console.log(`Found ${data.Contents?.length || 0} objects in bucket '${process.env.AWS_S3_BUCKET}'`);
    if (data.Contents && data.Contents.length > 0) {
      console.log("\nFirst 5 objects:");
      data.Contents.slice(0, 5).forEach(obj => {
        console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
      });
    }
  } catch (err) {
    console.error("\n❌ Error accessing S3:");
    console.error("Error:", err.message);
    if (err.Code) console.error("Code:", err.Code);
  }
}

testS3();
