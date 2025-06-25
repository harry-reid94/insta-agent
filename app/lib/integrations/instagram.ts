import axios from 'axios';

// Temporarily using dummy values
const dummyAccessToken = 'dummy_token';
const dummyPageId = 'dummy_page_id';

export interface InstagramUser {
  id: string;
  username?: string;
  name?: string;
}

export interface InstagramMessage {
  id: string;
  from: InstagramUser;
  to: InstagramUser;
  message: string;
  timestamp: string;
  attachments?: any[];
}

export interface InstagramDMThread {
  id: string;
  participants: InstagramUser[];
  messages: InstagramMessage[];
}

export class InstagramService {
  private accessToken: string;
  private pageId: string;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(
    accessToken: string = dummyAccessToken,
    pageId: string = dummyPageId
  ) {
    this.accessToken = accessToken;
    this.pageId = pageId;
  }

  // Get conversations (DM threads)
  async getConversations(): Promise<InstagramDMThread[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/${this.pageId}/conversations`, {
        params: {
          access_token: this.accessToken,
          platform: 'instagram',
          fields: 'id,participants,updated_time'
        }
      });

      const conversations = [];
      for (const conversation of response.data.data) {
        const thread = await this.getConversationDetails(conversation.id);
        conversations.push(thread);
      }

      return conversations;
    } catch (error) {
      console.error('Error fetching Instagram conversations:', error);
      throw error;
    }
  }

  // Get specific conversation details
  async getConversationDetails(conversationId: string): Promise<InstagramDMThread> {
    try {
      const [conversationResponse, messagesResponse] = await Promise.all([
        axios.get(`${this.baseUrl}/${conversationId}`, {
          params: {
            access_token: this.accessToken,
            fields: 'id,participants'
          }
        }),
        axios.get(`${this.baseUrl}/${conversationId}/messages`, {
          params: {
            access_token: this.accessToken,
            fields: 'id,from,to,message,created_time,attachments'
          }
        })
      ]);

      const conversation = conversationResponse.data;
      const messages = messagesResponse.data.data.map((msg: any) => ({
        id: msg.id,
        from: msg.from,
        to: msg.to,
        message: msg.message || '',
        timestamp: msg.created_time,
        attachments: msg.attachments?.data || []
      }));

      return {
        id: conversation.id,
        participants: conversation.participants.data,
        messages
      };
    } catch (error) {
      console.error('Error fetching conversation details:', error);
      throw error;
    }
  }

  // Send a message to a conversation
  async sendMessage(conversationId: string, message: string): Promise<boolean> {
    try {
      await axios.post(`${this.baseUrl}/${this.pageId}/messages`, {
        recipient: { id: conversationId },
        message: { text: message }
      }, {
        params: {
          access_token: this.accessToken
        }
      });

      return true;
    } catch (error) {
      console.error('Error sending Instagram message:', error);
      throw error;
    }
  }

  // Send a multi-part conversation response with natural delays
  async sendConversationResponse(conversationId: string, response: string): Promise<boolean> {
    const messages = response.split('\n').filter(msg => msg.trim() !== '');

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        try {
            await this.sendMessage(conversationId, msg);

            // Add a natural delay before sending the next message
            if (i < messages.length - 1) {
                const delay = Math.random() * (2000 - 800) + 800; // Random delay between 0.8s and 2s
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (error) {
            console.error(`Error sending part ${i + 1} of conversation response:`, error);
            // Decide if you want to stop or continue on error
            // For now, we'll stop
            return false;
        }
    }

    return true;
  }

  // Get user information
  async getUserInfo(userId: string): Promise<InstagramUser> {
    try {
      const response = await axios.get(`${this.baseUrl}/${userId}`, {
        params: {
          access_token: this.accessToken,
          fields: 'id,username,name'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching user info:', error);
      throw error;
    }
  }

  // Set up webhook to listen for new messages
  async setupWebhook(webhookUrl: string, verifyToken: string): Promise<boolean> {
    try {
      const response = await axios.post(`${this.baseUrl}/${this.pageId}/subscribed_apps`, {
        subscribed_fields: 'messages',
        callback_url: webhookUrl,
        verify_token: verifyToken
      }, {
        params: {
          access_token: this.accessToken
        }
      });

      return response.data.success;
    } catch (error) {
      console.error('Error setting up webhook:', error);
      throw error;
    }
  }

  // Extract first name from user info
  extractFirstName(user: InstagramUser): string {
    if (user.name) {
      return user.name.split(' ')[0];
    }
    if (user.username) {
      return user.username.replace(/[^a-zA-Z]/g, '');
    }
    return 'there';
  }
}

// Initialize with dummy values for now
export const instagramService = new InstagramService(); 