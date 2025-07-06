# Simple ManyChat Test Flow

## Create a Basic Test Automation

1. **Go to Automation → + New Automation**
   - Name: "Simple Webhook Test"
   - Trigger: **Default Reply** (catches all messages)

2. **Add External Request**
   - URL: `https://YOUR-NGROK-URL.ngrok.io/api/manychat/webhook`
   - Method: POST
   - Headers:
     ```
     Content-Type: application/json
     Authorization: Bearer bD0pCT3/A+0w72LT8KHNpluCtvV7EX+mXfgHE9ZsGj0=
     ```
   - Body:
     ```json
     {
       "user_id": "{{user_id}}",
       "first_name": "{{first_name}}",
       "message": "{{last_user_input}}",
       "stage": "greeting",
       "conversation_id": "{{user_id}}_test",
       "timestamp": "{{current_time}}"
     }
     ```

3. **Add Text Message**
   - Message: `Bot says: {{external_request.response}}`

4. **Save and Publish**

5. **Test**:
   - Send any message to your page
   - Watch your server logs
   - You should see the webhook being called

## If it's still not working:

1. **Check ManyChat Settings**:
   - Settings → Messenger → Make sure your page is connected
   - Settings → Growth Tools → Check if automation is enabled

2. **Test with Static Response First**:
   Instead of External Request, add a simple Text message "Hello!" to verify the automation triggers

3. **Check Subscription**:
   - Your test account might need to be subscribed
   - Try sending "start" or clicking "Get Started"

## Common Issues:

- **Automation not active**: Make sure it's published/active
- **Wrong trigger**: Default Reply is most reliable for testing
- **Page not responding**: Check Facebook Page settings
- **User not subscribed**: Send "Get Started" first