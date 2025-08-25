/**
 * Marketplace Search Agent Example
 * 
 * Demonstrates how to use the agent orchestration system to implement
 * intelligent marketplace search with multi-agent collaboration.
 */

import { useOrchestratorStore } from '../orchestrator';
import { agentRegistry } from '../registry';
import { monitoringSystem } from '../monitoring';
import { createDevelopmentWorkflow, FeatureSize } from '../workflows/development';
import {
  Agent,
  AgentId,
  AgentCapability,
  AgentStatus,
  AgentPriority,
  Task,
  TaskStatus,
  Workflow,
  WorkflowStatus,
  MessageType,
  MessagePriority,
  TaskRequestPayload,
  TaskResponsePayload
} from '../types';

/**
 * Example: Intelligent Marketplace Search Implementation
 * 
 * This example shows how to coordinate multiple agents to:
 * 1. Analyze search queries using NLP
 * 2. Query multiple data sources in parallel
 * 3. Rank and filter results
 * 4. Optimize search performance
 * 5. Learn from user interactions
 */

// Define specialized search agents
class SearchQueryAnalyzer implements Partial<Agent> {
  id = 'agent_search_analyzer' as AgentId;
  name = 'Search Query Analyzer';
  description = 'Analyzes and understands user search queries';
  capabilities = [AgentCapability.DATA_ANALYSIS, AgentCapability.USER_INTERACTION];
  
  async analyzeQuery(query: string): Promise<{
    intent: string;
    entities: string[];
    filters: Record<string, any>;
    confidence: number;
  }> {
    // Simulate NLP analysis
    console.log(`Analyzing query: "${query}"`);
    
    // Extract entities and intent (simplified)
    const entities = query.toLowerCase().split(' ')
      .filter(word => word.length > 3);
    
    const filters: Record<string, any> = {};
    
    // Detect price filters
    const priceMatch = query.match(/under \$?(\d+)|below \$?(\d+)/i);
    if (priceMatch) {
      filters.maxPrice = parseInt(priceMatch[1] || priceMatch[2]);
    }
    
    // Detect location
    const locationKeywords = ['near', 'in', 'around', 'at'];
    locationKeywords.forEach(keyword => {
      if (query.toLowerCase().includes(keyword)) {
        const parts = query.toLowerCase().split(keyword);
        if (parts[1]) {
          filters.location = parts[1].trim().split(' ')[0];
        }
      }
    });
    
    // Detect service type
    const serviceTypes = ['plumbing', 'electrical', 'cleaning', 'repair', 'consultation'];
    const detectedService = serviceTypes.find(service => 
      query.toLowerCase().includes(service)
    );
    if (detectedService) {
      filters.serviceType = detectedService;
    }
    
    return {
      intent: detectedService ? 'service_search' : 'general_search',
      entities,
      filters,
      confidence: 0.85
    };
  }
}

class DatabaseSearchAgent implements Partial<Agent> {
  id = 'agent_db_search' as AgentId;
  name = 'Database Search Agent';
  description = 'Searches marketplace database for providers and services';
  capabilities = [AgentCapability.DATABASE_OPERATIONS, AgentCapability.DATA_ANALYSIS];
  
  async searchProviders(filters: Record<string, any>): Promise<any[]> {
    console.log('Searching database with filters:', filters);
    
    // Simulate database query
    const mockProviders = [
      {
        id: 'provider_1',
        name: 'Expert Plumbing Services',
        rating: 4.8,
        reviews: 156,
        price: 75,
        location: 'downtown',
        serviceType: 'plumbing',
        availability: true
      },
      {
        id: 'provider_2',
        name: 'Quick Fix Plumbers',
        rating: 4.5,
        reviews: 89,
        price: 65,
        location: 'suburbs',
        serviceType: 'plumbing',
        availability: true
      },
      {
        id: 'provider_3',
        name: '24/7 Emergency Plumbing',
        rating: 4.9,
        reviews: 203,
        price: 95,
        location: 'downtown',
        serviceType: 'plumbing',
        availability: false
      }
    ];
    
    // Apply filters
    return mockProviders.filter(provider => {
      if (filters.maxPrice && provider.price > filters.maxPrice) return false;
      if (filters.location && !provider.location.includes(filters.location)) return false;
      if (filters.serviceType && provider.serviceType !== filters.serviceType) return false;
      if (filters.availability !== undefined && provider.availability !== filters.availability) return false;
      return true;
    });
  }
}

class SearchRankingAgent implements Partial<Agent> {
  id = 'agent_search_ranking' as AgentId;
  name = 'Search Ranking Agent';
  description = 'Ranks and scores search results based on relevance';
  capabilities = [AgentCapability.DATA_ANALYSIS, AgentCapability.PERFORMANCE_OPTIMIZATION];
  
  async rankResults(
    results: any[],
    queryAnalysis: any,
    userPreferences?: any
  ): Promise<any[]> {
    console.log('Ranking search results...');
    
    // Score each result
    const scoredResults = results.map(result => {
      let score = 0;
      
      // Rating weight
      score += result.rating * 20;
      
      // Review count weight (logarithmic)
      score += Math.log10(result.reviews + 1) * 10;
      
      // Price competitiveness
      if (queryAnalysis.filters.maxPrice) {
        const priceRatio = 1 - (result.price / queryAnalysis.filters.maxPrice);
        score += priceRatio * 15;
      }
      
      // Availability boost
      if (result.availability) {
        score += 10;
      }
      
      // Location match
      if (queryAnalysis.filters.location && 
          result.location === queryAnalysis.filters.location) {
        score += 15;
      }
      
      // User preference adjustments
      if (userPreferences) {
        if (userPreferences.preferHighRating && result.rating >= 4.7) {
          score += 10;
        }
        if (userPreferences.preferLowPrice && result.price < 70) {
          score += 10;
        }
      }
      
      return { ...result, relevanceScore: score };
    });
    
    // Sort by score
    return scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

class SearchCacheAgent implements Partial<Agent> {
  id = 'agent_search_cache' as AgentId;
  name = 'Search Cache Agent';
  description = 'Manages search result caching for performance';
  capabilities = [AgentCapability.PERFORMANCE_OPTIMIZATION, AgentCapability.DATA_ANALYSIS];
  
  private cache = new Map<string, { results: any[], timestamp: number }>();
  private cacheTimeout = 300000; // 5 minutes
  
  getCachedResults(query: string): any[] | null {
    const cached = this.cache.get(query);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('Cache hit for query:', query);
      return cached.results;
    }
    return null;
  }
  
  cacheResults(query: string, results: any[]): void {
    console.log('Caching results for query:', query);
    this.cache.set(query, {
      results,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    this.cleanCache();
  }
  
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Marketplace Search Orchestration
 * 
 * Coordinates multiple agents to provide intelligent search
 */
export class MarketplaceSearchOrchestrator {
  private queryAnalyzer = new SearchQueryAnalyzer();
  private dbSearchAgent = new DatabaseSearchAgent();
  private rankingAgent = new SearchRankingAgent();
  private cacheAgent = new SearchCacheAgent();
  private orchestratorStore = useOrchestratorStore;
  
  constructor() {
    this.initializeAgents();
    this.setupMonitoring();
  }
  
  private initializeAgents(): void {
    // Register search agents
    const agents = [
      this.createAgent(this.queryAnalyzer),
      this.createAgent(this.dbSearchAgent),
      this.createAgent(this.rankingAgent),
      this.createAgent(this.cacheAgent)
    ];
    
    agents.forEach(agent => {
      agentRegistry.registerAgent(agent);
      this.orchestratorStore.getState().registerAgent(agent);
    });
    
    console.log('Marketplace search agents initialized');
  }
  
  private createAgent(partial: Partial<Agent>): Agent {
    return {
      id: partial.id!,
      name: partial.name!,
      description: partial.description!,
      capabilities: partial.capabilities!,
      status: AgentStatus.IDLE,
      priority: AgentPriority.HIGH,
      version: '1.0.0',
      metadata: {
        createdAt: new Date(),
        lastActiveAt: new Date(),
        totalTasksCompleted: 0,
        averageResponseTime: 50,
        successRate: 0.98,
        maxConcurrentTasks: 10,
        specializations: ['marketplace', 'search']
      },
      config: {
        timeout: 5000,
        retryPolicy: {
          maxRetries: 2,
          backoffMultiplier: 2,
          initialDelay: 100
        },
        resourceLimits: {
          maxMemoryMB: 256,
          maxCPUPercent: 30
        }
      }
    };
  }
  
  private setupMonitoring(): void {
    // Register search-specific metrics
    monitoringSystem.registerMetric({
      name: 'search_queries_total',
      type: 'counter' as any,
      description: 'Total number of search queries processed'
    });
    
    monitoringSystem.registerMetric({
      name: 'search_response_time',
      type: 'histogram' as any,
      description: 'Search query response time',
      unit: 'ms'
    });
    
    monitoringSystem.registerMetric({
      name: 'search_cache_hit_rate',
      type: 'gauge' as any,
      description: 'Cache hit rate for search queries',
      unit: 'percent'
    });
    
    // Set up alerts
    monitoringSystem.registerAlert(
      'Slow Search Response',
      'warning' as any,
      {
        metric: 'search_response_time',
        operator: 'gt',
        threshold: 1000,
        duration: 60000
      },
      'Search response time exceeds 1 second'
    );
  }
  
  /**
   * Execute a marketplace search using multi-agent coordination
   */
  async search(
    query: string,
    userPreferences?: any,
    options?: {
      useCache?: boolean;
      maxResults?: number;
      timeout?: number;
    }
  ): Promise<{
    results: any[];
    metadata: {
      queryAnalysis: any;
      totalFound: number;
      responseTime: number;
      cached: boolean;
    };
  }> {
    const startTime = Date.now();
    console.log(`\n🔍 Executing marketplace search: "${query}"`);
    
    // Check cache first
    if (options?.useCache !== false) {
      const cachedResults = this.cacheAgent.getCachedResults(query);
      if (cachedResults) {
        return {
          results: cachedResults.slice(0, options?.maxResults || 10),
          metadata: {
            queryAnalysis: null,
            totalFound: cachedResults.length,
            responseTime: Date.now() - startTime,
            cached: true
          }
        };
      }
    }
    
    // Create search workflow
    const workflowId = `search_${Date.now()}`;
    const tasks: string[] = [];
    
    // Task 1: Query Analysis
    const analysisTaskId = this.orchestratorStore.getState().createTask({
      type: 'query_analysis',
      title: 'Analyze search query',
      description: `Analyze query: ${query}`,
      status: TaskStatus.PENDING,
      priority: AgentPriority.HIGH,
      requiredCapabilities: [AgentCapability.DATA_ANALYSIS],
      input: { query },
      dependencies: [],
      subtasks: [],
      checkpoints: []
    });
    tasks.push(analysisTaskId);
    
    // Execute query analysis
    const queryAnalysis = await this.queryAnalyzer.analyzeQuery(query);
    
    // Complete analysis task
    this.orchestratorStore.getState().completeTask(analysisTaskId, queryAnalysis);
    
    // Task 2: Database Search (can be parallelized with multiple data sources)
    const searchTaskId = this.orchestratorStore.getState().createTask({
      type: 'database_search',
      title: 'Search database',
      description: 'Search marketplace database',
      status: TaskStatus.PENDING,
      priority: AgentPriority.HIGH,
      requiredCapabilities: [AgentCapability.DATABASE_OPERATIONS],
      input: { filters: queryAnalysis.filters },
      dependencies: [analysisTaskId],
      subtasks: [],
      checkpoints: []
    });
    tasks.push(searchTaskId);
    
    // Execute database search
    const searchResults = await this.dbSearchAgent.searchProviders(queryAnalysis.filters);
    
    // Complete search task
    this.orchestratorStore.getState().completeTask(searchTaskId, searchResults);
    
    // Task 3: Ranking
    const rankingTaskId = this.orchestratorStore.getState().createTask({
      type: 'result_ranking',
      title: 'Rank results',
      description: 'Rank search results by relevance',
      status: TaskStatus.PENDING,
      priority: AgentPriority.MEDIUM,
      requiredCapabilities: [AgentCapability.DATA_ANALYSIS],
      input: { 
        results: searchResults,
        queryAnalysis,
        userPreferences
      },
      dependencies: [searchTaskId],
      subtasks: [],
      checkpoints: []
    });
    tasks.push(rankingTaskId);
    
    // Execute ranking
    const rankedResults = await this.rankingAgent.rankResults(
      searchResults,
      queryAnalysis,
      userPreferences
    );
    
    // Complete ranking task
    this.orchestratorStore.getState().completeTask(rankingTaskId, rankedResults);
    
    // Cache results
    if (options?.useCache !== false) {
      this.cacheAgent.cacheResults(query, rankedResults);
    }
    
    // Update metrics
    const responseTime = Date.now() - startTime;
    monitoringSystem.incrementMetric('search_queries_total');
    monitoringSystem.recordMetric('search_response_time', responseTime);
    
    // Calculate cache hit rate
    const cacheHits = 0; // Would track this over time
    const totalQueries = 1; // Would track this over time
    const hitRate = (cacheHits / totalQueries) * 100;
    monitoringSystem.setGauge('search_cache_hit_rate', hitRate);
    
    console.log(`✅ Search completed in ${responseTime}ms`);
    console.log(`   Found ${rankedResults.length} results`);
    console.log(`   Top result: ${rankedResults[0]?.name || 'None'}`);
    
    return {
      results: rankedResults.slice(0, options?.maxResults || 10),
      metadata: {
        queryAnalysis,
        totalFound: rankedResults.length,
        responseTime,
        cached: false
      }
    };
  }
  
  /**
   * Create a workflow for implementing search improvements
   */
  async improveSearchAlgorithm(): Promise<string> {
    console.log('\n🚀 Creating workflow to improve search algorithm');
    
    const workflow = createDevelopmentWorkflow({
      featureName: 'enhanced-search-algorithm',
      featureDescription: 'Implement ML-based search ranking and query understanding',
      featureSize: FeatureSize.LARGE,
      requiresDesignReview: true,
      requiresSecurityReview: false,
      requiresPerformanceOptimization: true
    });
    
    // Customize workflow for search improvements
    workflow.metadata.tags.push('search', 'ml', 'optimization');
    
    // Register and start workflow
    this.orchestratorStore.getState().registerWorkflow(workflow);
    const executionId = this.orchestratorStore.getState().startWorkflow(workflow.id, {
      priority: 'high',
      team: 'search-team',
      targetMetrics: {
        searchAccuracy: 0.95,
        responseTime: 100,
        cacheHitRate: 0.7
      }
    });
    
    console.log(`   Workflow started: ${executionId}`);
    console.log(`   Estimated duration: ${workflow.metadata.estimatedDuration! / 3600000} hours`);
    
    return executionId;
  }
  
  /**
   * Analyze search performance and generate insights
   */
  async analyzeSearchPerformance(): Promise<{
    metrics: any;
    insights: string[];
    recommendations: string[];
  }> {
    console.log('\n📊 Analyzing search performance...');
    
    const metrics = monitoringSystem.getPerformanceMetrics();
    const insights: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze response times
    if (metrics.taskMetrics.averageDuration > 500) {
      insights.push('Average search response time is above optimal threshold');
      recommendations.push('Consider implementing more aggressive caching');
      recommendations.push('Optimize database queries with better indexing');
    }
    
    // Analyze cache performance
    const cacheHitRate = 0.45; // Would get from actual metrics
    if (cacheHitRate < 0.6) {
      insights.push('Cache hit rate is below target');
      recommendations.push('Increase cache TTL for popular queries');
      recommendations.push('Implement predictive caching for trending searches');
    }
    
    // Analyze error rates
    if (metrics.taskMetrics.errorRate > 0.02) {
      insights.push('Search error rate is elevated');
      recommendations.push('Add retry logic for database timeouts');
      recommendations.push('Implement circuit breakers for external services');
    }
    
    // Analyze agent utilization
    const searchAgentUtilization = 0.75; // Would calculate from actual data
    if (searchAgentUtilization > 0.8) {
      insights.push('Search agents are highly utilized');
      recommendations.push('Scale up search agent pool');
      recommendations.push('Implement query batching for efficiency');
    }
    
    console.log(`   Generated ${insights.length} insights`);
    console.log(`   Provided ${recommendations.length} recommendations`);
    
    return {
      metrics: {
        averageResponseTime: metrics.taskMetrics.averageDuration,
        errorRate: metrics.taskMetrics.errorRate,
        throughput: metrics.taskMetrics.throughput,
        cacheHitRate,
        agentUtilization: searchAgentUtilization
      },
      insights,
      recommendations
    };
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    // Unregister agents
    [
      this.queryAnalyzer.id,
      this.dbSearchAgent.id,
      this.rankingAgent.id,
      this.cacheAgent.id
    ].forEach(agentId => {
      if (agentId) {
        agentRegistry.unregisterAgent(agentId);
        this.orchestratorStore.getState().unregisterAgent(agentId);
      }
    });
    
    console.log('Marketplace search orchestrator disposed');
  }
}

/**
 * Example usage
 */
export async function runMarketplaceSearchExample(): Promise<void> {
  console.log('====================================');
  console.log('Marketplace Search Agent Example');
  console.log('====================================\n');
  
  const searchOrchestrator = new MarketplaceSearchOrchestrator();
  
  try {
    // Example 1: Basic search
    console.log('Example 1: Basic service search');
    const result1 = await searchOrchestrator.search('plumbing services near downtown under $80');
    console.log(`Found ${result1.results.length} results:`);
    result1.results.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name} - $${r.price} (${r.rating}⭐)`);
    });
    
    // Example 2: Search with user preferences
    console.log('\nExample 2: Search with user preferences');
    const result2 = await searchOrchestrator.search(
      'emergency plumbing',
      {
        preferHighRating: true,
        preferLowPrice: false,
        favoriteProviders: ['provider_1']
      },
      {
        maxResults: 5
      }
    );
    console.log(`Query analysis:`, result2.metadata.queryAnalysis);
    
    // Example 3: Cached search (should be faster)
    console.log('\nExample 3: Cached search (repeat query)');
    const result3 = await searchOrchestrator.search('plumbing services near downtown under $80');
    console.log(`Response time: ${result3.metadata.responseTime}ms (cached: ${result3.metadata.cached})`);
    
    // Example 4: Performance analysis
    console.log('\nExample 4: Analyzing search performance');
    const analysis = await searchOrchestrator.analyzeSearchPerformance();
    console.log('Performance Insights:');
    analysis.insights.forEach(insight => console.log(`  - ${insight}`));
    console.log('Recommendations:');
    analysis.recommendations.forEach(rec => console.log(`  - ${rec}`));
    
    // Example 5: Create improvement workflow
    console.log('\nExample 5: Creating search improvement workflow');
    const workflowId = await searchOrchestrator.improveSearchAlgorithm();
    console.log(`Improvement workflow created: ${workflowId}`);
    
  } catch (error) {
    console.error('Search example failed:', error);
  } finally {
    searchOrchestrator.dispose();
  }
  
  console.log('\n====================================');
  console.log('Example completed successfully');
  console.log('====================================');
}

// Run example if this file is executed directly
if (require.main === module) {
  runMarketplaceSearchExample().catch(console.error);
}