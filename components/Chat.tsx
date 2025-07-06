'use client';

import { useState, FormEvent, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isSpecific?: boolean;
}

type ConversationStage = 
  | 'greeting'
  | 'rapport_building'
  | 'rapport_follow_up'
  | 'answering_Q1'
  | 'answering_Q2'
  | 'answering_Q3'
  | 'answering_Q4'
  | 'qualified'
  | 'nurture'
  | 'finished'
  | 'human_override'
  | 'booking';

interface ConversationState {
    stage: ConversationStage;
    answers: Record<string, string | number>;
    lastQuestionAsked: string;
    isQualified?: boolean;
    currentQuestionId?: string;
    repromptAttempts: Record<string, number>;
    location?: string;
    response: string;
    gender?: string;
}

interface ChatResponse {
  response?: string;
  messages?: Message[];
  newState: ConversationState;
  conversationId?: string;
  error?: string;
}

// Helper to split assistant responses into separate bubbles.
function splitAssistantResponse(response: string): string[] {
  // Split on two or more consecutive newlines (optionally with whitespace)
  return response
    .split(/\n\s*\n/)
    .map(seg => seg.trim())
    .filter(seg => seg.length > 0);
}

const MessageBubble = ({ content, role, isSpecific }: Message) => {
  // Split content by newlines and filter out empty strings
  const messageParts = content.split('\n').filter(part => part.trim().length > 0);

  const bubbleClass = `rounded-lg px-4 py-2 max-w-[80%] ${
    role === 'user' 
      ? 'bg-blue-500 text-white ml-auto' 
      : 'bg-gray-200 text-black mr-auto'
  }`;

  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} flex-col gap-2`}>
      {messageParts.map((part, idx) => (
        <div key={idx} className={bubbleClass}>
          {part}
        </div>
      ))}

      {isSpecific && role === 'user' && (
        <div className="text-xs text-red-600 font-semibold ml-auto mr-2">
          highly specific response detected – human override initiated
        </div>
      )}
    </div>
  );
};

export default function Chat() {
  const [chatInitiated, setChatInitiated] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [state, setState] = useState<ConversationState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | 'unknown'>('unknown');

  const handleTrigger = async (triggerApi: string) => {
    try {
      setIsLoading(true);
      setMessages([]);
      const response = await fetch(triggerApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender: selectedGender }),
      });

      if (!response.ok) throw new Error(`Failed to trigger: ${triggerApi}`);

      const data: ChatResponse = await response.json();
      
      if (data.messages) {
        setMessages(data.messages);
      } else if (data.response) {
        const assistantMessages: Message[] = splitAssistantResponse(data.response).map(seg => ({
          role: 'assistant',
          content: seg,
          isSpecific: false,
        }));
        setMessages(assistantMessages);
      } else {
        throw new Error('Trigger API returned no messages or response');
      }

      setState(data.newState);
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
      setChatInitiated(true);
    } catch (error) {
      console.error('Error handling trigger:', error);
      setMessages([{
        role: 'assistant',
        content: "My bad bro, something went wrong. Try again in a bit.",
        isSpecific: false
      }]);
      setChatInitiated(true); // show the chat window even on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    try {
      setIsLoading(true);
      const userMessage: Message = { 
        role: 'user', 
        content: input,
        isSpecific: false,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages: [...messages, userMessage].map(m => ({
            type: m.role === 'user' ? 'human' : 'ai',
            content: m.content
          })), 
          state: { ...state, gender: selectedGender },
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data: ChatResponse = await response.json();
      
      if (data.newState.stage === 'human_override') {
        setMessages(prev => {
          const updated = [...prev];
          const lastUserMessageIndex = updated.map(m => m.role).lastIndexOf('user');
          if (lastUserMessageIndex !== -1) {
            updated[lastUserMessageIndex] = { ...updated[lastUserMessageIndex], isSpecific: true };
          }
          return updated;
        });
      } else if (!data.response) {
        throw new Error('No response received');
      } else {
        const assistantMessages: Message[] = splitAssistantResponse(data.response).map(seg => ({
          role: 'assistant',
          content: seg,
          isSpecific: false,
        }));
        setMessages(prev => [...prev, ...assistantMessages]);
      }
      
      setState(data.newState);
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Add a fallback error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Hey man, having some technical issues. Can you try that again?",
        isSpecific: false
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!chatInitiated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col space-y-4">
          <h1 className="text-2xl font-bold text-center">Simulate a Trigger</h1>
          
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-gray-700">Select Gender for Testing:</label>
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value as 'male' | 'female' | 'unknown')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          
          <button
            onClick={() => handleTrigger('/api/trigger/new-follower')}
            disabled={isLoading}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300"
          >
            {isLoading ? 'Loading...' : 'Simulate New Follower'}
          </button>
          <button
            onClick={() => handleTrigger('/api/trigger/nurture-follow-up')}
            disabled={isLoading}
            className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-green-600 transition-colors disabled:bg-green-300"
          >
            {isLoading ? 'Loading...' : 'Simulate Nurture Follow-up'}
          </button>
          <button
            onClick={() => handleTrigger('/api/trigger/manual-trigger')}
            disabled={isLoading}
            className="bg-purple-500 text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-purple-600 transition-colors disabled:bg-purple-300"
          >
            {isLoading ? 'Loading...' : 'Simulate Manual Trigger'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Debug Side Panel */}
      <div className="fixed top-4 left-4 bg-gray-800 text-gray-100 text-xs rounded-lg shadow-lg p-3 space-y-1 z-50 w-56">
        <div className="font-semibold text-center underline">Debug</div>
        <div>Stage: <span className="font-semibold">{state?.stage}</span></div>
        <div>
          Status:{' '}
          <span className={`font-semibold ${state?.isQualified === true ? 'text-green-400' : state?.isQualified === false ? 'text-red-400' : 'text-gray-400'}`}>
            {state?.isQualified === true ? 'Qualified' : state?.isQualified === false ? 'Not Qualified' : 'Pending'}
          </span>
        </div>
        <div>Location: <span className="font-semibold">{state?.location || 'Not Set'}</span></div>
        <div>Gender: <span className="font-semibold">{selectedGender}</span></div>
        <div>Current Q: <span className="font-semibold">{state?.currentQuestionId || 'None'}</span></div>
        <div>Last Asked: <span className="font-semibold">{state?.lastQuestionAsked || 'None'}</span></div>
        <div>
          Highly Specific:{' '}
          <span className={`font-semibold ${messages.some(m => m.isSpecific) ? 'text-yellow-400' : 'text-gray-400'}`}>
            {messages.some(m => m.isSpecific) ? 'Yes' : 'No'}
          </span>
        </div>
        <div>
          Human Override:{' '}
          <span className={`font-semibold ${state?.stage === 'human_override' ? 'text-orange-400' : 'text-gray-400'}`}>
            {state?.stage === 'human_override' ? 'Active' : 'No'}
          </span>
        </div>
        <div>
          Answers:{' '}
          <div className="pl-2 mt-1 space-y-1">
            {Object.entries(state?.answers || {}).map(([key, value]) => (
              <div key={key}>
                <span className="opacity-75">{key}:</span>{' '}
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Status Bar */}
      <div className="p-2 bg-gray-800 text-xs text-gray-300 font-mono flex justify-between items-center">
        <div>
          {state?.stage === 'human_override' && (
            <span className="text-orange-400">
              [system] human_override_process_initiated
            </span>
          )}
          {state?.stage === 'booking' && (
            <span className="text-green-400">
              [system] booking_process_initiated
            </span>
          )}
        </div>
        <div>
          {state?.isQualified !== undefined && state?.isQualified && (
            <span className="text-blue-400">
              [status] lead_qualified=true
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <MessageBubble key={index} {...message} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-black rounded-lg px-4 py-2 animate-pulse">
              Typing...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
            }`}
            disabled={isLoading}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
} 