# Instagram ManyChat Workaround

Since Instagram doesn't support {{external_request}} variables, here's an alternative approach:

## Option 1: Custom Field Approach

1. **External Request sets a custom field**
2. **Delay action** (1-2 seconds)
3. **Send Message** using the custom field

### ManyChat Flow:
```
Trigger: Keyword "hello"
    ↓
External Request: (webhook sets 'ai_response' custom field)
    ↓
Delay: 1 second
    ↓
Send Message: {{ai_response}}
```

## Option 2: Multiple Automations

1. **First automation**: External Request only
2. **Second automation**: Triggered by custom field change
3. **Second automation** sends the message

## Option 3: Instagram Business API

Use Instagram's Graph API directly instead of ManyChat's External Request feature.

## Current Test:

We're trying the v2 content format. If External Request processes it correctly, ManyChat should automatically send the message without needing a Send Message action.