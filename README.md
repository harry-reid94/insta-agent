# Instagram DM Agent - BullMarketBlueprint Lead Qualification

An automated Instagram DM agent that qualifies leads for BullMarketBlueprint using AI-powered conversations in Luke Davis's signature style.

## Features

✅ **Instagram DM Integration** - Automatically responds to Instagram DMs  
✅ **AI-Powered Qualification** - 3-question flow: Portfolio Size → Pain Points → BMB Understanding  
✅ **Luke Davis Personality** - Conversational, friendly style with Luke's signature phrases  
✅ **GoHighLevel Integration** - Automatically creates contacts and opportunities for qualified leads  
✅ **Human Override Dashboard** - Monitor conversations and take manual control when needed  
✅ **Supabase Logging** - Complete conversation history and analytics  
✅ **Qualification Criteria** - $50k+ portfolio size requirement  
✅ **Booking Link Generation** - Automatic calendar booking for qualified leads  
✅ **Nurture Messaging** - Thoughtful follow-up for unqualified leads  

## Architecture

```
Instagram DM → Webhook → AI Agent → Qualification Flow → GoHighLevel + Booking
                 ↓
            Supabase Logging ← Dashboard ← Human Override
```

## Prerequisites

1. **Instagram Business Account** with API access
2. **GoHighLevel Account** with API access
3. **Supabase Project** for data storage
4. **OpenAI API Key** for AI conversations
5. **Next.js Application** (this repo)

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file with the following variables:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Instagram Graph API Configuration
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_PAGE_ID=your_instagram_page_id
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# GoHighLevel API Configuration
GHL_API_KEY=your_ghl_api_key
GHL_LOCATION_ID=your_ghl_location_id
GHL_PIPELINE_ID=your_ghl_pipeline_id
GHL_INITIAL_STAGE_ID=your_ghl_initial_stage_id
GHL_CALENDAR_ID=your_ghl_calendar_id

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Supabase Database Setup

Create the following tables in your Supabase project:

```sql
-- Conversation logs table
CREATE TABLE conversation_logs (
  id SERIAL PRIMARY KEY,
  instagram_user_id VARCHAR(50) NOT NULL,
  instagram_username VARCHAR(100),
  conversation_id VARCHAR(100) NOT NULL,
  stage VARCHAR(50) NOT NULL,
  message_from VARCHAR(10) NOT NULL CHECK (message_from IN ('user', 'agent')),
  message_content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  metadata JSONB
);

-- Leads table
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  instagram_user_id VARCHAR(50) NOT NULL,
  instagram_username VARCHAR(100),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  conversation_id VARCHAR(100) UNIQUE NOT NULL,
  stage VARCHAR(50) NOT NULL,
  portfolio_size INTEGER,
  pain_points TEXT,
  bmb_understanding TEXT,
  is_qualified BOOLEAN,
  ghl_contact_id VARCHAR(100),
  ghl_opportunity_id VARCHAR(100),
  booking_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  answers JSONB,
  metadata JSONB
);

-- Conversation states table
CREATE TABLE conversation_states (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(100) UNIQUE NOT NULL,
  instagram_user_id VARCHAR(50) NOT NULL,
  current_stage VARCHAR(50) NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  last_question_asked TEXT,
  is_qualified BOOLEAN,
  is_specific BOOLEAN DEFAULT FALSE,
  location VARCHAR(100),
  reprompt_attempts JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversation_logs_conversation_id ON conversation_logs(conversation_id);
CREATE INDEX idx_conversation_logs_timestamp ON conversation_logs(timestamp);
CREATE INDEX idx_leads_conversation_id ON leads(conversation_id);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_is_qualified ON leads(is_qualified);
CREATE INDEX idx_conversation_states_conversation_id ON conversation_states(conversation_id);
```

### 3. Instagram Graph API Setup

1. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add Instagram Graph API product
3. Get your Page Access Token with required permissions:
   - `instagram_basic`
   - `instagram_manage_messages`
   - `pages_messaging`
4. Set up webhook subscription for your Instagram Business account

### 4. GoHighLevel Setup

1. Log into your GoHighLevel account
2. Go to Settings → API → Create API Key
3. Note your Location ID from the URL or API
4. Create a pipeline for BMB leads and note the Pipeline ID and Stage IDs
5. Set up a calendar for bookings and note the Calendar ID

### 5. Installation & Deployment

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

### 6. Webhook Configuration

Set up your Instagram webhook to point to:
```
https://yourdomain.com/api/instagram/webhook
```

Verify token should match your `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.

## Usage

### Automated Flow

1. **New DM Received** → Instagram webhook triggers
2. **AI Greeting** → "Hey {FirstName}! Appreciate the message. Did BullMarketBlueprint catch your attention?"
3. **Rapport Building** → 2 conversational questions to build connection
4. **Qualification Flow**:
   - Q1: "What's your portfolio size/current asset allocation?"
   - Q2: "What pain points are you facing? (exit strategy, too many assets, etc.)"
   - Q3: "What's your understanding of BullMarketBlueprint and what we do?"
5. **Decision**:
   - **Qualified** (≥$50k portfolio) → Create GHL contact/opportunity + send booking link
   - **Unqualified** → Send nurture message with resources
   - **Complex/Specific** → Human override

### Manual Override

Access the dashboard at `/dashboard` to:
- View all conversations and their stages
- See qualified leads and their information
- Manually trigger AI responses
- Take over conversations for human handling
- Monitor analytics and performance

### Human Override Triggers

The AI automatically escalates to human review when:
- User provides highly specific financial terminology
- User asks complex counter-questions
- User describes complicated personal financial situations
- AI cannot understand or parse the response after multiple attempts

## Luke Davis Style Guidelines

The AI agent embodies Luke's conversational style with:
- **Casual phrases**: "bro", "man", "brother", "let's go", "got you"
- **Upbeat energy**: "nice man", "awesome", "sweet"
- **Conversational shortcuts**: "lmk" (let me know), "np" (no problem), "wbu" (what about you)
- **Authentic engagement**: Varies language to avoid repetition
- **Professional but relaxed**: Maintains expertise while being approachable

## Qualification Criteria

### ✅ Qualified Lead Requirements
- Portfolio size ≥ $50,000
- Responds to all 3 qualification questions
- Shows genuine interest in BMB services

### ❌ Disqualification Triggers
- Portfolio size < $50,000
- Gives non-answers or unrelated responses
- Shows no interest in financial planning

### 🤝 Human Override Triggers
- Uses complex financial jargon
- Asks detailed counter-questions
- Describes unique/complicated situations
- Requests specific regulatory information

## Analytics & Monitoring

The dashboard provides:
- **Lead Volume**: Total DMs and qualification rate
- **Conversion Metrics**: Qualified vs unqualified leads
- **Human Override Rate**: How often AI escalates to humans
- **Response Times**: AI response latency
- **Booking Conversion**: Qualified leads who actually book calls

## Troubleshooting

### Instagram Webhook Issues
- Check webhook URL is accessible and returns 200
- Verify webhook token matches environment variable
- Ensure Instagram app has proper permissions

### GoHighLevel Integration
- Verify API key has required permissions
- Check Location ID, Pipeline ID, and Stage ID are correct
- Test API connection with simple requests

### Supabase Connection
- Ensure service role key (not anon key) is used
- Check database tables exist and have proper structure
- Verify Row Level Security (RLS) policies if enabled

## Security Considerations

- **API Keys**: Never commit API keys to version control
- **Webhook Security**: Validate incoming webhook signatures
- **Rate Limiting**: Implement rate limits for API endpoints
- **Data Privacy**: Ensure GDPR/privacy compliance for user data
- **Access Control**: Restrict dashboard access to authorized users

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

Private license - BullMarketBlueprint internal use only.

---

**Questions?** Contact the development team or check the troubleshooting section above.
