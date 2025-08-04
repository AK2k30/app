const { Before, After, BeforeAll, AfterAll } = require('@cucumber/cucumber');

BeforeAll(async function() {
  console.log('Starting Cucumber BDD tests for Visit, Doctor, and Hospital APIs');
  console.log('Base URL:', 'http://localhost:3003');
});

AfterAll(async function() {
  console.log('Cucumber BDD tests completed');
});

Before(async function() {
  // Reset state before each scenario
  this.response = null;
  this.responseData = null;
  this.authToken = null;
});

After(async function(scenario) {
  if (scenario.result.status === 'FAILED') {
    console.log(`Scenario failed: ${scenario.pickle.name}`);
    if (this.responseData) {
      console.log('Response data:', JSON.stringify(this.responseData, null, 2));
    }
  }
});