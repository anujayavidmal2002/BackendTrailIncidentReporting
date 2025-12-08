const http = require("http");

http
  .get("http://localhost:3001/api/incidents", (res) => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      const incidents = JSON.parse(data);
      console.log("\n📊 DATABASE STATUS:");
      console.log("=".repeat(80));
      console.log(`Total incidents: ${incidents.length}`);
      console.log("=".repeat(80));
      console.log("\nAll incidents:");
      incidents.forEach((inc, i) => {
        console.log(`\n${i + 1}. ID: ${inc._id}`);
        console.log(`   Type: ${inc.type}`);
        console.log(`   Description: ${inc.description.substring(0, 50)}...`);
        console.log(
          `   Location: ${inc.locationText || inc.location || "N/A"}`
        );
        console.log(`   Created: ${inc.createdAt}`);
      });
      console.log("\n" + "=".repeat(80));
    });
  })
  .on("error", (err) => {
    console.error("Error:", err.message);
  });
