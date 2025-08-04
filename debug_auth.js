const fetch = require('node-fetch');

async function testAuth() {
  console.log('Testing authentication...');
  
  try {
    // Test without token
    console.log('\n1. Testing without token:');
    const response1 = await fetch('http://localhost:3003/api/v1/visit/all', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data1 = await response1.json();
    console.log('Status:', response1.status);
    console.log('Response:', JSON.stringify(data1, null, 2));
    
    // Test with invalid token
    console.log('\n2. Testing with invalid token:');
    const response2 = await fetch('http://localhost:3003/api/v1/visit/all', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token'
      }
    });
    
    const data2 = await response2.json();
  