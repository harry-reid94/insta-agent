import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { ConversationStage } from './types';

// Define the state schema using Annotation.
// This is the single source of truth for the graph's state shape.
export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (state: BaseMessage[], update: BaseMessage | BaseMessage[]) => {
      if (Array.isArray(update)) {
        return state.concat(update);
      }
      return state.concat([update]);
    },
    default: () => []
  }),
  stage: Annotation<ConversationStage>({
    reducer: (x, y) => y,
    default: () => 'greeting'
  }),
  answers: Annotation<Record<string, string | number>>({
    reducer: (x, y) => ({...x, ...y}),
    default: () => ({})
  }),
  lastQuestionAsked: Annotation<string>({
    reducer: (x, y) => y,
    default: () => ''
  }),
  isQualified: Annotation<boolean | undefined>({
    reducer: (x, y) => y,
    default: () => undefined
  }),
  repromptAttempts: Annotation<Record<string, number>>({
    reducer: (x, y) => ({...x, ...y}),
    default: () => ({})
  }),
  location: Annotation<string | undefined>({
    reducer: (x, y) => y,
    default: () => undefined
  }),
  response: Annotation<string>({
    reducer: (x, y) => y,
    default: () => ''
  }),
  responseAnalysis: Annotation<{ type: string, content: string } | null>({
      reducer: (x, y) => y,
      default: () => null
  }),
  availableSlots: Annotation<string[]>({
    reducer: (x, y) => y,
    default: () => []
  })
});

export type GraphStateType = typeof GraphState.State; 