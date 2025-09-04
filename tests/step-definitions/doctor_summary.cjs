const { Then } = require('@cucumber/cucumber');
const assert = require('assert');

Then('each doctor summary item should have the following fields:', function (dataTable) {
  assert(this.responseData && Array.isArray(this.responseData.data), 'Response data should be an array');
  const expectedFields = dataTable.hashes();

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