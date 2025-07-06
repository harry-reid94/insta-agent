# ManyChat External Request Debug Steps

## Step 1: Check if External Request is Actually Running

In your ManyChat automation, add these messages IN ORDER:

1. **Before External Request:**
   ```
   Message: "About to call webhook..."
   ```

2. **External Request** (your webhook)

3. **After External Request:**
   ```
   Message: "Webhook called. Raw response: {{external_request}}"
   ```

4. **Then:**
   ```
   Message: "Response field: {{external_request.response}}"
   ```

## What This Will Show:

- **If you only see message 1**: External Request is failing completely
- **If you see messages 1 & 3 but 3 is empty**: Webhook not returning data
- **If message 3 shows data**: We can see the exact structure

## Step 2: Check ManyChat External Request Settings

Verify these exact settings in ManyChat:

### URL:
```
https://YOUR-NGROK-URL.ngrok.io/api/manychat/webhook
```

### Method:
```
POST
```

### Headers:
```
Content-Type: application/json
Authorization: Bearer bD0pCT3/A+0w72LT8KHNpluCtvV7EX+mXfgHE9ZsGj0=
```

### Body:
```json
{
  "user_id": "{{user_id}}",
  "first_name": "{{first_name}}",
  "message": "{{last_user_input}}",
  "stage": "greeting",
  "conversation_id": "{{user_id}}_test"
}
```

## Step 3: Check Server Logs

When you send "hello", you should see in terminal:
```
🔐 Auth header received: Bearer bD0pCT3/A+0w7...
📦 Raw request body: {"user_id":"123",...}
📨 ManyChat webhook received and authenticated
💬 AI generated response: nice! what brings you here...
✅ ManyChat webhook processing completed successfully
POST /api/manychat/webhook 200 in XXXms
```

## Step 4: Check ManyChat Live Chat

Go to ManyChat → Live Chat and watch the conversation in real-time. You should see:
- Your message
- Bot's responses (if any)
- Any error indicators

## Step 5: Alternative Response Format

If nothing works, let's try the absolute simplest format. Temporarily modify your webhook to return just:

```json
{
  "text": "Simple test message"
}
```

Then use `{{external_request.text}}` in ManyChat.