# ManyChat Debug Flow

## Create a Debug Automation to Test

### 1. Create New Automation
- Name: "Debug Webhook"
- Trigger: Keyword → "debug"

### 2. Add These Actions IN ORDER:

**Action 1: Send Message**
```
Step 1: Automation triggered ✅
```

**Action 2: External Request**
- Your webhook settings (same as before)

**Action 3: Send Message**
```
Step 2: External Request completed ✅
Raw response: {{external_request}}
```

**Action 4: Send Message**
```
Step 3: Checking fields...
Response field: {{external_request.response}}
Next stage: {{external_request.next_stage}}
```

**Action 5: Condition**
- IF `{{external_request.response}}` is not empty
- THEN: Send Message → `Step 4: Found response: {{external_request.response}}`
- ELSE: Send Message → `Step 4: ERROR - No response field found`

### 3. Test It
1. Send "debug" to your page
2. You should see all 4-5 messages
3. This will show exactly what ManyChat is receiving

## Common Issues We're Checking:

1. **External Request not completing** - You won't see Step 2
2. **Response structure wrong** - Step 2 will show the actual structure
3. **Field name wrong** - Step 3 will show empty
4. **Condition logic needed** - Step 4 will clarify

## Alternative: Try Different Response Formats

If the above doesn't work, let's test if ManyChat expects a different format. In your webhook, try returning:

```json
{
  "messages": [
    {
      "text": "Your message here"
    }
  ]
}
```

Or even simpler:

```json
{
  "text": "Your message here"
}
```

## Quick Check:
Are you using ManyChat's Instagram integration or Messenger? The field names might be different for Instagram.