Feature: Doctors summary API
  As a health-care startup
  I want to get aggregated doctor visit and sample information
  So that I can view doctor-level performance

  Background:
    Given the API server is running
    And I have valid authentication credentials
    And I am authenticated as a valid user

  Scenario: Get doctors summary with a date range
    When I send a GET request to "/api/v1/doctors/summary?start=2025-01-01&end=2100-09-01"
    Then the response status should be 200
    And the response should have the following structure:
      | field     | type   |
      | success   | boolean|
      | message   | string |
      | data      | array  |
      | metadata  | object |
    And the response should be successful
    And the metadata should include total counts

