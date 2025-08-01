import { NextRequest, NextResponse } from 'next/server';

// Test endpoint to verify GoHighLevel webhook integration
export async function GET(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  const webhookUrl = `${baseUrl}/api/gohighlevel/webhook`;

  // Example webhook payloads that GoHighLevel might send
  const examplePayloads = {
    newMessage: {
      contact_id: "test-contact-123",
      first_name: "John",
      last_name: "Doe",
      instagram_username: "johndoe",
      message: "Hey, I'm interested in learning more about BMB",
      stage: "greeting",
      conversation_id: "conv-123",
      custom_fields: {
        stage: "greeting",
        gender: "male"
      }
    },
    portfolioResponse: {
      contact_id: "test-contact-123",
      first_name: "John",
      instagram_username: "johndoe",
      message: "I have about $75k to invest",
      stage: "Q2_portfolio_size",
      custom_fields: {
        stage: "Q2_portfolio_size",
        answers: JSON.stringify({
          Q1_bmb_understanding: "I know it's about investing but want to learn more"
        })
      }
    },
    qualifiedLead: {
      contact_id: "test-contact-123",
      first_name: "John",
      instagram_username: "johndoe",
      message: "My biggest challenge is finding good investment opportunities",
      stage: "Q3_pain_points",
      custom_fields: {
        stage: "Q3_pain_points",
        answers: JSON.stringify({
          Q1_bmb_understanding: "I know it's about investing but want to learn more",
          Q2_portfolio_size: 75000
        })
      }
    }
  };

  const testInstructions = `
# GoHighLevel Webhook Test Endpoint

## Webhook URL
${webhookUrl}

## Configuration Required
1. Set GHL_WEBHOOK_SECRET in your .env.local file (optional for testing)
2. Configure GoHighLevel webhook to point to: ${webhookUrl}
3. Set webhook trigger for Instagram DM events

## Testing with curl

### Test 1: Initial greeting
\`\`\`bash
curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \\
  -d '${JSON.stringify(examplePayloads.newMessage, null, 2)}'
\`\`\`

### Test 2: Portfolio response
\`\`\`bash
curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \\
  -d '${JSON.stringify(examplePayloads.portfolioResponse, null, 2)}'
\`\`\`

### Test 3: Qualified lead
\`\`\`bash
curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \\
  -d '${JSON.stringify(examplePayloads.qualifiedLead, null, 2)}'
\`\`\`

## Expected Response Format
\`\`\`json
{
  "message": "AI response text here",
  "stage": "next_stage",
  "is_qualified": true/false,
  "custom_fields": {
    "stage": "current_stage",
    "is_qualified": "true/false",
    "portfolio_size": "amount",
    // ... other fields
  },
  "contact_update": {
    "custom_fields": { ... }
  }
}
\`\`\`

## GoHighLevel Webhook Configuration

1. In GoHighLevel, go to Settings > Webhooks
2. Create new webhook with:
   - URL: ${webhookUrl}
   - Events: Instagram DM Received (or similar)
   - Headers: Authorization: Bearer YOUR_WEBHOOK_SECRET

3. Map custom fields in GoHighLevel:
   - stage (text)
   - is_qualified (text/boolean)
   - portfolio_size (number)
   - bmb_understanding (text)
   - pain_points (text)
   - answers (text/json)

## Notes
- The webhook expects contact_id or user_id to identify the user
- Message content should be in 'message' or 'text' field
- Custom fields are used to maintain conversation state
- Responses include updates for GoHighLevel contact records
`;

  return new NextResponse(testInstructions, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

// Test POST endpoint to simulate GoHighLevel webhook
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Forward to actual webhook endpoint
    const webhookUrl = new URL('/api/gohighlevel/webhook', req.url);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('authorization') || '',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    
    return NextResponse.json({
      test: true,
      webhookResponse: result,
      status: response.status,
      message: 'Test webhook forwarded successfully'
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Test failed',
      message: error.message
    }, { status: 500 });
  }
}