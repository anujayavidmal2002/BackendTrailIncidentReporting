#!/usr/bin/env node

const https = require('https');

// Your production Choreo backend URL
const CHOREO_URL = 'https://a4560f38-d4eb-4b5f-a45f-12ac22b80d93-prod.e1-us-east-azure.choreoapis.dev/trailincidentreport/incidentbackend/v1.0';

console.log('\n🚀 Testing Production Choreo Backend API\n');
console.log(`📍 Backend URL: ${CHOREO_URL}\n`);
console.log('═══════════════════════════════════════════════════════════\n');

// Helper function to make HTTPS requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CHOREO_URL);
    
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      rejectUnauthorized: false,
    };

    const req = https.request(url, options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: responseData,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  try {
    // Test 1: Health Check
    console.log('✅ Test 1: Health Check');
    console.log('─────────────────────────────────────────────────────────');
    try {
      const healthRes = await makeRequest('GET', '/health');
      console.log(`Status: ${healthRes.status} ${healthRes.status === 200 ? '✓' : '✗'}`);
      console.log(`Response: ${healthRes.body}\n`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }

    // Test 2: Get All Incidents
    console.log('✅ Test 2: GET All Incidents');
    console.log('─────────────────────────────────────────────────────────');
    try {
      const getRes = await makeRequest('GET', '/api/incidents');
      console.log(`Status: ${getRes.status} ${getRes.status === 200 ? '✓' : '✗'}`);
      console.log(`Response: ${getRes.body}\n`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }

    // Test 3: Create Incident
    console.log('✅ Test 3: POST Create Incident');
    console.log('─────────────────────────────────────────────────────────');
    const newIncident = {
      title: 'Production Test Incident',
      description: 'Testing API connectivity from production',
      location: 'GPS: 6.8038, 79.9380',
      latitude: 6.8038,
      longitude: 79.9380,
      photos: [],
      status: 'open',
    };
    try {
      const postRes = await makeRequest('POST', '/api/incidents', newIncident);
      console.log(`Status: ${postRes.status} ${postRes.status === 201 ? '✓' : '✗'}`);
      console.log(`Response: ${postRes.body}\n`);
      
      // Parse response to get incident ID
      try {
        const responseBody = JSON.parse(postRes.body);
        const incidentId = responseBody._id || responseBody.id;
        
        if (incidentId) {
          console.log(`✓ Incident ID: ${incidentId}\n`);

          // Test 4: Get Single Incident
          console.log('✅ Test 4: GET Single Incident');
          console.log('─────────────────────────────────────────────────────────');
          try {
            const getSingleRes = await makeRequest('GET', `/api/incidents/${incidentId}`);
            console.log(`Status: ${getSingleRes.status} ${getSingleRes.status === 200 ? '✓' : '✗'}`);
            console.log(`Response: ${getSingleRes.body}\n`);
          } catch (error) {
            console.log(`❌ Error: ${error.message}\n`);
          }

          // Test 5: Update Incident Status
          console.log('✅ Test 5: PUT Update Incident Status');
          console.log('─────────────────────────────────────────────────────────');
          try {
            const updateRes = await makeRequest('PUT', `/api/incidents/${incidentId}`, {
              status: 'in-progress',
            });
            console.log(`Status: ${updateRes.status} ${updateRes.status === 200 ? '✓' : '✗'}`);
            console.log(`Response: ${updateRes.body}\n`);
          } catch (error) {
            console.log(`❌ Error: ${error.message}\n`);
          }

          // Test 6: Delete Incident
          console.log('✅ Test 6: DELETE Incident');
          console.log('─────────────────────────────────────────────────────────');
          try {
            const deleteRes = await makeRequest('DELETE', `/api/incidents/${incidentId}`);
            console.log(`Status: ${deleteRes.status} ${deleteRes.status === 200 ? '✓' : '✗'}`);
            console.log(`Response: ${deleteRes.body}\n`);
          } catch (error) {
            console.log(`❌ Error: ${error.message}\n`);
          }
        }
      } catch (parseError) {
        console.log('Could not parse response as JSON\n');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ All tests completed!\n');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

runTests();
