module.exports = {
  default: {
    require: ['tests/step-definitions/**/*.cjs'],
    format: [
      'progress-bar',
      'json:reports/cucumber-report.json',
      'html:reports/cucumber-report.html'
    ],
    paths: ['tests/features/**/*.feature'],
    requireModule: ['ts-node/register'],
    worldParameters: {
      baseUrl: 'http://localhost:3003'
    }
  }
};