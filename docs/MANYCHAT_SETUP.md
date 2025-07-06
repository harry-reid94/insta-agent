# ManyChat Integration Setup Guide

This guide will help you set up ManyChat with your Instagram DM Agent using External Requests.

## Why ManyChat is Better Than Direct Instagram API

✅ **Simplified Setup**: No Facebook App approval needed  
✅ **Reliable Messaging**: ManyChat handles all Instagram API complexities  
✅ **Built-in Features**: Broadcast lists, automation flows, user management  
✅ **No 24-hour Limit**: ManyChat manages messaging windows automatically  
✅ **Rich Media Support**: Easy buttons, carousels, quick replies  
✅ **Analytics**: Built-in conversation analytics and user insights  

## Prerequisites

1. **Instagram Business Account**: Connected to your Facebook Page
2. **ManyChat Account**: Free or paid plan (Pro recommended for External Requests)
3. **Your Next.js App**: Deployed with HTTPS (required for webhooks)

## Step 1: Set Up ManyChat

### Create ManyChat Account
1. Go to [manychat.com](https://manychat.com)
2. Sign up and connect your Instagram Business account
3. Complete the setup wizard

### Verify Instagram Connection
1. In ManyChat dashboard, go to **Settings** → **Instagram**
2. Ensure your Instagram account shows as "Connected"
3. Test by sending a message to your Instagram account

## Step 2: Create Your Qualification Flow

### Main Flow Structure
1. **Go to Flows** → **Create Flow**
2. **Name**: "BMB Lead Qualification"
3. **Trigger**: User message or keyword

### Flow Steps:
```
1. Greeting → External Request → Response
2. Location Question → External Request → Response  
3. Crypto Interest → External Request → Response
4. Portfolio Size → External Request → Response
5. Pain Points → External Request → Response
6. BMB Understanding → External Request → Response
7. Booking/Nurture → External Request → Final Response
```

## Step 3: Configure External Requests

### For Each Flow Step:
1. **Add Action** → **External Request**
2. **Request Type**: POST
3. **Request URL**: `https://your-domain.com/api/manychat/webhook`
4. **Headers**:
   ```
   Content-Type: application/json
   Authorization: Bearer YOUR_WEBHOOK_SECRET
   ```

### Request Body Template:
```json
{
  "user_id": "{{user_id}}",
  "first_name": "{{first_name}}",
  "last_name": "{{last_name}}",
  "username": "{{username}}",
  "message": "{{last_input_text}}",
  "stage": "greeting",
  "conversation_id": "{{user_id}}_manychat",
  "timestamp": "{{timestamp}}"
}
```

### Response Mapping:
1. **Save Response to Custom Field**: 
   - Field Name: `ai_response`
   - JSONPath: `$.response`
2. **Add Text Action**: Use `{{ai_response}}` as message content

## Step 4: Environment Variables

Add these to your `.env.local`:

```bash
# ManyChat Configuration
MANYCHAT_WEBHOOK_SECRET=your_secure_webhook_secret_here
MANYCHAT_API_TOKEN=your_manychat_api_token_here  # Optional for advanced features
```

## Step 5: Webhook Security

Your webhook should verify requests from ManyChat:

1. **Generate a secure secret**: Use a strong random string
2. **Add to environment**: Set `MANYCHAT_WEBHOOK_SECRET`
3. **Verify in webhook**: Check Authorization header matches

## Step 6: ManyChat Pro Features (Recommended)

### External Requests
- **Free Plan**: Limited external requests
- **Pro Plan**: Unlimited external requests
- **Required for**: Real-time AI responses

### Advanced Features with Pro:
- **Custom Fields**: Store qualification data
- **Tags**: Segment qualified vs unqualified leads
- **Sequences**: Automated follow-up campaigns
- **Broadcasts**: Mass messaging to segments

## Step 7: Flow Configuration Examples

### Greeting Flow Step:
```json
// External Request Body
{
  "user_id": "{{user_id}}",
  "first_name": "{{first_name}}",
  "message": "{{last_input_text}}",
  "stage": "greeting",
  "conversation_id": "{{user_id}}_manychat"
}

// Expected Response
{
  "response": "Hey {{first_name}}! What's good brother! Where are you based?",
  "next_stage": "location",
  "actions": {
    "add_tag": "engaged",
    "set_field": {"stage": "location"}
  }
}
```

### Portfolio Size Flow Step:
```json
// External Request Body  
{
  "user_id": "{{user_id}}",
  "first_name": "{{first_name}}",
  "message": "{{last_input_text}}",
  "stage": "portfolio_size",
  "conversation_id": "{{user_id}}_manychat",
  "previous_answers": {
    "location": "{{cf_location}}",
    "crypto_interest": "{{cf_crypto_interest}}"
  }
}

// Expected Response for Qualified Lead
{
  "response": "Nice! With that portfolio size, BMB could definitely help you. Let me get you booked for a strategy call...",
  "next_stage": "booking",
  "actions": {
    "add_tag": "qualified",
    "set_field": {"is_qualified": "true", "portfolio_size": "250000"},
    "remove_tag": "unqualified"
  }
}
```

## Step 8: Advanced ManyChat Setup

### Custom Fields to Create:
- `stage` (Text): Current conversation stage
- `portfolio_size` (Number): Portfolio amount
- `pain_points` (Text): User's challenges
- `bmb_understanding` (Text): What they know about BMB
- `is_qualified` (Text): "true" or "false"
- `ghl_contact_id` (Text): GoHighLevel contact ID
- `booking_link` (Text): Calendar booking URL

### Tags to Create:
- `engaged`: User actively responding
- `qualified`: Meets portfolio threshold
- `unqualified`: Below portfolio threshold  
- `bmb_prospect`: Qualified and interested
- `booked`: Appointment scheduled
- `nurture`: Needs follow-up content

### Automation Sequences:
1. **Qualified Follow-up**: For users who book calls
2. **Nurture Sequence**: For unqualified leads
3. **Re-engagement**: For users who go cold

## Step 9: Testing Your Integration

### Test External Request:
```bash
# Test your webhook endpoint
curl -X POST https://your-domain.com/api/manychat/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{
    "user_id": "test123",
    "first_name": "John",
    "message": "Hello",
    "stage": "greeting",
    "conversation_id": "test123_manychat"
  }'
```

### Test ManyChat Flow:
1. Message your Instagram account
2. Check ManyChat **Live Chat** to see the conversation
3. Verify External Request logs in **Settings** → **Logs**
4. Check your app logs for webhook processing

## Step 10: Going Live

### Pre-Launch Checklist:
- [ ] ManyChat Pro subscription active
- [ ] All flow steps have External Requests configured
- [ ] Webhook endpoint is live and secure
- [ ] Custom fields and tags created
- [ ] Test conversation completed successfully
- [ ] GoHighLevel integration working
- [ ] Error handling tested

### Launch Process:
1. **Soft Launch**: Test with friends/team members
2. **Monitor Logs**: Watch for any errors or issues
3. **Iterate**: Improve responses based on real conversations
4. **Scale**: Start driving traffic to your Instagram

## Benefits Over Direct Instagram API

### For You:
- **No App Review**: Skip Facebook's approval process
- **Faster Setup**: Working in hours, not weeks
- **Better UX**: ManyChat's interface for monitoring
- **Rich Features**: Buttons, quick replies, broadcasts
- **Analytics**: Built-in conversation metrics

### For Users:
- **Faster Responses**: ManyChat handles delivery
- **Rich Interactions**: Buttons and quick replies
- **Reliable Delivery**: Professional messaging infrastructure
- **Better Experience**: No API rate limit issues

## Troubleshooting

### External Request Failing:
- Check webhook URL is HTTPS and accessible
- Verify Authorization header format
- Check ManyChat logs for error details
- Test webhook endpoint independently

### No Response from AI:
- Check your app logs for errors
- Verify JSON response format
- Ensure response field is mapped correctly
- Test with simple static response first

### ManyChat Not Triggering:
- Check flow is published and active
- Verify trigger keywords if using keyword triggers
- Test by messaging your Instagram directly
- Check Instagram connection in ManyChat settings

## Cost Considerations

### ManyChat Pricing:
- **Free**: Up to 1,000 contacts (limited External Requests)
- **Pro**: $15/month for unlimited External Requests
- **Premium**: $45/month for advanced features

### ROI Calculation:
- If you qualify 1 lead → Close 1 BMB sale = ROI covers ManyChat for years
- Much cheaper than Instagram API development time
- Faster time to market = earlier revenue

This approach is definitely more practical and reliable than direct Instagram API integration!