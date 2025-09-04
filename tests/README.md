# Cucumber BDD Tests for Visit, Doctor, and Hospital APIs

This directory contains Cucumber BDD (Behavior Driven Development) tests for the healthcare sales operations backend APIs, specifically focusing on:

- Visit API (`/api/v1/visit/all`, `/api/v1/visit/hospitals`)
- Doctor API (tested through hospital visit data)
- Hospital API (tested through visit endpoints)
- **NEW**: Sales Person Date Range APIs (`/api/v1/sales/visits/:email`, `/api/v1/sales/hospitals/:email`, `/api/v1/sales/doctors/:email`) with date filtering

## Test Structure

```
tests/
├── features/                    # Gherkin feature files
│   ├── visit.feature            # Visit API test scenarios
│   ├── doctor.feature           # Doctor API test scenarios
│   ├── hospital.feature         # Hospital API test scenarios
│   ├── visit-date-range.feature # NEW: Visit date range API scenarios
│   ├── hospital-date-range.feature # NEW: Hospital date range API scenarios
│   └── doctor-date-range.feature   # NEW: Doctor date range API scenarios
├── step-definitions/            # Step implementations
│   ├── common.cjs               # Common steps (auth, requests, etc.)
│   ├── visit.cjs                # Visit-specific steps
│   ├── doctor.cjs               # Doctor-specific steps
│   ├── hospital.cjs             # Hospital-specific steps
│   ├── date-range-common.cjs    # NEW: Common date range steps
│   ├── visit-date-range.cjs     # NEW: Visit date range steps
│   ├── hospital-date-range.cjs  # NEW: Hospital date range steps
│   └── doctor-date-range.cjs    # NEW: Doctor date range steps
│   └── products_summary.cjs     # NEW: Products summary shared steps
└── support/                     # Test configuration
    ├── world.cjs                # Custom world constructor
    └── hooks.cjs                # Before/After hooks
    
# New products summary feature files
features/
  salesperson_products_summary.feature
  organisation_products_summary.feature
  doctor_products_summary.feature
```

## Prerequisites

1. **Install Dependencies**:
   ```bash
   bun install
   ```

2. **Start the API Server**:
   ```bash
   bun run dev
   ```
   The server should be running on `http://localhost:3003`

3. **Database Setup**:
   - Ensure your MongoDB database is running
   - Run Prisma generate: `bun run prisma:generate`

## Running Tests

### Run All Tests
```bash
bun run test
```

### Run Tests with HTML Report
```bash
bun run test:html
```

### Run Specific Feature
```bash
# Original API tests
npx cucumber-js tests/features/visit.feature
npx cucumber-js tests/features/doctor.feature
npx cucumber-js tests/features/hospital.feature

# NEW: Date Range API tests
npx cucumber-js tests/features/visit-date-range.feature
npx cucumber-js tests/features/hospital-date-range.feature
npx cucumber-js tests/features/doctor-date-range.feature

# Run all date range tests
npx cucumber-js tests/features/*-date-range.feature
```

## Test Configuration

### Authentication
The tests use a mock authentication approach. You may need to update the test credentials in `tests/step-definitions/common.js`:

```javascript
const testCredentials = {
  email: 'test@example.com',
  password: 'testpassword',
  role: 'Admin'
};
```

### Base URL
The default base URL is `http://localhost:3003`. You can modify this in the configuration files if needed.

## Test Scenarios

### Visit API Tests
- ✅ Get all visits successfully
- ✅ Get all visits without authentication (401 error)
- ✅ Get visited hospitals successfully
- ✅ Get visited hospitals without authentication (401 error)
- ✅ Verify visit data structure

### Doctor API Tests
- ✅ Get doctor information from hospital data
- ✅ Verify doctor data structure in hospital visits
- ✅ Test doctor-hospital relationship
- ✅ Verify doctor specialization data

### Hospital API Tests
- ✅ Get visited hospitals successfully
- ✅ Get visited hospitals without authentication (401 error)
- ✅ Verify hospital data structure
- ✅ Test hospital visit tracking
- ✅ Verify hospital address information

### NEW: Sales Person Date Range API Tests

#### Visit Date Range Tests
- ✅ Get visits without date filter
- ✅ Get visits with start date filter
- ✅ Get visits with end date filter
- ✅ Get visits with both start and end date filters
- ✅ Handle invalid date formats
- ✅ Handle invalid date ranges (start > end)
- ✅ Support datetime format filtering
- ✅ Verify response structure with date filtering
- ✅ Verify visits summary information

#### Hospital Date Range Tests
- ✅ Get hospitals without date filter
- ✅ Get hospitals with start date filter
- ✅ Get hospitals with end date filter
- ✅ Get hospitals with both start and end date filters
- ✅ Handle invalid date formats
- ✅ Handle invalid date ranges
- ✅ Verify hospital data structure
- ✅ Verify hospital visit tracking information
- ✅ Verify date range filtering accuracy

#### Doctor Date Range Tests
- ✅ Get doctors without date filter
- ✅ Get doctors with start date filter
- ✅ Get doctors with end date filter
- ✅ Get doctors with both start and end date filters
- ✅ Handle invalid date formats
- ✅ Handle invalid date ranges
- ✅ Verify doctor data structure
- ✅ Verify doctor-hospital relationships
- ✅ Verify visit date filtering accuracy

## Reports

Test reports are generated in the `reports/` directory:
- `cucumber-report.json` - JSON format report
- `cucumber-report.html` - HTML format report (when using `bun run test:html`)

## Troubleshooting

### Common Issues

1. **Server Not Running**:
   - Ensure the API server is running on port 3003
   - Check if all dependencies are installed

2. **Authentication Failures**:
   - Update test credentials in `common.js`
   - Ensure test user exists in the database

3. **Database Connection Issues**:
   - Verify MongoDB is running
   - Check database connection string in `.env`

4. **Missing Dependencies**:
   ```bash
   bun install @cucumber/cucumber @types/node cucumber-html-reporter
   ```

### Debug Mode
To run tests with more verbose output:
```bash
npx cucumber-js --format progress-bar --format json:reports/debug.json
```

## Extending Tests

### Adding New Scenarios
1. Add new scenarios to existing `.feature` files
2. Implement corresponding step definitions in the appropriate `.js` files
3. Use the existing common steps where possible

### Adding New APIs
1. Create a new `.feature` file in `tests/features/`
2. Create corresponding step definitions in `tests/step-definitions/`
3. Update the cucumber configuration if needed

## Best Practices

1. **Keep scenarios focused** - Each scenario should test one specific behavior
2. **Use descriptive names** - Scenario names should clearly describe what is being tested
3. **Reuse common steps** - Leverage existing step definitions where possible
4. **Handle edge cases** - Include tests for error conditions and edge cases
5. **Maintain test data** - Keep test data separate and easily maintainable