# ManyChat Troubleshooting Guide

## When Test Works but Real Messages Don't

### 1. Check Your Automation Trigger
Your automation needs to be:
- **Published/Active** (not in draft mode)
- **Set to trigger on messages**

Common triggers:
- **Keywords**: Must match exactly (case insensitive)
- **Default Reply**: Catches all unmatched messages
- **Message Contains**: Partial match

### 2. Verify the Complete Flow

Your automation should have these steps IN ORDER:

```
[Trigger: Keyword "hello" OR Default Reply]
    ↓
[External Request]
    ↓
[Send Message]
  Text: {{external_request.response}}
    ↓
[Set Custom Field] (optional but recommended)
  Field: stage → {{external_request.actions.set_field.stage}}
```

### 3. Common Issues & Fixes

**Issue: Automation not triggering**
- Check: Is the automation published?
- Fix: Click "Publish" button

**Issue: No response sent**
- Check: Do you have a "Send Message" action after External Request?
- Fix: Add Send Message with {{external_request.response}}

**Issue: User not subscribed**
- Check: Has the user interacted before?
- Fix: User needs to send "Get Started" first

**Issue: Wrong page**
- Check: Is automation on the correct Facebook page?
- Fix: Check page selection in automation

### 4. Debug Checklist

1. **In ManyChat Automation:**
   - [ ] Automation is Published/Active
   - [ ] Trigger is set (Keyword or Default Reply)
   - [ ] External Request is configured
   - [ ] Send Message action exists after External Request
   - [ ] Message text is: {{external_request.response}}

2. **Test Step by Step:**
   - [ ] Send "Get Started" first (if new user)
   - [ ] Send your trigger word (e.g., "hello")
   - [ ] Check server logs for webhook call
   - [ ] Check ManyChat Live Chat for response

3. **Temporary Debug:**
   Add a Text message BEFORE External Request:
   - Text: "Debug: Automation triggered"
   
   If you see this but not the AI response, the issue is with the External Request or response handling.

### 5. Quick Test Flow

Create a NEW simple automation:
1. Trigger: Default Reply
2. Action: Send Message → "Test 1: Automation works"
3. Action: External Request (your webhook)
4. Action: Send Message → "Test 2: {{external_request.response}}"

Send any message. You should see both test messages.

### 6. Check ManyChat Logs

Go to:
- Automation → Your automation → Analytics
- Check if it shows executions
- Look for any errors

### 7. Facebook Page Settings

Ensure:
- Page is published (not unpublished)
- Messaging is enabled
- You're testing with a different account than the page admin