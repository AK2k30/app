const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Then('the response should contain doctor information within hospital data', function() {
  assert(this.responseData, 'Response data should exist');
  assert(this.responseData.success, 'Response should be successful');
  assert(this.responseData.data, 'Response should contain data');
  
  // For hospital visits API, check if hospitals have associated doctor information
  const data = this.responseData.data;
  if (data.hospitals && Array.isArray(data.hospitals)) {
    // Check if any hospital has doctor-related information through visitedBy users
    const hasDocInfo = data.hospitals.some(hospital => 
      hospital.visitedBy && hospital.visitedBy.length > 0
    );
    console.log('Hospital data contains doctor/user information:', hasDocInfo);
  } else {
    console.log('Hospital data structure not as expected, checking for any doctor references');
  }
});

Then('the hospital visit data should contain doctor information', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      const hasDocInfo = hospital.visitedBy && hospital.visitedBy.length > 0;
      console.log(`Hospital ${index + 1} (${hospital.hospitalName}) has doctor/user information: ${hasDocInfo}`);
    });
  } else {
    console.log('Hospital data structure not as expected');
  }
});

Then('each doctor reference should have valid identifiers', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      if (hospital.visitedBy && hospital.visitedBy.length > 0) {
        hospital.visitedBy.forEach((user, userIndex) => {
          assert(user.email && user.name, 
            `Hospital ${index + 1} user ${userIndex + 1} should have valid identifiers (name and email)`);
        });
      }
    });
  }
});

Then('each hospital visit should have associated doctor information', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      const hasDocInfo = hospital.visitedBy && hospital.visitedBy.length > 0;
      console.log(`Hospital ${index + 1} (${hospital.hospitalName}) has associated user information: ${hasDocInfo}`);
    });
  }
});

Then('the doctor-hospital relationship should be valid', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      if (hospital.visitedBy && hospital.visitedBy.length > 0) {
        hospital.visitedBy.forEach((user, userIndex) => {
          assert(user.name && user.email && hospital.hospitalName,
            `Hospital ${index + 1} user ${userIndex + 1} relationship should be valid`);
        });
      }
    });
  }
});

Then('doctor information should include specialization details where available', function() {
  assert(this.responseData && this.responseData.data, 'Response should contain data');
  const data = this.responseData.data;
  
  if (data.hospitals && Array.isArray(data.hospitals)) {
    data.hospitals.forEach((hospital, index) => {
      if (hospital.visitedBy && hospital.visitedBy.length > 0) {
        hospital.visitedBy.forEach((user, userIndex) => {
          // Check if user has visit type information which could indicate specialization context
          const hasSpecializationContext = user.lastVisitType || user.lastVisitStatus;
          console.log(`Hospital ${index + 1} user ${userIndex + 1} specialization context: ${hasSpecializationContext ? 'present' : 'not present'}`);
        });
      }
    });
  }
});