# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Running the Application

```bash
# Development server with Turbopack (recommended for development)
npm run dev

# Production build and start
npm run build
npm start

# Access points
http://localhost:3000          # Main chat interface
http://localhost:3000/dashboard # Lead monitoring dashboard
http://localhost:3000/admin     # Admin conversation interface
```

### Development Commands

```bash
# Install dependencies
npm install

# Linting (currently configured to ignore errors)
npm run lint

# OpenAI fine-tuning workflows
npm run fine-tune  # Run fine-tuning job
npm run list-jobs  # Check fine-tuning status

# Test integrations
curl http://localhost:3000/api/test-ghl        # Test GHL API connectivity
curl http://localhost:3000/api/test-instagram  # Test Instagram API connectivity

# Test webhook locally with ngrok
ngrok http 3000  # Expose localhost for webhook testing
```

### Environment Setup

Create a `.env.local` file with required variables:

```bash
# OpenAI
OPENAI_API_KEY=your_openai_api_key

# ManyChat
MANYCHAT_WEBHOOK_SECRET=your_secure_webhook_secret
MANYCHAT_API_TOKEN=your_manychat_api_token  # Optional for advanced features

# GoHighLevel
GHL_API_KEY=your_ghl_api_key
GHL_LOCATION_ID=your_location_id
GHL_PIPELINE_ID=your_pipeline_id
GHL_INITIAL_STAGE_ID=your_stage_id
GHL_CALENDAR_ID=your_calendar_id

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Note: For local development, dummy values can be used for ManyChat/GoHighLevel integrations as the system includes console logging fallbacks.

## Architecture Overview

This is an Instagram DM automation agent that qualifies leads for BullMarketBlueprint (BMB) using AI-powered conversations that mimic Luke Davis's communication style.

### Core Technology Stack

- **Framework**: Next.js 15.3.3 with App Router, React 19, TypeScript
- **AI/LLM**: OpenAI API (GPT-4o-mini), LangChain, LangGraph for state management
- **Database**: Supabase for conversation logs and lead tracking
- **Messaging Platform**: ManyChat via External Requests (handles Instagram integration)
- **CRM Integration**: GoHighLevel for qualified leads

### Key Architecture Components

1. **LangGraph State Machine** (`/app/lib/graph.ts`)
   - Single `conversationNode` handles all routing logic
   - State includes messages, current stage, collected answers, and metadata
   - Supports human override detection and multi-message responses

2. **Stage Management** (`/app/lib/stages.ts`)
   - Each conversation stage has dedicated handler functions
   - 3-stage qualification flow: Portfolio Size → Pain Points → BMB Understanding
   - $50,000 portfolio size threshold for qualification
   - Gender-aware communication adaptation

3. **Integration Layer** (`/app/lib/integrations/`)
   - ManyChat: Webhook processing and response formatting
   - GoHighLevel: CRM integration for qualified leads
   - Supabase: Persistent storage for conversations and leads

4. **API Routes** (`/app/api/`)
   - `/manychat/webhook` - Receives ManyChat External Requests
   - `/chat` - Development chat interface
   - `/manual-trigger` - Manual conversation initiation
   - `/human-takeover` - Human override functionality

### Important Implementation Details

- Uses temperature 0.7 for conversational responses, 0.2 for analytical tasks
- Maximum 2 reprompt attempts before proceeding in conversation
- Automatic human override for complex financial questions or inappropriate content
- Console logging fallbacks for development (GoHighLevel bookings logged, not sent)
- TypeScript and ESLint errors currently ignored in build (see next.config.ts)

### Conversation Flow

1. **Entry**: User messages Instagram → ManyChat External Request triggered
2. **Processing**: LangGraph determines stage → Calls appropriate handler
3. **Response**: Handler generates JSON response → ManyChat sends to user
4. **Qualification**: Portfolio ≥ $50k → Book call; < $50k → Send nurture content
5. **Actions**: ManyChat applies tags, sets custom fields, triggers sequences
6. **Persistence**: All interactions logged to Supabase

### Development Considerations

- No test suite exists - be careful with modifications
- Use console logs to debug booking flows (dummy integrations in place)
- Check `/data/training_data.jsonl` for conversation examples
- Review `LUKE_STYLE_ANALYSIS.md` for communication style guidelines
- LangGraph configuration in `langgraph.json` specifies Node.js v20
- See `docs/MANYCHAT_SETUP.md` and `docs/MANYCHAT_FLOW_SETUP.md` for ManyChat configuration

When modifying conversation logic, ensure you:
1. Maintain Luke's casual, encouraging communication style
2. Preserve the qualification threshold logic
3. Test responses work with ManyChat External Request format
4. Verify ManyChat actions (tags, custom fields) are properly returned
5. Check human override triggers aren't too sensitive