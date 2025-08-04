Feature: Hospital API Testing
  As a health-tech startup
  I want to manage doctor information
  So that I can maintain accurate doctor records and associations

  Background:
    Given the API server is running
    And I have valid authentication credentials

  Scenario: Get visited hospitals successfully
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/hospitals"
    Then the response status should be 200
    And the response should contain hospital visit information
    And the response should have the following structure:
      | field    | type   |
      | status   | number |
      | success  | boolean|
      | data     | object |
      | message  | string |



  Scenario: Verify hospital data structure
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/hospitals"
    Then the response status should be 200
    And each hospital should have valid location information
    And each hospital should have proper identification

  Scenario: Test hospital visit tracking
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/hospitals"
    Then the response status should be 200
    And the response should contain visit tracking information for hospitals
    And each hospital visit should have timestamp information

  Scenario: Verify hospital address information
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/hospitals"
    Then the response status should be 200
    And hospital information should include address details where available
    And address information should be properly formatted