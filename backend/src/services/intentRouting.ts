/**
 * Intent Routing Utilities (Backend)
 *
 * Three-Mode System for Voice Command Classification:
 * 1. 💬 General Questions
 * 2. 📚 App Related Questions
 * 3. ⚡ Commands
 */

/**
 * Detect if query is a knowledge-seeking question
 */
export const isKnowledgeQuestion = (query: string): boolean => {
  const queryLower = query.toLowerCase().trim();
  return (
    /^(what|who|when|where|why|how|tell me|explain)\b/.test(queryLower) ||
    queryLower.includes('what is') ||
    queryLower.includes('tell me about')
  );
};

/**
 * Adjust similarity threshold based on query characteristics
 */
export const adjustThreshold = (
  baseThreshold: number,
  isQuestion: boolean,
): number => {
  return isQuestion ? baseThreshold + 0.3 : baseThreshold;
};

/**
 * Detect informational intent
 */
export const hasInformationalIntent = (query: string): boolean => {
  const queryLower = query.toLowerCase().trim();

  const informationalPatterns = [
    /tell me about/i,
    /what (kind|type|sort) of/i,
    /what .* (exist|available|are there)/i,
    /^explain\b/i,
    /^describe\b/i,
    /^list\b/i,
    /how many/i,
    /how much/i,
    /^show me/i,
    /what are/i,
    /what is/i,
    /what does\b/i,
    /what can\b/i,
    /how does\b/i,
    /how do .*(work|function|operate)/i,
    /^which\b/i,
    /which .*(available|supported|exist|there|have)/i,
    /can you (tell|explain|describe|list|show)/i,
    /do you (support|have|know)/i,
  ];

  return informationalPatterns.some((pattern) => pattern.test(queryLower));
};
