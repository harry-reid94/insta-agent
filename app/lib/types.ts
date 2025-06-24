// Define the possible stages in a conversation
export type ConversationStage = 
  | 'greeting'
  | 'rapport_building'
  | 'answering_Q1'
  | 'answering_Q2'
  | 'answering_Q3'
  | 'qualified'
  | 'nurture'
  | 'human_override'
  | 'booking'
  | 'finished'; 