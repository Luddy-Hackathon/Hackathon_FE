export interface PromptData {
  username?: string;
  projectContext?: string;
  additionalInstructions?: string;
}

// Sample guidelines that would normally come from a database
const SAMPLE_GUIDELINES = `
1. Be helpful, concise, and accurate.
2. Prioritize user needs and provide clear explanations.
3. When suggesting code, ensure it follows best practices.
4. Respect privacy and confidentiality.
`;

// Sample knowledge base entries
const KNOWLEDGE_BASE = [
  {
    keywords: ['react', 'component', 'props', 'state'],
    content: 'React components use props for input and state for internal data management.'
  },
  {
    keywords: ['typescript', 'type', 'interface'],
    content: 'TypeScript adds static typing to JavaScript. Use interfaces for object shapes and types for primitives.'
  },
  {
    keywords: ['next.js', 'nextjs', 'routing', 'page'],
    content: 'Next.js provides file-based routing and server-side rendering capabilities.'
  }
];

/**
 * Build a dynamic system prompt for the AI
 */
export async function buildSystemPrompt(data: PromptData = {}): Promise<string> {
  // Base system prompt
  let systemPrompt = `You are an AI assistant designed to help users with their project.

${data.username ? `You are speaking with ${data.username}.` : ''}`;

  // Add project context if available
  if (data.projectContext) {
    systemPrompt += `\n\nProject Context: ${data.projectContext}`;
  }

  // Add guidelines
  systemPrompt += `\n\nCompany Guidelines: ${SAMPLE_GUIDELINES}`;

  // Add additional instructions if provided
  if (data.additionalInstructions) {
    systemPrompt += `\n\n${data.additionalInstructions}`;
  }

  return systemPrompt;
}

/**
 * Get relevant knowledge from the in-memory knowledge base based on the user's query
 */
export async function getRelevantKnowledge(query: string): Promise<string | null> {
  try {
    const queryWords = query.toLowerCase().split(/\s+/);
    
    // Find relevant knowledge entries
    const relevantEntries = KNOWLEDGE_BASE.filter(entry => {
      return entry.keywords.some(keyword => 
        queryWords.includes(keyword.toLowerCase())
      );
    });

    if (relevantEntries.length > 0) {
      return relevantEntries.map(entry => entry.content).join('\n\n');
    }

    return null;
  } catch (error) {
    console.error('Error in getRelevantKnowledge:', error);
    return null;
  }
} 