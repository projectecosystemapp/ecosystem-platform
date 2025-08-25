import { MonitoringSystem, MetricType } from './lib/agents/monitoring';

const monitoring = new MonitoringSystem();

// Register a gauge metric
monitoring.registerMetric({
  name: 'test_metric',
  type: MetricType.GAUGE,
  description: 'Test metric',
  unit: 'units'
});

console.log('Registered metric');

// Set the gauge value
monitoring.setGauge('test_metric', 42);

console.log('Set gauge value');

// Export metrics
const output = monitoring.exportPrometheusMetrics();
console.log('Prometheus output:');
console.log(output);
console.log('\nChecking for test_metric:', output.includes('test_metric'));
console.log('Checking for value 42:', output.includes('42'));
