import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate should be below 10%
    errors: ['rate<0.1'],              // Custom error rate below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test scenarios
export default function () {
  // Scenario 1: Homepage visit
  let response = http.get(`${BASE_URL}/`);
  check(response, {
    'Homepage loads successfully': (r) => r.status === 200,
    'Homepage loads quickly': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Scenario 2: Browse providers
  response = http.get(`${BASE_URL}/providers`);
  check(response, {
    'Providers page loads': (r) => r.status === 200,
    'Providers page has content': (r) => r.body.includes('provider'),
  }) || errorRate.add(1);
  
  sleep(2);
  
  // Scenario 3: View provider profile
  response = http.get(`${BASE_URL}/providers/test-provider`);
  check(response, {
    'Provider profile loads': (r) => r.status === 200 || r.status === 404,
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Scenario 4: API endpoint test
  response = http.get(`${BASE_URL}/api/user/status`);
  check(response, {
    'API responds': (r) => r.status === 200 || r.status === 401,
    'API response is JSON': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('application/json'),
  }) || errorRate.add(1);
  
  sleep(1);
}

// Stress test scenario
export function stressTest() {
  const responses = http.batch([
    ['GET', `${BASE_URL}/`],
    ['GET', `${BASE_URL}/providers`],
    ['GET', `${BASE_URL}/api/user/status`],
  ]);
  
  responses.forEach((response) => {
    check(response, {
      'Status is not 5xx': (r) => r.status < 500,
    }) || errorRate.add(1);
  });
}

// Spike test scenario
export function spikeTest() {
  // Simulate sudden traffic spike
  for (let i = 0; i < 10; i++) {
    http.get(`${BASE_URL}/`);
  }
}