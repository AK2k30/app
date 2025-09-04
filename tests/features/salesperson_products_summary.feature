Feature: Salesperson products summary API
  As a beginner tester
  I want to verify the salesperson products summary endpoint
  So that I can be confident the response shape is correct

  Background:
    Given the API server is running
    And I have valid authentication credentials
    And I am authenticated as a valid user

  Scenario: Get salesperson products summary with a date range
    When I send a GET request to "/api/v1/salesperson/products-summary?period=month&start=2025-01-01&end=2025-09-01"
    Then the response status should be 200
    And the response should have the following structure:
      | field     | type    |
      | success   | boolean |
      | message   | string  |
      | data      | array   |
      | metadata  | object  |
    And the response should be successful
    And each salesperson products summary item should have the following fields:
      | field       | type   |
      | period      | string |
      | salesperson | string |
      | summary     | object |
      | products    | array  |
    And the metadata should include products summary fields


