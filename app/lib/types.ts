// Define the possible stages in a conversation
export type ConversationStage = 
  | 'greeting'
  | 'new_follower_greeting'
  | 'nurture_follow_up'
  | 'nurture_follow_up_reprompt'
  | 'manual_trigger'
  | 'rapport_building'
  | 'answering_Q1'
  | 'answering_Q2'
  | 'answering_Q3'
  | 'qualified'
  | 'booking'
  | 'collecting_email'
  | 'nurture'
  | 'nurture_sent'
  | 'final_message'
  | 'end'
  | 'human_override'; 