import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { AIMessage } from '@langchain/core/messages';
import { model, LUKE_PERSONA, getGenderAwarePersona } from './shared';
import { GraphStateType } from './graph';
import { ConversationStage } from './types';
import { parsePortfolioSize } from './config';
import { availabilityService } from './availabilityService';

async function extractLocation(userResponse: string): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `You are a data extraction specialist. Your task is to extract a location (city, state, or country) from a user's message.

The user was asked where they are based.

Your goal is to interpret the text and return only the location. If there are multiple locations, return the first one.
- "I'm in Paris" should be "Paris".
- "London" should be "London".
- "I'm from California" should be "California".
- "new york city" should be "New York City".
- "I'm based in London wbu" should be "London".
- If no specific location can be found, output the original text.

User input: "${userResponse}"

Output only the location.`],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const result = await chain.invoke({});

    return result.trim();
}

async function handleUserResponse(
    state: GraphStateType,
    lastUserMessage: string,
    conversationContext: string,
    mainLogic: (state: GraphStateType, answer: string, conversationContext: string) => Promise<any>,
    validationType: 'default' | 'numeric' = 'default'
) {
    const { lastQuestionAsked, stage } = state;

    if (!lastQuestionAsked) {
        // Fallback for safety, though lastQuestionAsked should always be present in question-answering stages.
        return mainLogic(state, lastUserMessage, conversationContext);
    }

    let systemMessage;

    if (validationType === 'numeric') {
        systemMessage = `You are a conversation analyst. Your goal is to determine if the user's latest message provides a numerical answer to the question they were asked.

The user was asked: "${lastQuestionAsked}"
The user responded: "${lastUserMessage}"

Analyze the user's response:
1.  If the response contains a specific number, a numerical figure, or a quantitative amount (e.g., "50k", "around 20000", "twenty five thousand dollars", "1 million"), classify it as ANSWERED. Extract the part of the response containing the number.
    Output: ANSWERED|{{the user's answer containing the number}}
2.  If the response is a new question from the user, classify it as QUESTION.
    Output: QUESTION|{{the user's question}}
3.  If the response is evasive, explicitly refuses to answer, says they don't know, or is off-topic (e.g., "I'd rather not say", "why do you need to know?", "lol", "I'm not sure"), classify it as OFF_TOPIC.
    Output: OFF_TOPIC|{{the user's response}}

Examples:
- Question: "what's your portfolio size at the moment?"
- Response: "it's about 50 grand"
- Output: ANSWERED|it's about 50 grand

- Question: "what's your portfolio size at the moment?"
- Response: "I'm not comfortable sharing that. Is it required?"
- Output: QUESTION|Is it required?

- Question: "what's your portfolio size at the moment?"
- Response: "not sure"
- Output: OFF_TOPIC|not sure

Provide only the classification and content, separated by a pipe |.`;
    } else {
        systemMessage = `You are a conversation analyst. Your goal is to determine if the user's latest message answers the question they were asked.

The user was asked: "${lastQuestionAsked}"
The user responded: "${lastUserMessage}"

Analyze the user's response:
1.  If the response attempts to answer the question, even if it's a partial answer, evasive, or very brief (e.g., "not much", "a bit"), classify it as ANSWERED. Extract the core answer.
    Output: ANSWERED|{{the user's answer}}
2.  If the response is a new question from the user, classify it as QUESTION.
    Output: QUESTION|{{the user's question}}
3.  If the response is completely off-topic or just conversational filler (e.g., "lol", "ok"), classify it as OFF_TOPIC.
    Output: OFF_TOPIC|{{the user's response}}

Examples:
- Question: "what you know about BullMarketBlueprint?"
- Response: "Not much, tell me more"
- Output: ANSWERED|Not much

- Question: "what's your portfolio size at the moment?"
- Response: "I'm not sure I want to share that. Is this really necessary?"
- Output: QUESTION|Is this really necessary?

- Question: "what you know about BullMarketBlueprint?"
- Response: "lol"
- Output: OFF_TOPIC|lol

- Question: "what you know about BMB?"
- Response: "I've heard it's a crypto group."
- Output: ANSWERED|I've heard it's a crypto group.

Provide only the classification and content, separated by a pipe |.`;
    }

    const analysisPrompt = ChatPromptTemplate.fromMessages([
        ["system", systemMessage],
    ]);

    const analysisChain = analysisPrompt.pipe(model).pipe(new StringOutputParser());
    const analysisResult = await analysisChain.invoke({});
    const [type, content] = analysisResult.split('|', 2);
    
    const repromptKey = stage.replace('answering_', '');
    const currentRepromptAttempts = state.repromptAttempts?.[repromptKey] || 0;
    
    if (type === 'ANSWERED') {
        return mainLogic(state, content || lastUserMessage, conversationContext);
    } else if (currentRepromptAttempts >= 2) {
        // If we've reprompted enough, just proceed with the original (non-answer) message.
        return mainLogic(state, lastUserMessage, conversationContext);
    }
    else {
        let responseSystemPrompt;
        if (type === 'QUESTION') {
            if (validationType === 'numeric') {
                responseSystemPrompt = `${getGenderAwarePersona(state.gender)}

You previously asked for the user's portfolio size: "${lastQuestionAsked}"
Instead of answering, the user asked their own question: "${content}"

Your task is to:
1. If their question is about BMB, trading, crypto, investing, or why you need this info - briefly answer in a casual, Luke-like style.
2. If their question is about anything else (prices, markets, news, unrelated topics) - politely redirect them back to answering your question.
3. Always gently re-ask your original question, clarifying you're looking for a rough number or ballpark figure.

Examples:
Your question: "what's your portfolio size?"
User question: "why do you need to know?"
Your response: "good question bro, it just helps me see if what we offer at BMB is right for your situation. even a rough number is fine."

Your question: "what's your portfolio size?"
User question: "How much is Solana worth?"
Your response: "hey brother, I'm here to learn about your situation, not give market updates. what's your portfolio size looking like?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
            } else {
                responseSystemPrompt = `${getGenderAwarePersona(state.gender)}

You previously asked: "${lastQuestionAsked}"
Instead of answering, the user asked their own question: "${content}"

Your task is to:
1. If their question is about BMB, trading, crypto, investing, or about you/this conversation - briefly answer in a casual, Luke-like style.
2. If their question is about anything else (prices, markets, news, unrelated topics) - politely redirect them back to answering your question.
3. Always gently re-ask your original question to get the conversation back on track.

Examples:
Your question: "where you based?"
User question: "are you a bot?"
Your response: "haha good question brother. I'm real. so where you based?"

Your question: "what you know about BMB?"
User question: "How much is Bitcoin worth?"
Your response: "hey brother, I'm here to chat about BMB, not give market updates. where you based?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
            }
        } else { // OFF_TOPIC
            if (validationType === 'numeric') {
                responseSystemPrompt = `${getGenderAwarePersona(state.gender)}

You previously asked for the user's portfolio size: "${lastQuestionAsked}"
The user gave an evasive or non-numeric response: "${content}"

Your task is to:
1.  Briefly acknowledge their response in a casual, Luke-like style.
2.  Gently re-ask the question, but this time, clarify that you're looking for a rough number or ballpark figure. This helps them understand what you need.

Example 1:
Your original question: "what's your portfolio size at the moment?"
User's response: "not much"
Your new response: "all good brother. just looking for a rough figure so I know how we can best help you. what are you working with portfolio-wise?"

Example 2:
Your original question: "what are you working with portfolio-wise right now?"
User's response: "a little bit"
Your new response: "no worries man. could you give me a ballpark number? just helps me get a better picture."

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
            } else {
                responseSystemPrompt = `${getGenderAwarePersona(state.gender)}

You previously asked: "${lastQuestionAsked}"
The user gave an off-topic or evasive response: "${content}"

Your task is to:
1.  Briefly acknowledge their message in a casual, Luke-like style.
2.  Gently re-ask your original question.

Example:
Your question: "what you know about BMB?"
User response: "this is cool"
Your response: "appreciate it brother. so what have you heard about what we do at BMB?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
            }
        }

        const responsePrompt = ChatPromptTemplate.fromMessages([
            ["system", responseSystemPrompt],
        ]);

        const responseChain = responsePrompt.pipe(model).pipe(new StringOutputParser());
        const response = await responseChain.invoke({});

        return {
            response,
            stage: stage,
            messages: [new AIMessage(response)],
            lastQuestionAsked: state.lastQuestionAsked, // The original question is re-asked
            repromptAttempts: { ...state.repromptAttempts, [repromptKey]: currentRepromptAttempts + 1 },
        };
    }
}

export async function greetingNode(state: GraphStateType, options?: { noGreetingWord?: boolean }) {
    const systemPrompt = options?.noGreetingWord 
      ? `${getGenderAwarePersona(state.gender)}

You've already said hi. Now, ask a follow-up question to get the conversation going.

Choose one of Luke's authentic follow-up questions:
- "how's your day going?"
- "how you doing?"
- "how's everything with you?"
- "how's your week been?"

Generate just the question - natural and casual like Luke would actually send, without quotes.`
      : `${getGenderAwarePersona(state.gender)}

Someone just reached out or followed you. Start the conversation exactly how Luke would - casual and friendly, focusing on getting to know them first rather than pushing BMB.

Choose from Luke's authentic greeting patterns:
- "hey, how's your day going?"
- "what's up, how you doing?"
- "hey there, how's everything with you?"
- "yo, how's your week been?"

Generate just the greeting - natural and casual like Luke would actually send, without quotes.`;

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
    ]);
    
    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const greeting = await chain.invoke({});
    
    return {
        response: greeting,
        stage: 'greeting' as ConversationStage,
        messages: [new AIMessage(greeting)],
        lastQuestionAsked: greeting
    };
}

export async function askLocationNode(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const analysisPrompt = ChatPromptTemplate.fromMessages([
        ["system", `You are a conversation analyst. Your goal is to determine if the user's latest message is a simple response to a greeting or if it contains a question.

The user was greeted with: "${state.lastQuestionAsked}"
The user responded: "${lastUserMessage}"

Analyze the user's response:
1.  If the response contains a direct question (e.g., "what is this?", "who are you?"), output:
    QUESTION|{{the user's question}}
2.  Otherwise, if it's a standard reply to a greeting (e.g., "I'm good", "great thanks and you?"), output:
    GREETING_RESPONSE|{{the user's response}}

Examples:
- User response: "hey, I'm good thanks, you?" -> GREETING_RESPONSE|hey, I'm good thanks, you?
- User response: "what is BMB?" -> QUESTION|what is BMB?
- User response: "Good. What is this group about?" -> QUESTION|What is this group about?

Provide only the classification and content, separated by a pipe |.`],
    ]);

    const analysisChain = analysisPrompt.pipe(model).pipe(new StringOutputParser());
    const analysisResult = await analysisChain.invoke({});
    const [type, content] = analysisResult.split('|', 2);

    let systemMessage;

    if (type === 'QUESTION') {
        systemMessage = `${getGenderAwarePersona(state.gender)}

They responded to your greeting with a question: "${content}"

Your task is to:
1. If the question is about BMB/BullMarketBlueprint, trading, crypto, or investing - answer it briefly.
2. If the question is about anything else (prices, markets, news, unrelated topics) - politely redirect them back to the conversation flow.
3. Always immediately ask where they are based to continue the conversation flow.

BMB Info: BullMarketBlueprint (BMB) is an exclusive mastermind for serious crypto investors, giving them the tools, insights, and strategies to build their wealth.

Examples:
User: "what is this?" 
Luke: "it's a private mastermind for crypto investors bro. where are you based?"

User: "How much is Bitcoin worth?"
Luke: "hey brother, I'm here to chat about BMB, not give market updates. where you based?"

User: "What's the weather like?"
Luke: "haha good question but let's focus on BMB brother. where are you based?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
    } else { // GREETING_RESPONSE
        systemMessage = `${getGenderAwarePersona(state.gender)}

They responded to your greeting: "${lastUserMessage}"

Respond exactly like Luke would:
- If they asked how you are (e.g. "good u", "and you?"), give a SHORT, casual answer with varied acknowledgments like "good man", "solid", "appreciate it" then immediately ask your question.
- Acknowledge what they said naturally.
- Then ask what they're interested in - crypto/trading content or lifestyle content. This helps gauge their intent.
- DON'T repeat "Hey" since you already used it in the greeting.

Luke's intent-gauging question patterns:
- "nice! what brings you here - you into crypto content or more the lifestyle stuff?"
- "solid! are you here for crypto trading content or just checking out the lifestyle side?"
- "got you. what caught your eye - the crypto trading or lifestyle content?"
- "appreciate it. what's your interest - crypto/trading or lifestyle content?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
    }
    
    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemMessage],
    ]);
    
    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const response = await chain.invoke({});
    
    return {
        response,
        stage: 'rapport_building' as ConversationStage,
        messages: [new AIMessage(response)],
        lastQuestionAsked: response
    };
}

export async function rapportBuildingNode(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    // Check if they mentioned crypto/trading interest
    const cryptoInterest = /crypto|trading|bitcoin|blockchain|invest|portfolio|defi|altcoin|eth|btc|degen|bull|bear|market/i.test(lastUserMessage);
    const lifestyleInterest = /lifestyle|travel|dubai|luxury|life|experiences|personal|motivation|mindset/i.test(lastUserMessage);
    
    // Check if they ask about Luke
    const userAsksBack = /you\?|\band you\b|wbu|what about you/i.test(lastUserMessage);

    let systemMessage;
    
    if (cryptoInterest) {
        systemMessage = `${getGenderAwarePersona(state.gender)}

They responded about their interest with: "${lastUserMessage}" - they seem interested in crypto/trading content.

Your task is to:
1. Acknowledge their interest naturally with varied phrases.
2. Ask where they're based/located to continue building rapport.
3. Keep it conversational and not pushy.

Luke's acknowledgment and location question patterns:
- "nice! crypto's been wild lately. where you based?"
- "solid, love meeting fellow crypto people. what part of the world you in?"
- "appreciate it! always good to connect with someone in the space. where you located?"
- "got you, crypto community is strong. where you based?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
    } else if (lifestyleInterest) {
        systemMessage = `${getGenderAwarePersona(state.gender)}

They responded about their interest with: "${lastUserMessage}" - they seem more interested in lifestyle content.

Your task is to:
1. Acknowledge their interest naturally.
2. Since they're more lifestyle-focused, keep the conversation light and don't push crypto content.
3. Ask where they're based to continue building rapport.

Luke's acknowledgment patterns for lifestyle interest:
- "nice! lifestyle content is fun to share. where you based?"
- "solid, always good to connect. what part of the world you in?"
- "appreciate it! love meeting new people. where you located?"
- "got you. where you based?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
    } else {
        // Vague or non-specific response
        systemMessage = `${getGenderAwarePersona(state.gender)}

They gave a vague response about their interest: "${lastUserMessage}"

Your task is to:
1. Acknowledge their response naturally.
2. Ask where they're based to continue building rapport.
3. Keep it light and conversational.

Luke's acknowledgment and location question patterns:
- "fair enough! where you based?"
- "got you. what part of the world you in?"
- "solid. where you located?"
- "nice! where you based?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
    }

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemMessage],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const response = await chain.invoke({});

    const location = await extractLocation(lastUserMessage);

    return {
        response,
        stage: 'location_response' as ConversationStage,
        location,
        messages: [new AIMessage(response)],
        lastQuestionAsked: response
    };
}

export async function locationResponseNode(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const userAsksBack = /you\?|\band you\b|wbu|what about you/i.test(lastUserMessage);

    let systemMessage;
    if (userAsksBack) {
        systemMessage = `${getGenderAwarePersona(state.gender)}

They responded about location with: "${lastUserMessage}" and asked about you.

Your task is to:
1. Acknowledge their location naturally with varied phrases.
2. Share that you are based in Dubai.
3. Ask a more conversational question to build rapport instead of jumping straight to BMB. Use one of these approaches:
   - Ask about their crypto/trading experience: "how long have you been in crypto?"
   - Ask about their portfolio performance: "how's your portfolio been performing lately?"
   - Ask about their investing experience: "what got you into investing?"

Luke's acknowledgment and transition patterns:
- "nice! beautiful spot. I'm in Dubai man. how long have you been in crypto?"
- "solid, I'm based in Dubai. how's your portfolio been performing lately?"
- "appreciate it! I'm Dubai-based. what got you into investing?"
- "got you, I'm in Dubai. how long have you been trading?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
    } else {
        systemMessage = `${getGenderAwarePersona(state.gender)}

They responded about location with: "${lastUserMessage}". They did NOT ask about your location.

Your task is to:
1. Acknowledge their location naturally with varied phrases.
2. DO NOT mention you are in Dubai.
3. Ask a more conversational question to build rapport instead of jumping straight to BMB. Use one of these approaches:
   - Ask about their crypto/trading experience: "how long have you been in crypto?"
   - Ask about their portfolio performance: "how's your portfolio been performing lately?"
   - Ask about their investing experience: "what got you into investing?"

Luke's acknowledgment and transition patterns (without mentioning Dubai):
- "nice! how long have you been in crypto?"
- "solid. how's your portfolio been performing lately?"
- "appreciate it! what got you into investing?"
- "got you. how long have you been trading?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
    }

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemMessage],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const response = await chain.invoke({});

    const location = await extractLocation(lastUserMessage);

    return {
        response,
        stage: 'crypto_interest_questions' as ConversationStage,
        location,
        messages: [new AIMessage(response)],
        lastQuestionAsked: response
    };
}

export async function cryptoInterestQuestionsNode(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${getGenderAwarePersona(state.gender)}

They responded to your crypto/investing question with: "${lastUserMessage}"

Your task is to:
1. Acknowledge their response naturally with varied phrases.
2. Ask a follow-up question to continue building rapport and understanding their situation.
3. DO NOT jump straight to BMB or portfolio size yet - keep building the conversation.

Choose one of these follow-up approaches based on their response:
- If they mentioned experience/time: "solid! what's been your biggest challenge so far?"
- If they mentioned performance: "fair enough. what's been the trickiest part for you?"
- If they mentioned getting started: "got you. what's been the biggest hurdle?"
- If they gave a vague answer: "appreciate it. what's been your main focus lately?"

Luke's acknowledgment and question patterns:
- "nice! what's been your biggest challenge so far?"
- "solid. what's been the trickiest part for you?"
- "got you. what's been the biggest hurdle?"
- "appreciate it. what's your main focus been lately?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const response = await chain.invoke({});

    return {
        response,
        stage: 'answering_Q3' as ConversationStage, // Skip straight to Q3 (pain points)
        messages: [new AIMessage(response)],
        answers: { ...state.answers, crypto_experience: lastUserMessage },
        lastQuestionAsked: response
    };
}

// This is the core logic for answering Q1, extracted from the original node.
async function q1MainLogic(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    // You can provide the detailed BMB explanation here.
    const BMB_EXPLANATION = "We've built risk management software that helps us outperform the returns from a typical buy and hold strategy. It's an exclusive group for serious crypto investors looking to build real wealth."

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${getGenderAwarePersona(state.gender)}

You can send multiple messages to make the conversation feel more natural. To do this, separate each message with a new line.
For example:
"got you brother
what's the biggest challenge/pain point for you right now when it comes to investing?"

They responded to your question about BMB with: "${lastUserMessage}"

Your task is to:
1.  Analyze their response to gauge their understanding of BullMarketBlueprint (BMB).
2.  If their understanding seems low (e.g., they say "not much", "tell me more", "I know nothing"), first give a brief, one-sentence explanation of BMB, and then ask about their portfolio size (Q2).
    - BMB Explanation: "${BMB_EXPLANATION}"
3.  If they seem to have some understanding, just acknowledge their answer and ask about their portfolio size (Q2).
4.  The response should be natural and in Luke's style. You can split it into multiple messages if it feels more natural.

Luke's portfolio size question patterns:
- "got you. and what's your portfolio size at the moment? just a rough idea is fine"
- "all good. what are you working with portfolio-wise right now?"
- "no worries bro. and are you currently investing? what's your portfolio at?"
- "okay cool. and what's your portfolio sitting at right now brother?"

Example for LOW understanding (split message):
User: "not much tbh, what is it?"
Luke: "all good bro. ${BMB_EXPLANATION}
what are you working with portfolio-wise right now?"

Example for GOOD understanding (single message):
User: "I saw it's a crypto trading group"
Luke: "nice one man. and what's your portfolio size at the moment? just a rough idea is fine"

Conversation so far:
${conversationContext}

Generate Luke's natural response. Do not use quotes. Use new lines to split messages.`],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const responseString = await chain.invoke({});
    const response = responseString.split('\n');
    const lastQuestion = response[response.length - 1];

    return {
        response: responseString,
        stage: 'answering_Q2' as ConversationStage,
        messages: [new AIMessage(responseString)],
        answers: { ...state.answers, Q1_bmb_understanding: lastUserMessage },
        lastQuestionAsked: lastQuestion,
    };
}

export async function answeringQ1Node(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    return handleUserResponse(state, lastUserMessage, conversationContext, q1MainLogic);
}

// This is the old Q2 logic - now unused since we changed the flow
// Keeping for reference but it's not called anymore

export async function answeringQ2Node(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    return handleUserResponse(state, lastUserMessage, conversationContext, portfolioSizeMainLogic, 'numeric');
}

// This is the core logic for answering Q3, extracted from the original node.
async function q3MainLogic(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    // First, acknowledge their pain points and then ask about portfolio size
    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${getGenderAwarePersona(state.gender)}

They responded to your question about challenges with: "${lastUserMessage}"

Your task is to:
1. Acknowledge their challenge naturally with varied phrases.
2. Ask about their portfolio size in a casual, non-pushy way.
3. Make it clear it's just for context to see how to best help them.

Luke's acknowledgment and portfolio question patterns:
- "makes sense. what are you working with portfolio-wise? just so I can get a better picture"
- "fair enough. what's your portfolio sitting at right now? just helps me understand your situation"
- "got you. what are you working with investment-wise? just a rough idea is fine"
- "appreciate it. what's your portfolio size looking like? just so I know how to best help"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const response = await chain.invoke({});

    return {
        response,
        stage: 'answering_Q2' as ConversationStage, // Now ask for portfolio size
        messages: [new AIMessage(response)],
        answers: { ...state.answers, Q3_pain_points: lastUserMessage },
        lastQuestionAsked: response,
    };
}

// Portfolio size logic that handles qualification after pain points
async function portfolioSizeMainLogic(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const answers = { ...state.answers, Q2_portfolio_size: lastUserMessage };
    const portfolioSize = await parsePortfolioSize(lastUserMessage) || 0;

    const isQualified = portfolioSize >= 50000;

    if (isQualified) {
        // 1. Generate a contextual acknowledgement of the user's portfolio size.
        const ackPrompt = ChatPromptTemplate.fromMessages([
            ["system", `${getGenderAwarePersona(state.gender)}

The user just told you their portfolio size is: "${lastUserMessage}"

Your task is to provide a brief, one-line acknowledgement that sounds natural and positive. This is just a bridge before you offer to book a call.

Examples:
- User says: "60k"
- Your response: "solid, that's a great spot to be working with."

- User says: "about 100k"
- Your response: "nice! that's a solid foundation."

- User says: "around 200k"
- Your response: "appreciate it, that's a great position to be in."

Generate only the single line of acknowledgement.`],
        ]);
        const ackChain = ackPrompt.pipe(model).pipe(new StringOutputParser());
        const acknowledgement = await ackChain.invoke({});

        // 2. Fetch available booking slots.
        let availableSlots: string[] = [];
        let bookingMessage: string;
        try {
            const slots = await availabilityService.getAvailableSlots();
            availableSlots = slots.map(slot => 
                slot.toLocaleString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: 'numeric', 
                    hour12: true 
                })
            );
            bookingMessage = `based on what you've shared, I think BMB could really help with those challenges. we've built risk management software that helps us outperform typical buy and hold strategies.\n\nwant to hop on a quick call with the team? here are some available times:\n\n- ${availableSlots.join('\n- ')}\n\nwhich one works for you?`;
        } catch (error) {
            console.error('Error fetching slots in q2MainLogic:', error);
            bookingMessage = `based on what you've shared, I think BMB could really help with those challenges. we've built risk management software that helps us outperform typical buy and hold strategies.\n\nwant to hop on a quick call with the team? I'll send you the booking link directly.`;
        }

        // 3. Combine them into a multi-part response.
        const finalResponse = `${acknowledgement}\n\n${bookingMessage}`;

        return {
            response: finalResponse,
            answers,
            isQualified: true,
            stage: 'booking' as ConversationStage,
            messages: [new AIMessage(finalResponse)],
            availableSlots,
            lastQuestionAsked: bookingMessage, // The last question is the request to pick a time.
        };
        // --- END NEW LOGIC ---
    } else {
        return {
            answers,
            isQualified: false,
            stage: 'nurture' as ConversationStage,
            messages: [] // No message needed, router will handle this state.
        };
    }
}

export async function answeringQ3Node(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    // The conversation context is not used in q3MainLogic, but the handleUserResponse expects it.
    return handleUserResponse(state, lastUserMessage, conversationContext, q3MainLogic);
}

async function resolveBookingTime(userResponse: string, availableSlots: string[]): Promise<string | null> {
    if (!userResponse || availableSlots.length === 0) {
        return null;
    }

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `You are a data extraction bot. Your only job is to find which of the options the user selected.

The user was shown these booking slots:
${availableSlots.map(slot => `- "${slot}"`).join('\n')}

The user replied: "${userResponse}"

Your task is to analyze the user's reply and determine which of the original booking slots they selected.
- You MUST return one of the exact, original slot strings provided above.
- If the user's reply does not clearly match any of the options, or if they say something like "none of these work", you MUST return the exact string "NO_MATCH".
- Do NOT add any extra text, explanation, or punctuation. Your entire response must be either a direct copy of one of the slot strings, or "NO_MATCH".

Example:
- Slots: ["Wednesday, June 25 at 10:00 AM", "Wednesday, June 25 at 11:00 AM"]
- User reply: "10am"
- Your entire output: "Wednesday, June 25 at 10:00 AM"
`],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const result = await chain.invoke({});

    console.log('--- Time Resolution Debug ---');
    console.log('User said:', userResponse);
    console.log('LLM returned:', `"${result}"`); // Log with quotes to see whitespace
    console.log('Available slots:', availableSlots);

    const trimmedResult = result.trim();

    if (trimmedResult.toUpperCase() === 'NO_MATCH') {
        console.log('Resolution: NO_MATCH');
        return null;
    }

    // Check if the trimmed result is one of the available slots.
    if (availableSlots.includes(trimmedResult)) {
        console.log('Resolution: Exact match found ->', trimmedResult);
        return trimmedResult;
    }
    
    console.log('Resolution: Failed. LLM output did not exactly match any available slot.');
    return null;
}

export async function collectEmailNode(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const { availableSlots } = state;
    const resolvedTime = await resolveBookingTime(lastUserMessage, availableSlots || []);

    if (!resolvedTime) {
        // If no match is found, ask the user to clarify.
        const slotList = (availableSlots && availableSlots.length > 0)
            ? `\n\n- ${availableSlots.join('\n- ')}`
            : ""; // Don't show slots if they are not available
        const repromptMessage = `Sorry brother, I didn't quite catch that. Which of these times works for you?${slotList}`;
        return {
            response: repromptMessage,
            stage: 'booking' as ConversationStage, // Send back to booking to try again
            messages: [new AIMessage(repromptMessage)],
            lastQuestionAsked: repromptMessage,
            availableSlots,
        };
    }

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${getGenderAwarePersona(state.gender)}

The user was offered several booking times and responded with: "${lastUserMessage}"
You've determined this corresponds to the specific time: "${resolvedTime}"

Your task is to:
1. Acknowledge their selection naturally. You don't need to repeat the full date and time.
2. Ask for their email address to send the calendar invite to.

Example:
User's response: "The 10am slot works"
Resolved time: "Wednesday, June 25 at 10:00 AM"
Luke's response: "sounds good brother, got you down for 10am. what's the best email to send the invite to?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const response = await chain.invoke({});

    return {
        response,
        stage: 'collecting_email' as ConversationStage,
        messages: [new AIMessage(response)],
        answers: { ...state.answers, booking_time: resolvedTime },
        lastQuestionAsked: response
    };
}

export async function bookingConfirmationNode(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const userEmail = lastUserMessage;
    
    // DUMMY GHL INTEGRATION - LOG TO CONSOLE FOR TESTING
    console.log('=== DUMMY GHL BOOKING INTEGRATION ===');
    console.log('📅 BOOKING CREATED');
    console.log('');
    console.log('👤 Contact Details:');
    console.log('   📧 Email:', userEmail);
    console.log('   📍 Location:', state.location || 'Not provided');
    console.log('');
    console.log('💼 Qualification Data:');
    console.log('   🧠 BMB Understanding:', state.answers['Q1_bmb_understanding'] || 'Not provided');
    console.log('   💰 Portfolio Size:', state.answers['Q2_portfolio_size'] || 'Not provided');
    console.log('   ⚡ Pain Points:', state.answers['Q3_pain_points'] || 'Not provided');
    console.log('');
    console.log('🗓️ Booking Info:');
    console.log('   ⏰ Selected Time:', state.answers['booking_time'] || 'Not provided');
    console.log('   📨 Calendar Invite: Would be sent to', userEmail);
    console.log('');
    console.log('✅ Next Steps:');
    console.log('   - Create contact in GHL');
    console.log('   - Add to BMB pipeline');
    console.log('   - Send calendar invite');
    console.log('   - Trigger follow-up sequences');
    console.log('=====================================');
    
    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${getGenderAwarePersona(state.gender)}

The user just provided their email for the booking: "${userEmail}"

Your task is to:
1. Confirm you've received their email.
2. Let them know a calendar invite is on its way.
3. End the conversation on a positive, friendly note.

Example:
User: "test@test.com"
Luke: "perfect, appreciate it brother. just sent the calendar invite to test@test.com. chat soon!"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const response = await chain.invoke({});

    return {
        response,
        stage: 'end' as ConversationStage,
        messages: [new AIMessage(response)],
        answers: { ...state.answers, email: userEmail },
    };
}

export async function nurtureNode(state: GraphStateType) {
    // Check if the nurture message has already been sent to prevent re-sending.
    if (state.stage === 'nurture_sent') {
        // If user replies after nurture message, transition to the final message.
        return {
            stage: 'final_message' as ConversationStage,
        };
    }

    const nurtureMessage = `No worries at all brother, appreciate you sharing.

Right now, BMB is probably not the right fit for you. We're looking for investors with a bit more capital to make the most of the strategies we teach.

But I've got tonnes of resources that I think you'll get a lot of value from:
https://www.youtube.com/watch?v=dQw4w9WgXcQ

Check it out and let me know what you think.`;

    return {
        response: nurtureMessage,
        stage: 'nurture_sent' as ConversationStage, // Mark that the nurture message has been sent
        messages: [new AIMessage(nurtureMessage)],
    };
}

export async function finalMessageNode(state: GraphStateType) {
    const finalMessage = "Keep building, and let's catch up when your portfolio grows.";
    return {
        response: finalMessage,
        stage: 'end' as ConversationStage, // End the conversation
        messages: [new AIMessage(finalMessage)],
    };
}

export async function defaultConversationNode(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const { stage: currentStage } = state;
    
    // By returning an empty response, we make the agent "wait" for the user's next input
    // without sending a placeholder message.
    return {
        response: '',
        messages: [],
        stage: currentStage,
    };
}

export async function nurtureFollowUpNode(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const systemMessage = `You are a conversation analyst. Your goal is to determine if the user's latest message provides a numerical answer to the question they were asked.

The user was asked: "how is your portfolio coming along?"
The user responded: "${lastUserMessage}"

Analyze the user's response:
1.  If the response contains a specific number, a numerical figure, or a quantitative amount (e.g., "50k", "around 20000", "twenty five thousand dollars", "1 million"), classify it as ANSWERED. Extract the part of the response containing the number.
    Output: ANSWERED|{{the user's answer containing the number}}
2.  If the response is evasive, explicitly refuses to answer, says they don't know, or is a qualitative update (e.g., "it's going well", "not great"), classify it as NOT_ANSWERED.
    Output: NOT_ANSWERED|{{the user's response}}

Examples:
- Question: "how is your portfolio coming along?"
- Response: "it's about 50 grand"
- Output: ANSWERED|it's about 50 grand

- Question: "how is your portfolio coming along?"
- Response: "it's going well thanks"
- Output: NOT_ANSWERED|it's going well thanks

Provide only the classification and content, separated by a pipe |.`;

    const analysisPrompt = ChatPromptTemplate.fromMessages([
        ["system", systemMessage],
    ]);

    const analysisChain = analysisPrompt.pipe(model).pipe(new StringOutputParser());
    const analysisResult = await analysisChain.invoke({});
    const [type, content] = analysisResult.split('|', 2);

    if (type === 'ANSWERED') {
        const portfolioSizeRaw = content || lastUserMessage;
        const portfolioSize = await parsePortfolioSize(portfolioSizeRaw) || 0;
        const isQualified = portfolioSize >= 50000;

        if (isQualified) {
            // 1. Generate a contextual acknowledgement of the user's portfolio size.
            const ackPrompt = ChatPromptTemplate.fromMessages([
                ["system", `${LUKE_PERSONA}

You previously checked in with this user. They just told you their portfolio size is: "${portfolioSizeRaw}"

Your task is to provide a brief, one-line acknowledgement that sounds natural and positive. This is just a bridge before you offer to book a call.

Examples:
- User says: "60k"
- Your response: "great to hear brother, solid progress."

- User says: "about 75000"
- Your response: "awesome man, that's a great spot to be in."

Generate only the single line of acknowledgement.`],
            ]);
            const ackChain = ackPrompt.pipe(model).pipe(new StringOutputParser());
            const acknowledgement = await ackChain.invoke({});

            // 2. Fetch available booking slots.
            let availableSlots: string[] = [];
            let bookingMessage: string;
            try {
                const slots = await availabilityService.getAvailableSlots();
                availableSlots = slots.map(slot => 
                    slot.toLocaleString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric', 
                        hour: 'numeric', 
                        minute: 'numeric', 
                        hour12: true 
                    })
                );
                bookingMessage = `let's go! you sound like a perfect fit. let's get you booked in for a call with the team. Here are some available times:\n\n- ${availableSlots.join('\n- ')}\n\nLet me know which one works for you.`;
            } catch (error) {
                console.error('Error fetching slots in nurtureFollowUpNode:', error);
                bookingMessage = `let's go! you sound like a perfect fit. let's get you booked in for a call with the team. I'll send you the booking link directly.`;
            }

            // 3. Combine them into a multi-part response.
            const finalResponse = `${acknowledgement}\n\n${bookingMessage}`;

            return {
                response: finalResponse,
                answers: { ...state.answers, Q2_portfolio_size: portfolioSizeRaw },
                isQualified: true,
                stage: 'booking' as ConversationStage,
                messages: [new AIMessage(finalResponse)],
                availableSlots,
                lastQuestionAsked: bookingMessage,
            };
        } else {
            const nurtureMessage = `Good to hear from you brother. Appreciate you sharing.

Based on that, BMB probably isn't the right fit just yet. We're generally looking for investors with a bit more capital to make the most of the program.

Keep building, and let's catch up when your portfolio grows.`;
            return {
                response: nurtureMessage,
                stage: 'end' as ConversationStage,
                messages: [new AIMessage(nurtureMessage)],
            };
        }
    } else { // NOT_ANSWERED
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", `${LUKE_PERSONA}

You previously asked a user "how their portfolio is coming along."
The user has just replied with a non-numeric answer: "${lastUserMessage}"

Your goal is to re-engage them and get a portfolio size.
1.  Acknowledge their response in a positive and casual way (e.g., "Good to hear brother," or "I hear you man,").
2.  Then, ask for a rough number.

Example if user says "it's going well":
"Good to hear brother. What are you working with portfolio-wise right now? just a rough number is fine."

Example if user says "it's been tough":
"I hear you man, market's been a ride. What are you working with portfolio-wise right now? just a rough number is fine."

The conversation history is:
${conversationContext}

Generate Luke's response. It must end with the question asking for their portfolio size.`],
        ]);

        const chain = prompt.pipe(model).pipe(new StringOutputParser());
        const response = await chain.invoke({});
        const lastQuestion = "What are you working with portfolio-wise right now? just a rough number is fine.";

        return {
            response,
            stage: 'nurture_follow_up_reprompt' as ConversationStage,
            messages: [new AIMessage(response)],
            lastQuestionAsked: lastQuestion,
        };
    }
}

export async function nurtureFollowUpRepromptNode(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const portfolioSizeRaw = lastUserMessage;
    const portfolioSize = await parsePortfolioSize(portfolioSizeRaw) || 0;
    const isQualified = portfolioSize >= 50000;

    if (isQualified) {
        // 1. Generate a contextual acknowledgement of the user's portfolio size.
        const ackPrompt = ChatPromptTemplate.fromMessages([
            ["system", `${getGenderAwarePersona(state.gender)}

You previously checked in with this user. They just told you their portfolio size is: "${portfolioSizeRaw}"

Your task is to provide a brief, one-line acknowledgement that sounds natural and positive. This is just a bridge before you offer to book a call.

Examples:
- User says: "60k"
- Your response: "great to hear brother, solid progress."

- User says: "about 75000"
- Your response: "awesome man, that's a great spot to be in."

Generate only the single line of acknowledgement.`],
        ]);
        const ackChain = ackPrompt.pipe(model).pipe(new StringOutputParser());
        const acknowledgement = await ackChain.invoke({});

        // 2. Fetch available booking slots.
        let availableSlots: string[] = [];
        let bookingMessage: string;
        try {
            const slots = await availabilityService.getAvailableSlots();
            availableSlots = slots.map(slot => 
                slot.toLocaleString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: 'numeric', 
                    hour12: true 
                })
            );
            bookingMessage = `let's go! you sound like a perfect fit. let's get you booked in for a call with the team. Here are some available times:\n\n- ${availableSlots.join('\n- ')}\n\nLet me know which one works for you.`;
        } catch (error) {
            console.error('Error fetching slots in nurtureFollowUpRepromptNode:', error);
            bookingMessage = `let's go! you sound like a perfect fit. let's get you booked in for a call with the team. I'll send you the booking link directly.`;
        }

        // 3. Combine them into a multi-part response.
        const finalResponse = `${acknowledgement}\n\n${bookingMessage}`;

        return {
            response: finalResponse,
            answers: { ...state.answers, Q2_portfolio_size: portfolioSizeRaw },
            isQualified: true,
            stage: 'booking' as ConversationStage,
            messages: [new AIMessage(finalResponse)],
            availableSlots,
            lastQuestionAsked: bookingMessage,
        };
    } else {
        const nurtureMessage = `Good to hear from you brother. Appreciate you sharing.

Based on that, BMB probably isn't the right fit just yet. We're generally looking for investors with a bit more capital to make the most of the program.

Keep building, and let's catch up when your portfolio grows.`;
        return {
            response: nurtureMessage,
            stage: 'end' as ConversationStage,
            messages: [new AIMessage(nurtureMessage)],
        };
    }
} 