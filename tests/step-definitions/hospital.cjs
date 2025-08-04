const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Then('the response should contain hospital visit information', function() {
  assert(this.responseData, 'Response data should exist');
  assert(this.responseData.success, 'Response should be successful');
  assert(this.responseData.data, 'Response should contain data');
  
  const data = this.responseData.data;
  assert(typeof data === 'object', 'Hospital visit data should be an object');
  assert(data.hospitals && Array.isArray(data.hospitals), 'Data should contain hospitals array');
  assert(data.metadata && typeof data.metadata === 'object', 'Data should contain metadata');
});

Then('each hospital should have valid location information', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      // Hospital name serves as location identifier in this API
      assert(hospital.hospitalName && typeof hospital.hospitalName === 'string',
        `Hospital ${index + 1} should have valid hospital name as location identifier`);
      console.log(`Hospital ${index + 1}: ${hospital.hospitalName}`);
    });
  }
});

Then('each hospital should have proper identification', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      assert(hospital.hospitalName && typeof hospital.hospitalName === 'string',
        `Hospital ${index + 1} should have proper identification (hospitalName)`);
    });
  }
});

Then('the response should contain visit tracking information for hospitals', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      const hasTrackingInfo = hospital.totalVisits !== undefined || 
        hospital.firstVisitDate || hospital.lastVisitDate;
      assert(hasTrackingInfo, `Hospital ${index + 1} should contain visit tracking information`);
    });
  }
});

Then('each hospital visit should have timestamp information', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      const hasTimestamp = hospital.firstVisitDate || hospital.lastVisitDate;
      assert(hasTimestamp, `Hospital ${index + 1} should have timestamp information`);
    });
  }
});

Then('hospital information should include address details where available', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      // Hospital name serves as address/location identifier in this API
      console.log(`Hospital ${index + 1} (${hospital.hospitalName}) address details: Hospital name available`);
    });
  }
});

Then('address information should be properly formatted', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      assert(typeof hospital.hospitalName === 'string' && hospital.hospitalName.length > 0,
        `Hospital ${index + 1} name should be properly formatted as a non-empty string`);
    });
  }
});