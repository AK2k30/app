Feature: Sales summary API
  As a health-care startup
  I want to get a salesperson's doctor visit and sample summary
  So that I can view aggregated performance data

  Background:
    Given the API server is running
    And I have valid authentication credentials
    And I am authenticated as a valid user

  Scenario: Get sales summary for a salesperson with a date range
    When I send a GET request to "/api/v1/sales/summary/akashvisit4.0@gmail.com?start=2025-01-01&end=2025-09-01"
    Then the response status should be 200
    And the response should have the following structure:
      | field     | type   |
      | success   | boolean|
      | data      | array  |
      | metadata  | object |
    And the response should be successful
    And the metadata should include total counts