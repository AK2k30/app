Feature: Visit API Testing
  As a healthcare sales system
  I want to manage visit information
  So that I can track sales visits and their outcomes

  Background:
    Given the API server is running
    And I have valid authentication credentials

  Scenario: Get all visits successfully
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/all"
    Then the response status should be 200
    And the response should contain visit information
    And the response should have the following structure:
      | field    | type   |
      | status   | number |
      | success  | boolean|
      | data     | object |
      | message  | string |

  Scenario: Get visited hospitals successfully
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/hospitals"
    Then the response status should be 200
    And the response should contain hospital visit information

  Scenario: Verify visit data structure
    Given I am authenticated as a valid user
    When I send a GET request to "/api/v1/visit/all"
    Then the response status should be 200
    And each visit should have the following fields:
      | field           | type   |
      | id              | string |
      | haplId          | string |
      | salesPersonName | string |
      | visitType       | string |
      | visitStatus     | string |
      | createdAt       | string |