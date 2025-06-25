import { createClient } from '@supabase/supabase-js';

// Temporarily using dummy values
const dummySupabaseUrl = 'https://dummy.supabase.co';
const dummySupabaseKey = 'dummy_key';

export interface ConversationLog {
  id?: string;
  instagram_user_id: string;
  instagram_username?: string;
  conversation_id: string;
  stage: string;
  message_from: 'user' | 'agent';
  message_content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface LeadData {
  id?: string;
  instagram_user_id: string;
  instagram_username?: string;
  first_name?: string;
  last_name?: string;
  conversation_id: string;
  stage: string;
  portfolio_size?: number;
  pain_points?: string;
  bmb_understanding?: string;
  is_qualified?: boolean;
  ghl_contact_id?: string;
  ghl_opportunity_id?: string;
  booking_link?: string;
  created_at?: string;
  updated_at?: string;
  answers?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ConversationState {
  id?: string;
  conversation_id: string;
  instagram_user_id: string;
  current_stage: string;
  answers: Record<string, any>;
  last_question_asked?: string;
  is_qualified?: boolean;
  is_specific?: boolean;
  location?: string;
  reprompt_attempts?: Record<string, number>;
  created_at?: string;
  updated_at?: string;
}

export class SupabaseService {
  private supabase;

  constructor(
    supabaseUrl: string = dummySupabaseUrl, 
    supabaseKey: string = dummySupabaseKey
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Log conversation messages
  async logMessage(log: ConversationLog): Promise<ConversationLog> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_logs')
        .insert([{
          ...log,
          timestamp: log.timestamp || new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error logging message:', error);
      throw error;
    }
  }

  // Get conversation history
  async getConversationHistory(conversationId: string): Promise<ConversationLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_logs')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      throw error;
    }
  }

  // Create or update lead data
  async upsertLead(lead: LeadData): Promise<LeadData> {
    try {
      const { data, error } = await this.supabase
        .from('leads')
        .upsert({
          ...lead,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'conversation_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error upserting lead:', error);
      throw error;
    }
  }

  // Get lead by conversation ID
  async getLeadByConversationId(conversationId: string): Promise<LeadData | null> {
    try {
      const { data, error } = await this.supabase
        .from('leads')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error fetching lead:', error);
      throw error;
    }
  }

  // Save conversation state
  async saveConversationState(state: ConversationState): Promise<ConversationState> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_states')
        .upsert({
          ...state,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'conversation_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving conversation state:', error);
      throw error;
    }
  }

  // Get conversation state
  async getConversationState(conversationId: string): Promise<ConversationState | null> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_states')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error fetching conversation state:', error);
      throw error;
    }
  }

  // Get qualified leads
  async getQualifiedLeads(limit: number = 50): Promise<LeadData[]> {
    try {
      const { data, error } = await this.supabase
        .from('leads')
        .select('*')
        .eq('is_qualified', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching qualified leads:', error);
      throw error;
    }
  }

  // Get leads requiring human override
  async getHumanOverrideLeads(limit: number = 20): Promise<LeadData[]> {
    try {
      const { data, error } = await this.supabase
        .from('leads')
        .select('*')
        .eq('stage', 'human_override')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching human override leads:', error);
      throw error;
    }
  }

  // Update lead qualification status
  async updateLeadQualification(
    conversationId: string, 
    isQualified: boolean, 
    ghlContactId?: string,
    ghlOpportunityId?: string,
    bookingLink?: string
  ): Promise<LeadData> {
    try {
      const { data, error } = await this.supabase
        .from('leads')
        .update({
          is_qualified: isQualified,
          ghl_contact_id: ghlContactId,
          ghl_opportunity_id: ghlOpportunityId,
          booking_link: bookingLink,
          stage: isQualified ? 'qualified' : 'nurture',
          updated_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating lead qualification:', error);
      throw error;
    }
  }

  // Get analytics data
  async getAnalytics(startDate: string, endDate: string) {
    try {
      const [totalLeads, qualifiedLeads, humanOverrides, avgResponseTime] = await Promise.all([
        this.supabase
          .from('leads')
          .select('id', { count: 'exact' })
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        
        this.supabase
          .from('leads')
          .select('id', { count: 'exact' })
          .eq('is_qualified', true)
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        
        this.supabase
          .from('leads')
          .select('id', { count: 'exact' })
          .eq('stage', 'human_override')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        
        this.supabase
          .from('conversation_logs')
          .select('timestamp')
          .gte('timestamp', startDate)
          .lte('timestamp', endDate)
      ]);

      return {
        totalLeads: totalLeads.count || 0,
        qualifiedLeads: qualifiedLeads.count || 0,
        qualificationRate: totalLeads.count ? (qualifiedLeads.count || 0) / totalLeads.count : 0,
        humanOverrides: humanOverrides.count || 0,
        avgResponseTime: 0 // Calculate based on conversation_logs if needed
      };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  }

  // Clean up old data (optional maintenance function)
  async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffISO = cutoffDate.toISOString();

      await Promise.all([
        this.supabase
          .from('conversation_logs')
          .delete()
          .lt('timestamp', cutoffISO),
        
        this.supabase
          .from('conversation_states')
          .delete()
          .lt('updated_at', cutoffISO)
          .neq('current_stage', 'qualified') // Keep qualified leads
      ]);
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      throw error;
    }
  }
}

// Initialize with dummy values for now
export const supabaseService = new SupabaseService(); 