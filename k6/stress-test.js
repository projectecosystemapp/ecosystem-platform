import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 400 },  // Ramp up to 400 users
    { duration: '5m', target: 400 },  // Stay at 400 users
    { duration: '2m', target: 600 },  // Ramp up to 600 users
    { duration: '5m', target: 600 },  // Stay at 600 users
    { duration: '2m', target: 800 },  // Ramp up to 800 users
    { duration: '5m', target: 800 },  // Stay at 800 users
    { duration: '10m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'], // 99% of requests should be below 2s
    http_req_failed: ['rate<0.2'],     // Error rate should be below 20%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Heavy load on API endpoints
  const endpoints = [
    '/api/user/status',
    '/api/bookings',
    '/providers',
    '/',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const response = http.get(`${BASE_URL}${endpoint}`);
  
  check(response, {
    'Status is not 5xx': (r) => r.status < 500,
    'Response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  sleep(Math.random() * 2); // Random sleep between 0-2 seconds
}