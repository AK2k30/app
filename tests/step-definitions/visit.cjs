const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Then('the response should contain visit information', function() {
  assert(this.responseData, 'Response data should exist');
  assert(this.responseData.success, 'Response should be successful');
  assert(this.responseData.data, 'Response should contain data');
  
  const data = this.responseData.data;
  assert(typeof data === 'object', 'Visit data should be an object');
  assert(data.visits && Array.isArray(data.visits), 'Data should contain visits array');
  assert(data.metadata && typeof data.metadata === 'object', 'Data should contain metadata');
});

Then('each visit should have the following fields:', function(dataTable) {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  const expectedFields = dataTable.hashes();
  
  if (data.visits && Array.isArray(data.visits) && data.visits.length > 0) {
    data.visits.forEach((visit, visitIndex) => {
      expectedFields.forEach(field => {
        const fieldName = field.field;
        const expectedType = field.type;
        
        assert(visit.hasOwnProperty(fieldName), 
               `Visit ${visitIndex + 1} should have field: ${fieldName}`);
        
        const actualValue = visit[fieldName];
        let actualType = typeof actualValue;
        
        // Handle special cases
        if (actualType === 'object' && actualValue === null) {
          actualType = 'null';
        } else if (Array.isArray(actualValue)) {
          actualType = 'array';
        } else if (actualValue instanceof Date) {
          actualType = 'string'; // Dates are serialized as strings in JSON
        }
        
        assert.strictEqual(actualType, expectedType, 
               `Visit ${visitIndex + 1} field ${fieldName} should be of type ${expectedType}, but got ${actualType}`);
      });
    });
  } else {
    console.log('No visits found in response data');
  }
});

