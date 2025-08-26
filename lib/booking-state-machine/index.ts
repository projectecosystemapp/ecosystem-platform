/**
 * Booking State Machine Module
 * Centralized exports for booking state management
 * Per Master PRD §4.7
 */

// State definitions
export {
  BookingStates,
  StateConfigurations,
  StateCategories,
  getStateCategory,
  isTerminalState,
  allowsRefund,
  allowsDispute,
  getProviderActionStates,
  getCustomerActionStates,
  type BookingState,
  type StateMetadata
} from './states';

// Transitions
export {
  TransitionEvents,
  ValidTransitions,
  getValidTransitionsFrom,
  isTransitionValid,
  getTargetState,
  executeTransition,
  getAvailableEvents,
  validateTransitionChain,
  type TransitionEvent,
  type StateTransition,
  type TransitionContext
} from './transitions';

// State machine
export {
  BookingStateMachine,
  createStateMachine,
  type BookingContext,
  type StateMachineEvent,
  type StateMachineResult
} from './machine';