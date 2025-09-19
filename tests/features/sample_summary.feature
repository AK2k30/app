Feature: Samples Summary API

  Scenario: Fetch samples summary without filters
    Given the API server is running
    When I request "GET" "/api/v1/samples/summary"
    Then the response status should be 200
    And the response should contain "success" true
    And the response should contain "data"
    And each sample should have "sampleHAPLID", "products", "salespocid", "organizationid", "customerid"

  Scenario: Fetch samples summary with date range
    Given the API server is running
    When I request "GET" "/api/v1/samples/summary?start=2025-06-01&end=2025-06-30"
    Then the response status should be 200
    And the response should contain "success" true
    And the response metadata should contain "total"
