const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const assert = require('assert');

// Polyfill for fetch if not available
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Global variables to store test data
let response;
let authToken;
let baseUrl = 'http://localhost:3003';

// Test user credentials (you may need to adjust these based on your test data)
const testCredentials = {
  email: 'akashvisit4.0@gmail.com',
  password: 'akashvisit4.0@gmail.com',
  role: 'Visit Admin'
};

Before(async function () {
  // Setup before each scenario
  this.response = null;
  this.authToken = null;
  this.baseUrl = baseUrl;
});

After(async function () {
  // Cleanup after each scenario
  this.response = null;
  this.authToken = null;
});

// Common Given steps
Given('the API server is running', async function () {
  // Check if the server is running by making a simple request to a protected endpoint
  try {
    const response = await fetch(`${this.baseUrl}/api/v1/visit/all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // We expect this to fail with 401 (unauthorized) if server is running
    // Any response (including 401) means server is running
    assert(response.status >= 200 && response.status < 600, 
           'Server should be running and responding');
  } catch (error) {
    throw new Error(`API server is not running: ${error.message}`);
  }
});

Given('I have valid authentication credentials', function () {
  // This step just confirms we have test credentials available
  assert(testCredentials.email, 'Test email should be defined');
  assert(testCredentials.password, 'Test password should be defined');
  assert(testCredentials.role, 'Test role should be defined');
});

Given('I am authenticated as a valid user', async function () {
  // Perform login to get authentication token
  try {
    const loginResponse = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testCredentials)
    });

    const loginData = await loginResponse.json();

    if (loginResponse.status === 200 && loginData.success) {
      this.authToken = loginData.data.accessToken;
      console.log('Authentication successful');
    } else {
      console.error('Login failed:', loginData.message);
      throw new Error(`Login failed: ${loginData.message}`);
    }
  } catch (error) {
    console.error(`Login error: ${error.message}`);
    throw new Error(`Authentication failed: ${error.message}`);
  }
});

// Common When steps
When('I send a GET request to {string}', async function (endpoint) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (this.authToken) {
    headers['Authorization'] = `Bearer ${this.authToken}`;
  }

  try {
    this.response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: headers
    });

    this.responseData = await this.response.json();
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
});

// Common Then steps
Then('the response status should be {int}', function (expectedStatus) {
  assert.strictEqual(this.response.status, expectedStatus,
    `Expected status ${expectedStatus}, but got ${this.response.status}`);
});

Then('the response should have the following structure:', function (dataTable) {
  assert(this.responseData, 'Response data should exist');

  const expectedFields = dataTable.hashes();

  expectedFields.forEach(field => {
    const fieldName = field.field;
    const expectedType = field.type;

    assert(this.responseData.hasOwnProperty(fieldName),
      `Response should have field: ${fieldName}`);

    const actualValue = this.responseData[fieldName];
    let actualType = typeof actualValue;

    // Handle special cases
    if (actualType === 'object' && actualValue === null) {
      actualType = 'null';
    } else if (Array.isArray(actualValue)) {
      actualType = 'array';
    }

    assert.strictEqual(actualType, expectedType,
      `Field ${fieldName} should be of type ${expectedType}, but got ${actualType}`);
  });
});

Then('the response should be successful', function () {
  assert(this.responseData, 'Response data should exist');
  assert.strictEqual(typeof this.responseData.success, 'boolean');
  assert(this.responseData.success, 'Response should indicate success');
});

module.exports = {
  testCredentials,
  baseUrl
};
