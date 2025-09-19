const { When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

// Sample summary specific steps
When('I request {string} {string}', async function (method, url) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (this.authToken) {
    headers['Authorization'] = `Bearer ${this.authToken}`;
  }

  try {
    this.response = await fetch(`${this.baseUrl}${url}`, {
      method: method,
      headers: headers
    });

    this.responseData = await this.response.json();
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
});

Then('the response should contain {string} true', function (key) {
  assert(this.responseData, 'Response data should exist');
  assert.strictEqual(this.responseData[key], true, `Expected ${key} to be true`);
});

Then('the response should contain {string}', function (key) {
  assert(this.responseData, 'Response data should exist');
  assert(this.responseData[key] !== undefined, `Response should contain ${key}`);
});

Then('each sample should have {string}, {string}, {string}, {string}, {string}', function (f1, f2, f3, f4, f5) {
  assert(this.responseData && Array.isArray(this.responseData.data), 'Response data should be an array');
  
  for (const item of this.responseData.data) {
    assert(item[f1] !== undefined, `Item should have ${f1}`);
    assert(item[f2] !== undefined, `Item should have ${f2}`);
    assert(item[f3] !== undefined, `Item should have ${f3}`);
    assert(item[f4] !== undefined, `Item should have ${f4}`);
    assert(item[f5] !== undefined, `Item should have ${f5}`);
  }
});

Then('the response metadata should contain {string}', function (key) {
  assert(this.responseData && this.responseData.metadata, 'Response should contain metadata');
  assert(this.responseData.metadata[key] !== undefined, `Metadata should contain ${key}`);
});
