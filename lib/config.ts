export interface AgentConfig {
  triggerCriteria: {
    platform: string;
    event: string;
    conditions: { type: string; value: string | boolean | string[] }[];
  };
  greetingIntent: string;
  qualificationNodes: QualificationNode[];
  qualificationLogic: {
    type: 'AND' | 'OR';
    rules: { nodeId: string; operator: string; value?: number }[];
  };
  nurtureIntent: string;
  bookingOfferIntent: string;
  humanOverrideRules: { trigger: string; threshold?: number; action?: string }[];
  integrationSettings: {
    messagingApi: { name: string; credentials: Record<string, unknown> };
    crmApi: { name: string; credentials: Record<string, unknown>; leadTagOnCreate: string };
    calendarApi: { name: string; credentials: Record<string, unknown>; calendarId: string };
    notificationEndpoint: { type: string; webhookUrl: string };
  };
  loggingSettings: {
    database: string;
    connectionString: string;
    tables: { conversations: string; leads: string; questionResponses: string };
  };
}

export interface QualificationNode {
  id: string;
  promptIntent: string;
  repromptIntent?: string;
  expectedResponseType: 'numeric' | 'text' | 'multiple-choice' | 'yes/no' | 'range';
  validationRules?: { 
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  highSpecificityDetection: boolean;
  failureRules?: {
    condition: string;
    action: string;
  }[];
  skipRules?: {
    condition: string;
    action: string;
  }[];
  isCritical: boolean;
}

export const defaultConfig: AgentConfig = {
  triggerCriteria: {
    platform: "Instagram",
    event: "DirectMessage",
    conditions: [
      { type: "isFollower",       value: true },
      { type: "containsKeyword",   value: ["pricing", "help", "start"] }
    ]
  },
  greetingIntent: "Greet the user warmly",
  qualificationNodes: [
    {
      "id": "Q1_understanding",
      "promptIntent": "Ask about the user's understanding of BMB (Bull Market Blueprint).",
      "expectedResponseType": "text",
      "highSpecificityDetection": true,
      "isCritical": false
    },
    {
      "id": "Q2_rapport_interest",
      "promptIntent": "Find out what the user's investment goal is.",
      "expectedResponseType": "text",
      "highSpecificityDetection": true,
      "isCritical": false
    },
    {
      "id": "Q3_portfolio_size",
      "promptIntent": "Ask for the user's current investment portfolio size.",
      "repromptIntent": "The user gave a vague answer. Re-ask them for their portfolio size, clarifying that a numerical estimate is needed.",
      "expectedResponseType": "numeric",
      "validationRules": { "minimum": 50000 },
      "highSpecificityDetection": true,
      "isCritical": true
    },
    {
      "id": "Q4_pain_points",
      "promptIntent": "Inquire about the biggest challenges the user is facing with their investments.",
      "expectedResponseType": "text",
      "validationRules": { "minLength": 10 },
      "highSpecificityDetection": true,
      "isCritical": false
    }
  ],
  qualificationLogic: {
    type: "AND",
    "rules": [
      { "nodeId": "Q3_portfolio_size", "operator": ">=", "value": 50000 }
    ]
  },
  nurtureIntent: "The user is not qualified yet. Politely end the conversation, mention that they can learn more on the FAQ page, and that someone will check in with them in a few days.",
  bookingOfferIntent: "The user is qualified. Congratulate them and offer to schedule a 30-minute consultation with a specialist, then provide the booking link.",
  humanOverrideRules: [
    { "trigger": "highSpecificityDetected", "action": "notifyHuman" },
    { "trigger": "nlpConfidenceBelowThreshold", "threshold": 0.7 }
  ],
  integrationSettings: {
    messagingApi: { name: "MockAPI", credentials: {} },
    crmApi: { name: "MockCRM", credentials: {}, leadTagOnCreate: "New DM Lead" },
    calendarApi: { name: "MockCalendar", credentials: {}, calendarId: "primary" },
    notificationEndpoint: { type: "MockEndpoint", webhookUrl: "" }
  },
  loggingSettings: {
    database: "MockDB",
    connectionString: "",
    tables: {
      conversations: "dm_conversations",
      leads: "qualified_leads",
      questionResponses: "lead_responses"
    }
  }
};

// Central guard-rail list: any generated question containing one of these keywords will be rejected and regenerated.
export const DISALLOWED_QUESTION_KEYWORDS = [
  // Contact / social handles
  "email", "e-mail", "phone", "contact", "instagram", "ig", "handle", "username",
  // Premature financial topics
  "portfolio", "investment", "investing", "pricing",
  // Off-topic small-talk that became repetitive noise
  "travel", "favorite", "food", "place", "movie", "hobby"
]; 