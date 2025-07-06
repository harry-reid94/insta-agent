# GoHighLevel Setup Guide

This guide will help you set up GoHighLevel (GHL) for the Instagram DM Agent integration.

## Prerequisites

You need a GoHighLevel account. If you don't have one:
1. Sign up at https://www.gohighlevel.com/
2. Choose a plan that includes API access (most paid plans include this)

## Step 1: Get Your API Key

1. Log into your GoHighLevel account
2. Click on your **Sub-Account** name in the top-left corner
3. Go to **Settings** → **Business Profile**
4. Scroll down to find **API Key** section
5. Click **Generate API Key** if you don't have one
6. Copy and save your API key securely

## Step 2: Get Your Location ID

1. While in **Settings** → **Business Profile**
2. Look for **Company ID** or **Location ID** (usually a long alphanumeric string)
3. Copy this ID - you'll need it for the integration

## Step 3: Create a Pipeline for Instagram Leads

1. Go to **Opportunities** → **Pipelines**
2. Click **+ Add Pipeline**
3. Name it "Instagram DM Leads" or similar
4. Add these stages:
   - Stage 1: "New Lead" (for fresh qualified leads)
   - Stage 2: "Contacted" 
   - Stage 3: "Appointment Scheduled"
   - Stage 4: "Consultation Complete"
   - Stage 5: "Won" / "Lost"
5. Save the pipeline
6. Copy the Pipeline ID from the URL or pipeline settings

## Step 4: Get Pipeline Stage IDs

1. Click on each stage in your pipeline
2. In the stage settings, find the Stage ID
3. Copy the Stage ID for "New Lead" - this is your `GHL_INITIAL_STAGE_ID`

## Step 5: Create a Calendar for Bookings

1. Go to **Calendars** → **Calendar Settings**
2. Click **+ Add Calendar**
3. Configure:
   - Name: "BMB Strategy Call" or similar
   - Duration: 30-45 minutes (your preference)
   - Availability: Set your available times
   - Time zone: Your business timezone
4. In **Form Settings**:
   - Enable email field (required)
   - Add any other fields you want
5. Save and copy the Calendar ID from the settings

## Step 6: Create Custom Fields (Optional but Recommended)

1. Go to **Settings** → **Custom Fields**
2. Add these custom fields for Contacts:
   - `instagram_username` (Text)
   - `portfolio_size` (Number/Currency)
   - `pain_points` (Text Area)
   - `bmb_understanding` (Text Area)
   - `qualification_date` (Date)
   - `lead_source` (Dropdown with "Instagram DM" option)

## Step 7: Environment Variables

Add these to your `.env.local` file:

```bash
# GoHighLevel Configuration
GHL_API_KEY=your_api_key_here
GHL_LOCATION_ID=your_location_id_here
GHL_PIPELINE_ID=your_pipeline_id_here
GHL_INITIAL_STAGE_ID=your_new_lead_stage_id_here
GHL_CALENDAR_ID=your_calendar_id_here
```

## Step 8: API Version Note

The integration uses GoHighLevel API v1. GHL is transitioning to v2, but v1 is still supported. The endpoints used are:

- POST `/contacts/` - Create contacts
- POST `/opportunities/` - Create opportunities  
- GET `/calendars/{id}/free-slots` - Get available times
- POST `/appointments/` - Create bookings

## Testing Your Setup

1. Use the GHL API documentation to test your credentials:
   https://highlevel.stoplight.io/docs/integrations/

2. Test creating a contact:
```bash
curl -X POST https://rest.gohighlevel.com/v1/contacts/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Contact",
    "email": "test@example.com",
    "locationId": "YOUR_LOCATION_ID"
  }'
```

## Troubleshooting

### Common Issues:

1. **401 Unauthorized**: Check your API key is correct and active
2. **404 Not Found**: Verify your location ID, pipeline ID, and calendar ID
3. **400 Bad Request**: Check required fields are included
4. **Rate Limits**: GHL has rate limits (typically 1 request/second)

### Webhook Configuration (Future Enhancement)

For real-time updates from GHL back to your app:
1. Go to **Settings** → **Webhooks**
2. Add webhook URL: `https://your-domain.com/api/gohighlevel/webhook`
3. Select events to listen for:
   - Contact Created/Updated
   - Opportunity Created/Updated
   - Appointment Scheduled/Cancelled

## Support

- GHL API Documentation: https://highlevel.stoplight.io/docs/integrations/
- GHL Support: support@gohighlevel.com
- Community: https://www.facebook.com/groups/gohighlevelofficial