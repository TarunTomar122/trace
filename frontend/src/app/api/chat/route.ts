import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are Trace, a friendly AI assistant helping users build their personalized content feed profile.

CRITICAL INSTRUCTIONS:
- ONLY ask about fields listed in "Missing fields".
- Ask ONE question at a time.
- Keep responses concise (2-3 sentences max).
- Do NOT ask anything outside missing fields.

After each user response, extract any relevant info and include it in a JSON block at the end of your response like this:
<insights>
{
  "location": "string",
  "experienceYears": number,
  "currentWork": { "project": "string", "focus": "string" },
  "projects": ["string"],
  "goals": { "shortTerm": "string", "longTerm": "string" },
  "learningStyle": "string",
  "attentionConstraints": "string",
  "motivationTriggers": ["string"],
  "contentPreferences": { "likes": ["string"], "dislikes": ["string"] },
  "favoriteSources": ["string"],
  "personalityTraits": ["string"],
  "petPeeves": ["string"],
  "interests": ["string"],
  "hobbies": ["string"],
  "skills": ["string"],
  "dislikedTopics": ["string"]
}
</insights>

Only include fields that you learned from THIS message. If no new insights, still include an empty <insights>{}</insights> block.

If there are no missing fields, respond briefly and ask if they'd like to update anything else about their profile (one optional question).`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages = [], profile = {} } = body;

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const missingFields: string[] = [];
    const isEmptyString = (value?: string | null) => !value || value.trim().length === 0;
    const isEmptyArray = (value?: unknown[]) => !Array.isArray(value) || value.length === 0;

    if (isEmptyString(profile?.location)) missingFields.push('location');
    if (profile?.experienceYears === null || profile?.experienceYears === undefined) missingFields.push('experienceYears');
    if (isEmptyString(profile?.currentWork?.project)) missingFields.push('currentWork.project');
    if (isEmptyString(profile?.currentWork?.focus)) missingFields.push('currentWork.focus');
    if (isEmptyArray(profile?.projects)) missingFields.push('projects');
    if (isEmptyString(profile?.goals?.shortTerm)) missingFields.push('goals.shortTerm');
    if (isEmptyString(profile?.goals?.longTerm)) missingFields.push('goals.longTerm');
    if (isEmptyString(profile?.learningStyle)) missingFields.push('learningStyle');
    if (isEmptyString(profile?.attentionConstraints)) missingFields.push('attentionConstraints');
    if (isEmptyArray(profile?.motivationTriggers)) missingFields.push('motivationTriggers');
    if (isEmptyArray(profile?.contentPreferences?.likes)) missingFields.push('contentPreferences.likes');
    if (isEmptyArray(profile?.contentPreferences?.dislikes)) missingFields.push('contentPreferences.dislikes');
    if (isEmptyArray(profile?.favoriteSources)) missingFields.push('favoriteSources');
    if (isEmptyArray(profile?.personalityTraits)) missingFields.push('personalityTraits');
    if (isEmptyArray(profile?.petPeeves)) missingFields.push('petPeeves');
    if (isEmptyArray(profile?.interests)) missingFields.push('interests');
    if (isEmptyArray(profile?.hobbies)) missingFields.push('hobbies');
    if (isEmptyArray(profile?.skills)) missingFields.push('skills');
    if (isEmptyArray(profile?.dislikedTopics)) missingFields.push('dislikedTopics');

    // Build context about the user
    const userContext = `
Current user profile:
- Name: ${profile?.name || 'Unknown'}
- Role: ${profile?.role || 'Unknown'}
- Company: ${profile?.company || 'Not specified'}
- Location: ${profile?.location || 'Not specified'}
- Experience years: ${profile?.experienceYears ?? 'Not specified'}
- Current work: ${profile?.currentWork?.project || 'Not specified'} | ${profile?.currentWork?.focus || 'Not specified'}
- Projects: ${profile?.projects?.join(', ') || 'Not specified'}
- Goals: ${profile?.goals?.shortTerm || 'Not specified'} | ${profile?.goals?.longTerm || 'Not specified'}
- Learning style: ${profile?.learningStyle || 'Not specified'}
- Attention constraints: ${profile?.attentionConstraints || 'Not specified'}
- Motivation triggers: ${profile?.motivationTriggers?.join(', ') || 'Not specified'}
- Interests: ${profile?.interests?.join(', ') || 'Not specified'}
- Hobbies: ${profile?.hobbies?.join(', ') || 'Not specified'}
- Skills: ${profile?.skills?.join(', ') || 'Not specified'}
- Disliked topics: ${profile?.dislikedTopics?.join(', ') || 'Not specified'}
- Content likes: ${profile?.contentPreferences?.likes?.join(', ') || 'Not specified'}
- Content dislikes: ${profile?.contentPreferences?.dislikes?.join(', ') || 'Not specified'}
- Favorite sources: ${profile?.favoriteSources?.join(', ') || 'Not specified'}
- Personality traits: ${profile?.personalityTraits?.join(', ') || 'Not specified'}
- Pet peeves: ${profile?.petPeeves?.join(', ') || 'Not specified'}
- Content depth preference: ${profile?.contentDepth || 'Not specified'}
- Existing insights: ${JSON.stringify(profile?.insights || {})}

Missing fields (ONLY ask about these): ${missingFields.length > 0 ? missingFields.join(', ') : 'none'}
`;

    // Build messages array for OpenAI
    const openaiMessages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT + '\n\n' + userContext,
      },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // If no user messages yet, add a prompt to start the conversation
    if (messages.length === 0) {
      openaiMessages.push({
        role: 'user',
        content: 'Hi! I just signed up and want to personalize my feed.',
      });
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: openaiMessages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to get AI response' },
        { status: 500 }
      );
    }

    const data = await openaiResponse.json();
    const aiMessage = data.choices[0].message.content;

    // Extract insights from the response
    const insightsMatch = aiMessage.match(/<insights>([\s\S]*?)<\/insights>/);
    let insights = {};
    if (insightsMatch) {
      try {
        insights = JSON.parse(insightsMatch[1]);
      } catch {
        insights = {};
      }
    }

    // Remove insights block from displayed message
    const cleanMessage = aiMessage.replace(/<insights>[\s\S]*?<\/insights>/, '').trim();

    return NextResponse.json({ 
      message: cleanMessage,
      insights 
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
