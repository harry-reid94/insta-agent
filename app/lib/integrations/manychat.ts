import axios from 'axios';
import crypto from 'crypto';

// Get configuration from environment variables
const WEBHOOK_SECRET = process.env.MANYCHAT_WEBHOOK_SECRET || '';
const API_TOKEN = process.env.MANYCHAT_API_TOKEN || '';

interface ManyChatUser {
  user_id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  profile_pic?: string;
}

interface ManyChatWebhookRequest {
  user_id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  message: string;
  stage: string;
  conversation_id: string;
  timestamp?: string;
  previous_answers?: Record<string, any>;
  custom_fields?: Record<string, any>;
}

interface ManyChatResponse {
  response: string;
  next_stage?: string;
  actions?: {
    add_tag?: string | string[];
    remove_tag?: string | string[];
    set_field?: Record<string, any>;
    trigger_flow?: string;
  };
  custom_fields?: Record<string, any>;
  quick_replies?: Array<{
    title: string;
    payload?: string;
  }>;
}

interface ProcessedWebhookData {
  userId: string;
  username: string;
  firstName: string;
  message: string;
  conversationId: string;
  stage: string;
  timestamp: string;
  previousAnswers?: Record<string, any>;
}

export class ManyChatService {
  private webhookSecret: string;
  private apiToken: string;
  private baseUrl = 'https://api.manychat.com/fb';

  constructor(
    webhookSecret: string = WEBHOOK_SECRET,
    apiToken: string = API_TOKEN
  ) {
    this.webhookSecret = webhookSecret;
    this.apiToken = apiToken;
    
    // Warn if credentials are missing
    if (!this.webhookSecret) {
      console.warn('⚠️  ManyChat webhook secret not configured. Please set MANYCHAT_WEBHOOK_SECRET in your .env.local file.');
    }
  }

  // Verify webhook request is from ManyChat
  verifyWebhookAuth(authHeader: string): boolean {
    if (!this.webhookSecret) {
      console.warn('⚠️  ManyChat webhook secret not configured, skipping authentication');
      return true; // Allow in development
    }

    const expectedAuth = `Bearer ${this.webhookSecret}`;
    return authHeader === expectedAuth;
  }

  // Process incoming ManyChat webhook
  processWebhook(webhookData: ManyChatWebhookRequest): ProcessedWebhookData | null {
    try {
      console.log('📨 Processing ManyChat webhook:', JSON.stringify(webhookData, null, 2));

      // Validate required fields
      if (!webhookData.user_id || !webhookData.message || !webhookData.stage) {
        console.error('❌ Missing required fields in ManyChat webhook');
        return null;
      }

      const result: ProcessedWebhookData = {
        userId: webhookData.user_id,
        username: webhookData.username || `user_${webhookData.user_id.slice(-4)}`,
        firstName: webhookData.first_name || 'friend',
        message: webhookData.message,
        conversationId: webhookData.conversation_id || `${webhookData.user_id}_manychat`,
        stage: webhookData.stage && 
             webhookData.stage !== '{{stage}}' && 
             webhookData.stage !== '{{cuf_13287381}}' &&
             !webhookData.stage.includes('{{') 
             ? webhookData.stage : 'greeting',
        timestamp: webhookData.timestamp || new Date().toISOString(),
        previousAnswers: webhookData.previous_answers || {}
      };

      console.log('✅ Processed ManyChat webhook from:', result.username);
      return result;

    } catch (error: any) {
      console.error('❌ Error processing ManyChat webhook:', error.message);
      return null;
    }
  }

  // Create response for ManyChat External Request
  createResponse(
    responseText: string,
    nextStage?: string,
    actions?: ManyChatResponse['actions'],
    quickReplies?: ManyChatResponse['quick_replies']
  ): ManyChatResponse {
    const response: ManyChatResponse = {
      response: responseText
    };

    if (nextStage) {
      response.next_stage = nextStage;
    }

    if (actions) {
      response.actions = actions;
    }

    if (quickReplies && quickReplies.length > 0) {
      response.quick_replies = quickReplies;
    }

    return response;
  }

  // Create response with stage progression
  createStageResponse(
    responseText: string,
    currentStage: string,
    nextStage: string,
    customFields?: Record<string, any>
  ): ManyChatResponse {
    return this.createResponse(
      responseText,
      nextStage,
      {
        set_field: {
          stage: nextStage,
          last_response: responseText,
          ...customFields
        }
      }
    );
  }

  // Create qualification response (qualified leads)
  createQualifiedResponse(
    responseText: string,
    portfolioSize: number,
    ghlContactId?: string,
    bookingLink?: string
  ): ManyChatResponse {
    return this.createResponse(
      responseText,
      'booking',
      {
        add_tag: ['qualified', 'bmb_prospect'],
        remove_tag: 'unqualified',
        set_field: {
          stage: 'booking',
          is_qualified: 'true',
          portfolio_size: portfolioSize.toString(),
          ghl_contact_id: ghlContactId || '',
          booking_link: bookingLink || '',
          qualification_date: new Date().toISOString()
        }
      }
    );
  }

  // Create nurture response (unqualified leads)
  createNurtureResponse(
    responseText: string,
    portfolioSize: number
  ): ManyChatResponse {
    return this.createResponse(
      responseText,
      'nurture',
      {
        add_tag: ['unqualified', 'nurture'],
        remove_tag: 'qualified',
        set_field: {
          stage: 'nurture',
          is_qualified: 'false',
          portfolio_size: portfolioSize.toString(),
          nurture_date: new Date().toISOString()
        }
      }
    );
  }

  // Create booking confirmation response
  createBookingConfirmationResponse(
    responseText: string,
    email: string,
    ghlContactId?: string,
    appointmentId?: string
  ): ManyChatResponse {
    return this.createResponse(
      responseText,
      'completed',
      {
        add_tag: ['booked', 'high_intent'],
        set_field: {
          stage: 'completed',
          email: email,
          booking_confirmed: 'true',
          booking_date: new Date().toISOString(),
          ghl_contact_id: ghlContactId || '',
          ghl_appointment_id: appointmentId || ''
        }
      }
    );
  }

  // Add quick replies for better UX
  createResponseWithQuickReplies(
    responseText: string,
    replies: Array<{ title: string; payload?: string }>
  ): ManyChatResponse {
    return this.createResponse(responseText, undefined, undefined, replies);
  }

  // Extract first name from user data
  extractFirstName(userData: Partial<ManyChatUser>): string {
    if (userData?.first_name) {
      return userData.first_name.charAt(0).toUpperCase() + userData.first_name.slice(1).toLowerCase();
    }
    return userData?.username || 'friend';
  }

  // Send message via ManyChat API (optional - for advanced use cases)
  async sendMessage(userId: string, message: string): Promise<boolean> {
    if (!this.apiToken) {
      console.log(`[ManyChat Test Mode] Would send to ${userId}:`, message);
      console.log(`📝 Message: ${message}`);
      return false; // Indicate API not configured
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/sending/sendContent`,
        {
          subscriber_id: userId,
          data: {
            version: 'v2',
            content: {
              messages: [
                {
                  type: 'text',
                  text: message
                }
              ]
            }
          },
          // Add message tag for Instagram 24h+ window
          message_tag: 'CONFIRMED_EVENT_UPDATE'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        console.log('✅ ManyChat message sent successfully');
        return true;
      }
      
      console.error('❌ ManyChat message failed:', response.status, response.data);
      return false;
    } catch (error: any) {
      console.error('❌ Error sending ManyChat message:', error.response?.data || error.message);
      return false;
    }
  }

  // Get subscriber info via ManyChat API
  async getSubscriberInfo(userId: string): Promise<ManyChatUser | null> {
    if (!this.apiToken) {
      // Return dummy data for testing
      return {
        user_id: userId,
        first_name: 'Test',
        last_name: 'User',
        username: 'test_user'
      };
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/subscriber/getInfo`,
        {
          params: { subscriber_id: userId },
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        console.log('✅ Retrieved ManyChat subscriber info');
        return response.data.data;
      }
      
      return null;
    } catch (error: any) {
      console.error('❌ Error fetching ManyChat subscriber info:', error.response?.data || error.message);
      return null;
    }
  }

  // Add tag to subscriber
  async addTag(userId: string, tag: string): Promise<boolean> {
    if (!this.apiToken) {
      console.log(`[ManyChat Test Mode] Would add tag "${tag}" to ${userId}`);
      return true;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/subscriber/addTag`,
        {
          subscriber_id: userId,
          tag_name: tag
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.status === 200;
    } catch (error: any) {
      console.error('❌ Error adding ManyChat tag:', error.response?.data || error.message);
      return false;
    }
  }

  // Set custom field
  async setCustomField(userId: string, fieldName: string, value: any): Promise<boolean> {
    if (!this.apiToken) {
      console.log(`[ManyChat Test Mode] Would set field "${fieldName}" = "${value}" for ${userId}`);
      return true;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/subscriber/setCustomField`,
        {
          subscriber_id: userId,
          field_name: fieldName,
          field_value: value
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.status === 200;
    } catch (error: any) {
      console.error('❌ Error setting ManyChat custom field:', error.response?.data || error.message);
      return false;
    }
  }

  // Check if ManyChat is properly configured
  isConfigured(): boolean {
    return !!this.webhookSecret;
  }

  // Test ManyChat API connection
  async testConnection(): Promise<{ success: boolean; error?: string; data?: any }> {
    if (!this.apiToken) {
      return { 
        success: false, 
        error: 'ManyChat API token not configured. Webhook-only mode.' 
      };
    }

    try {
      // Test by fetching account info
      const response = await axios.get(
        `${this.baseUrl}/page/getInfo`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return { 
        success: true, 
        data: {
          pageName: response.data.data?.name || 'Unknown',
          pageId: response.data.data?.id || 'Unknown'
        }
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Create error response
  createErrorResponse(errorMessage: string = "Sorry, I'm having trouble processing that. Can you try again?"): ManyChatResponse {
    return {
      response: errorMessage,
      actions: {
        add_tag: 'error_occurred'
      }
    };
  }

  // Create human handoff response
  createHandoffResponse(reason: string = "Let me connect you with a human agent."): ManyChatResponse {
    return {
      response: reason,
      actions: {
        add_tag: ['human_handoff', 'needs_attention'],
        set_field: {
          handoff_reason: reason,
          handoff_time: new Date().toISOString()
        }
      }
    };
  }
}

// Export singleton instance
export const manyChatService = new ManyChatService();

// Helper function to check if ManyChat is properly configured
export function isManyChatConfigured(): boolean {
  return !!WEBHOOK_SECRET;
}