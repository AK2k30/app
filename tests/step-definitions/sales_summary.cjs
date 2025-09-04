const { Then } = require('@cucumber/cucumber');
const assert = require('assert');

Then('the response should be successful', function () {
  assert(this.responseData, 'Response data should exist');
  assert.strictEqual(typeof this.responseData.success, 'boolean');
  assert(this.responseData.success, 'Response should indicate success');
});

Then('each sales doctor summary item should have the following fields:', function (dataTable) {
  assert(this.responseData && Array.isArray(this.responseData.data), 'Response data should be an array');
  const expectedFields = dataTable.hashes();

  // It is acceptable if data is an empty array; only validate if items exist
  this.responseData.data.forEach((item, index) => {
    expectedFields.forEach(field => {
      const fieldName = field.field;
      const expectedType = field.type;

      assert(item.hasOwnProperty(fieldName), `Item ${index + 1} should have field: ${fieldName}`);

      const actualValue = item[fieldName];
      let actualType = typeof actualValue;

      if (actualType === 'object' && actualValue === null) {
        actualType = 'null';
      } else if (Array.isArray(actualValue)) {
        actualType = 'array';
      }

      assert.strictEqual(actualType, expectedType,
        `Item ${index + 1} field ${fieldName} should be ${expectedType}, got ${actualType}`);
    });
  });
});

Then('the metadata salesperson should be {string}', function (email) {
  assert(this.responseData && this.responseData.metadata, 'Response should contain metadata');
  assert.strictEqual(this.responseData.metadata.salesperson, email);
});

Then('the metadata should include total counts', function () {
  assert(this.responseData && this.responseData.metadata, 'Response should contain metadata');
  const m = this.responseData.metadata;
  ['totalVisits', 'totalDoctors', 'totalSamples'].forEach((key) => {
    assert(m.hasOwnProperty(key), `Metadata should have ${key}`);
    assert.strictEqual(typeof m[key], 'number', `${key} should be a number`);
  });
  assert(m.dateRange && typeof m.dateRange === 'object', 'Metadata should include dateRange');
});