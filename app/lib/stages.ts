import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { AIMessage } from '@langchain/core/messages';
import { model, LUKE_PERSONA } from './shared';
import { GraphStateType } from './graph';
import { ConversationStage } from './types';
import { parsePortfolioSize } from './config';

export async function greetingNode(state: GraphStateType) {
    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${LUKE_PERSONA}

Someone just reached out about BullMarketBlueprint. Start the conversation exactly how Luke would - casual but purposeful.

Choose from Luke's authentic greeting patterns:
- "Hey brother, how's your day going?"
- "What's up man, how you doing?"
- "Hey brother, how's everything with you?"
- "yo, how's your week been?"

Generate just the greeting - natural and casual like Luke would actually send, without quotes.`],
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
    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${LUKE_PERSONA}

They responded to your greeting: "${lastUserMessage}"

Respond exactly like Luke would:
- If they asked how you are: brief answer then pivot 
- Acknowledge what they said naturally 
- Then ask where they're based/located using Luke's style
- DON'T repeat "Hey" since you already used it in the greeting

Luke's location question patterns:
- "good man, where you based?"
- "awesome, where you at?"
- "got you brother, where you located?"
- "all good bro, what part of the world you in?"
- "nice! where you located?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`],
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
    const userAsksBack = /you\?|\band you\b|wbu|what about you/i.test(lastUserMessage);

    let systemMessage;
    if (userAsksBack) {
        systemMessage = `${LUKE_PERSONA}

They responded about location with: "${lastUserMessage}" and asked about you.

Your task is to:
1. Acknowledge their location naturally.
2. Share that you are based in Dubai.
3. Ask them what they know about BMB to transition the conversation.

Luke's acknowledgment and transition patterns:
- "awesome brother, beautiful spot. I'm in Dubai. give me the rundown - what you know about BullMarketBlueprint?"
- "nice man! I'm based in Dubai. what you know about BMB?"
- "got you bro, I'm Dubai-based. so what brings you to BMB? what you heard about us?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
    } else {
        systemMessage = `${LUKE_PERSONA}

They responded about location with: "${lastUserMessage}". They did NOT ask about your location.

Your task is to:
1. Acknowledge their location naturally.
2. DO NOT mention you are in Dubai.
3. Ask them what they know about BMB to transition the conversation.

Luke's acknowledgment and transition patterns (without mentioning Dubai):
- "nice man! so what you know about BMB?"
- "awesome brother, beautiful spot. give me the rundown - what you know about BullMarketBlueprint?"
- "got you bro. so what brings you to BMB? what you heard about us?"
- "solid! so tell me, what you know about what we do at BMB?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`;
    }

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemMessage],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const response = await chain.invoke({});

    const location = lastUserMessage;

    return {
        response,
        stage: 'answering_Q1' as ConversationStage,
        location,
        messages: [new AIMessage(response)],
        lastQuestionAsked: response
    };
}

export async function answeringQ1Node(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    // You can provide the detailed BMB explanation here.
    const BMB_EXPLANATION = "it's an exclusive mastermind for serious crypto investors, giving you the tools, insights, and strategies to build your wealth in crypto."

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${LUKE_PERSONA}

You can send multiple messages to make the conversation feel more natural. To do this, separate each message with a new line.
For example:
"got you brother
what's the biggest challenge for you right now when it comes to investing?"

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

export async function answeringQ2Node(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const portfolioSize = parsePortfolioSize(lastUserMessage);
    const currentRepromptAttempts = state.repromptAttempts['Q2'] || 0;

    // If response is not a number and we haven't exhausted reprompts
    if (portfolioSize === null && currentRepromptAttempts < 2) {
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", `${LUKE_PERSONA}

They responded to your portfolio size question (Q2) with: "${lastUserMessage}", which isn't a clear number.

Your task is to:
1. Gently re-ask the question.
2. Emphasize you're just looking for a rough number or estimate.

Luke's re-prompt patterns for portfolio size:
- "all good brother, just looking for a rough number if possible. what are we working with?"
- "got you. is there a ballpark figure you can share? just helps me understand where you're at."
- "no worries man. could you give me a rough estimate of your current portfolio size?"

Conversation so far:
${conversationContext}

Generate Luke's natural re-prompt without quotes.`],
        ]);

        const chain = prompt.pipe(model).pipe(new StringOutputParser());
        const response = await chain.invoke({});
        
        return {
            response,
            stage: 'answering_Q2' as ConversationStage, // Stay in the same stage
            messages: [new AIMessage(response)],
            repromptAttempts: { ...state.repromptAttempts, 'Q2': currentRepromptAttempts + 1 },
            lastQuestionAsked: response
        };
    }

    // If we have a number or exhausted reprompts, move on to Q3
    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${LUKE_PERSONA}

They responded to your portfolio size question (Q2) with: "${lastUserMessage}"

Your task is to:
1. Acknowledge their answer naturally (even if it wasn't a number, just move on).
2. Ask them about their main pain points or what they're struggling with. This is Q3.
3. You can split your response into multiple messages using a new line to make it sound more natural.

Luke's pain point question patterns:
- "got you brother, that's a solid starting point.
what's the biggest challenge for you right now when it comes to investing?"
- "nice one man. so what are you struggling with most? what's holding you back?"
- "all good bro. tell me, what's the main thing you're trying to figure out or improve on?"
- "okay solid. and what's the biggest hurdle for you at the moment?"

Conversation so far:
${conversationContext}

Generate Luke's natural response to ask about their challenges without quotes.`],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const responseString = await chain.invoke({});
    const response = responseString.split('\n');
    const lastQuestion = response[response.length - 1];

    return {
        response: responseString,
        stage: 'answering_Q3' as ConversationStage,
        messages: [new AIMessage(responseString)],
        answers: { ...state.answers, Q2_portfolio_size: lastUserMessage },
        lastQuestionAsked: lastQuestion,
    };
}

export async function answeringQ3Node(state: GraphStateType, lastUserMessage: string) {
    const answers = { ...state.answers, Q3_pain_points: lastUserMessage };
    const portfolioSizeRaw = state.answers['Q2_portfolio_size'] as string || '0';
    const portfolioSize = parsePortfolioSize(portfolioSizeRaw) || 0;

    const isQualified = portfolioSize >= 50000;

    if (isQualified) {
        return {
            answers,
            isQualified: true,
            stage: 'qualified' as ConversationStage
        };
    } else {
        return {
            answers,
            isQualified: false,
            stage: 'nurture' as ConversationStage
        };
    }
}

export async function defaultConversationNode(state: GraphStateType, lastUserMessage: string, conversationContext: string) {
    const { stage: currentStage } = state;
    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${LUKE_PERSONA}

Current stage: ${currentStage}
They said: "${lastUserMessage}"

Respond naturally like Luke would, keeping the conversation going.
Do NOT end the conversation unless explicitly instructed.
Stay in the current stage (${currentStage}).

Luke's casual response patterns:
- "got you brother, tell me more"
- "nice man, what else you thinking about?"
- "solid! what's on your mind?"
- "awesome bro, what else you wanna know?"

Conversation so far:
${conversationContext}

Generate Luke's natural response without quotes.`],
    ]);
    
    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const response = await chain.invoke({});
    
    return {
        response,
        messages: [new AIMessage(response)],
        stage: currentStage
    };
} 