// Define the possible stages in a conversation
export type ConversationStage = 
  | 'greeting'
  | 'new_follower_greeting'
  | 'nurture_follow_up'
  | 'nurture_follow_up_reprompt'
  | 'manual_trigger'
  | 'rapport_building'
  | 'location_response'
  | 'crypto_interest_questions'
  | 'answering_Q1'
  | 'answering_Q2'
  | 'answering_Q3'
  | 'qualified'
  | 'collect_email'
  | 'booking'
  | 'collecting_email'
  | 'nurture'
  | 'nurture_sent'
  | 'final_message'
  | 'end'
  | 'human_override';

// Define gender options
export type Gender = 'male' | 'female' | 'unknown'; 