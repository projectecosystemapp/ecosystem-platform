#!/bin/bash

# Setup Stripe webhooks with ngrok URL
# This script configures Stripe CLI to forward webhooks to your ngrok tunnel

NGROK_URL="https://24f4f1c8aa5f.ngrok-free.app"

echo "🔧 Setting up Stripe webhooks with ngrok..."
echo "📡 Ngrok URL: $NGROK_URL"
echo ""

# Stop any existing Stripe listeners
echo "⏹️ Stopping existing Stripe listeners..."
pkill -f "stripe listen" 2>/dev/null || true
sleep 2

echo ""
echo "🚀 Starting Stripe webhook forwarding..."
echo ""

# Start listening for regular Stripe webhooks
echo "1️⃣ Starting main Stripe webhook listener..."
stripe listen --forward-to "$NGROK_URL/api/stripe/webhooks" \
  --events payment_intent.succeeded,payment_intent.payment_failed,checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted &

MAIN_PID=$!
echo "   ✅ Main webhook listener started (PID: $MAIN_PID)"

# Give it a moment to start
sleep 3

# Start listening for Stripe Connect webhooks
echo ""
echo "2️⃣ Starting Stripe Connect webhook listener..."
stripe listen --forward-to "$NGROK_URL/api/stripe/connect/webhooks" \
  --events account.updated,account.application.authorized,account.application.deauthorized,capability.updated,payment_intent.succeeded,payment_intent.payment_failed,payout.created,payout.failed,payout.paid &

CONNECT_PID=$!
echo "   ✅ Connect webhook listener started (PID: $CONNECT_PID)"

echo ""
echo "✅ Stripe webhooks are now forwarding to your ngrok tunnel!"
echo ""
echo "📝 Important URLs:"
echo "   - Public app URL: $NGROK_URL"
echo "   - Test marketplace: $NGROK_URL/test-marketplace"
echo "   - Provider onboarding: $NGROK_URL/providers/onboarding"
echo "   - Health check: $NGROK_URL/api/health"
echo ""
echo "🔑 Webhook endpoints:"
echo "   - Main webhooks: $NGROK_URL/api/stripe/webhooks"
echo "   - Connect webhooks: $NGROK_URL/api/stripe/connect/webhooks"
echo ""
echo "💡 Tips:"
echo "   - Keep this terminal open to maintain webhook forwarding"
echo "   - Test payments will now trigger local webhook handlers"
echo "   - Check Stripe Dashboard for webhook event logs"
echo "   - Use Ctrl+C to stop all listeners"
echo ""
echo "🎯 Ready for testing! Try creating a test payment or onboarding a provider."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping Stripe listeners..."
    kill $MAIN_PID 2>/dev/null
    kill $CONNECT_PID 2>/dev/null
    echo "✅ Cleanup complete"
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Wait for processes
wait