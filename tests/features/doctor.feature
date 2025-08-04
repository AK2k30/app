Feature: Doctor API Testing
  As a health-tech startup
  I want to manage doctor information
  So that I can maintain accurate doctor records and associations

  Background:
    Given the API server is running
    And I have valid authentication credentials

  Scenario: Get doctor information from hospital data
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/hospitals"
    Then the response status should be 200
    And the response should contain doctor information within hospital data

  Scenario: Verify doctor data structure in hospital visits
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/hospitals"
    Then the response status should be 200
    And the hospital visit data should contain doctor information
    And each doctor reference should have valid identifiers

  Scenario: Test doctor-hospital relationship
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/hospitals"
    Then the response status should be 200
    And each hospital visit should have associated doctor information
    And the doctor-hospital relationship should be valid

  Scenario: Verify doctor specialization data
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/hospitals"
    Then the response status should be 200
    And doctor information should include specialization details where available