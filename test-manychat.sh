#!/bin/bash

# Test ManyChat webhook integration
# Usage: ./test-manychat.sh [ngrok-url]

NGROK_URL=${1:-"http://localhost:3000"}
WEBHOOK_SECRET="bD0pCT3/A+0w72LT8KHNpluCtvV7EX+mXfgHE9ZsGj0="

echo "🧪 Testing ManyChat webhook at: $NGROK_URL"
echo ""

# Test 1: Initial greeting
echo "📤 Test 1: Sending initial greeting..."
curl -X POST "$NGROK_URL/api/manychat/webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -d '{
    "user_id": "test_user_123",
    "first_name": "Test",
    "last_name": "User",
    "username": "testuser",
    "gender": "unknown",
    "message": "Hi",
    "stage": "greeting",
    "conversation_id": "test_user_123_manychat",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "previous_answers": {}
  }' | jq '.'

echo ""
echo "✅ Check if response contains:"
echo "   - response text"
echo "   - next_stage: rapport_building"
echo "   - actions.set_field.stage"
echo ""

# Test 2: Continue conversation
read -p "Press enter to continue with rapport building..."
echo ""
echo "📤 Test 2: Continuing conversation..."
curl -X POST "$NGROK_URL/api/manychat/webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -d '{
    "user_id": "test_user_123",
    "first_name": "Test",
    "last_name": "User",
    "username": "testuser",
    "gender": "unknown",
    "message": "interested in crypto trading",
    "stage": "rapport_building",
    "conversation_id": "test_user_123_manychat",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "previous_answers": {}
  }' | jq '.'

echo ""
echo "✅ Check terminal logs for:"
echo "   - Processing message logs"
echo "   - AI response generation"
echo "   - Stage progression"