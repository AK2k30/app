const { Then } = require('@cucumber/cucumber');
const assert = require('assert');

// Products summary specific steps for different entities
Then('each salesperson products summary item should have the following fields:', function (dataTable) {
  validateProductsSummaryItems(this.responseData, dataTable);
});

Then('each organisation products summary item should have the following fields:', function (dataTable) {
  validateProductsSummaryItems(this.responseData, dataTable);
});

Then('each doctor products summary item should have the following fields:', function (dataTable) {
  validateProductsSummaryItems(this.responseData, dataTable);
});

Then('the metadata should include products summary fields', function () {
  assert(this.responseData && this.responseData.metadata, 'Response should contain metadata');
  const m = this.responseData.metadata;
  ['totalSamples', 'totalPeriods'].forEach((key) => {
    assert(m.hasOwnProperty(key), `Metadata should have ${key}`);
    assert.strictEqual(typeof m[key], 'number', `${key} should be a number`);
  });
  assert(m.dateRange && typeof m.dateRange === 'object', 'Metadata should include dateRange');
  assert(m.period && typeof m.period === 'string', 'Metadata should include period');
});

// Helper function for products summary validation
function validateProductsSummaryItems(responseData, dataTable) {
  assert(responseData && Array.isArray(responseData.data), 'Response data should be an array');
  const expectedFields = dataTable.hashes();

  responseData.data.forEach((item, index) => {
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
}
