const { setWorldConstructor } = require('@cucumber/cucumber');

class CustomWorld {
  constructor() {
    this.response = null;
    this.responseData = null;
    this.authToken = null;
    this.baseUrl = 'http://localhost:3003';
  }

  async makeRequest(method, endpoint, body = null, headers = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    if (this.authToken) {
      defaultHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    const options = {
      method,
      headers: defaultHeaders
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      this.response = await fetch(`${this.baseUrl}${endpoint}`, options);
      this.responseData = await this.response.json();
      return this.response;
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  setAuthToken(token) {
    this.authToken = token;
  }

  getResponseData() {
    return this.responseData;
  }

  getResponse() {
    return this.response;
  }
}

setWorldConstructor(CustomWorld);