# ManyChat Test Setup Guide

## 1. Create Test Automation in ManyChat

### Go to Automation → + New Automation
- Name: "AI Agent Test"
- Trigger: Keyword → "test"

## 2. Add Initial External Request

Click + Action → External Request

### Request Configuration:
**URL:** `https://YOUR-NGROK-URL.ngrok.io/api/manychat/webhook`

**Method:** POST

**Headers:**
```
Key: Authorization
Value: Bearer bD0pCT3/A+0w72LT8KHNpluCtvV7EX+mXfgHE9ZsGj0=

Key: Content-Type
Value: application/json
```

**Body:**
```json
{
  "user_id": "{{user_id}}",
  "first_name": "{{first_name}}",
  "last_name": "{{last_name}}",
  "username": "{{username}}",
  "gender": "{{gender}}",
  "message": "{{last_user_input}}",
  "stage": "{{stage}}",
  "conversation_id": "{{user_id}}_manychat",
  "timestamp": "{{current_time}}",
  "previous_answers": {
    "Q1_bmb_understanding": "{{Q1_bmb_understanding}}",
    "Q2_portfolio_size": "{{Q2_portfolio_size}}",
    "Q3_pain_points": "{{Q3_pain_points}}"
  }
}
```

## 3. Handle the Response

Add Action → Text Message
- Message: `{{external_request.response}}`

Add Action → Set Custom Field (multiple)
- Field: `stage` → Value: `{{external_request.next_stage}}`
- Field: `last_response` → Value: `{{external_request.response}}`

## 4. Create Stage-Based Routing

Add Condition blocks based on `{{external_request.next_stage}}`:

### If next_stage = "rapport_building"
- Continue conversation flow
- Add delay if needed

### If next_stage = "Q1_bmb_understanding"
- Set field: `current_question` → "Q1"
- Continue to collect answer

### If next_stage = "Q2_portfolio_size"
- Set field: `current_question` → "Q2"
- Continue to collect answer

### If next_stage = "Q3_pain_points"
- Set field: `current_question` → "Q3"
- Continue to collect answer

### If next_stage = "booking" or "nurture"
- Apply appropriate tags based on qualification

## 5. Test Flow Sequence

1. **Initial Test:**
   - Send "test" to trigger
   - Should receive greeting response
   - Check custom fields are populated

2. **Full Conversation Test:**
   ```
   User: "test"
   Bot: "nice! what brings you here..."
   User: "interested in crypto"
   Bot: [rapport building response]
   User: "yeah tell me more"
   Bot: "what you know about BullMarketBlueprint?"
   User: "not much"
   Bot: "what's your portfolio size?"
   User: "100k"
   Bot: "what challenges are you facing?"
   User: "timing the market"
   Bot: [qualified response with booking link]
   ```

3. **Check Custom Fields After Each Step:**
   - `stage` should update
   - `Q1_bmb_understanding`, `Q2_portfolio_size`, `Q3_pain_points` should populate
   - `is_qualified` should be "true" if portfolio >= 50k

## 6. Debug Tips

### Monitor in Terminal:
Watch your dev server logs for:
- `📨 ManyChat webhook received`
- `🤖 Processing message`
- `💬 AI generated response`
- `🎯 Lead qualified!` or `📝 Lead marked for nurture`

### Common Issues:
1. **Authentication Failed**: Check Authorization header
2. **Empty Response**: Ensure OpenAI API key is set
3. **Fields Not Updating**: Verify custom field names match exactly
4. **Stage Not Progressing**: Check `next_stage` is being set

## 7. Testing Different Paths

### Test Qualified Lead (portfolio >= $50k):
```
Portfolio: "75000"
Expected: qualified tag, booking link
```

### Test Unqualified Lead (portfolio < $50k):
```
Portfolio: "20k"
Expected: nurture tag, nurture content
```

### Test Edge Cases:
- Unclear portfolio: "not sure"
- Very high portfolio: "2 million"
- Non-numeric: "a decent amount"