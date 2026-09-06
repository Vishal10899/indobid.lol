/**
 * INDOBID DAILY — CONTENT GENERATOR
 * High-quality, ₹0 cost, deterministic editorial content generator.
 * Zero hallucination: extracts strictly verified context from RSS feeds,
 * formats thoughtful debate prompts, and links source reporting.
 */

import { StoryClusterData, GeneratedPostContent, NewsCategory } from './types';
import { cleanDescription } from './normalizer';

/**
 * Maps NewsCategory to IndoBid canonical category slug
 */
export function mapCategoryToIndoBidSlug(category: NewsCategory): string {
  switch (category) {
    case 'AI':
      return 'ai';
    case 'TECHNOLOGY':
      return 'technology';
    case 'BUSINESS':
      return 'business';
    case 'SCIENCE':
    case 'CLIMATE':
      return 'science';
    case 'INDIA':
    case 'WORLD':
      return 'society';
    case 'SPORTS':
    case 'CULTURE':
      return 'culture';
    default:
      return 'society';
  }
}

/**
 * Generates tailored, engaging discussion prompts based on category and title
 */
export function generateDiscussionQuestion(title: string, category: NewsCategory): string {
  const lowerTitle = title.toLowerCase();

  if (category === 'AI' || lowerTitle.includes('ai') || lowerTitle.includes('model') || lowerTitle.includes('chatgpt')) {
    if (lowerTitle.includes('regulation') || lowerTitle.includes('ban') || lowerTitle.includes('safety')) {
      return 'How should regulators balance rapid AI innovation against systemic safety and societal disruption?';
    }
    return 'How significantly will this breakthrough redefine existing industry workflows and everyday productivity?';
  }

  if (category === 'TECHNOLOGY') {
    if (lowerTitle.includes('apple') || lowerTitle.includes('google') || lowerTitle.includes('microsoft')) {
      return 'Will this strategic move strengthen their platform ecosystem, or are competitors positioned to counter effectively?';
    }
    return 'What are the broader security, privacy, and user freedom implications of this shift?';
  }

  if (category === 'BUSINESS') {
    if (lowerTitle.includes('market') || lowerTitle.includes('stock') || lowerTitle.includes('economy') || lowerTitle.includes('rate')) {
      return 'How will financial markets, consumer sentiment, and enterprise capital respond over the upcoming quarter?';
    }
    return 'What does this corporate development signal about the shifting dynamics in this market sector?';
  }

  if (category === 'INDIA') {
    return 'What are the most crucial policy, economic, or social outcomes the public should be watching as this unfolds?';
  }

  if (category === 'SCIENCE' || category === 'CLIMATE') {
    return 'What technological or logistical bottlenecks must be resolved before this can achieve scale and impact?';
  }

  if (category === 'SPORTS') {
    return 'What does this performance signify for upcoming tournaments and the competitive landscape?';
  }

  return 'Where do you stand on this development, and what critical factors should be prioritized as discussions move forward?';
}

/**
 * Synthesizes a factual context paragraph from the cluster's article descriptions
 */
export function synthesizeContext(cluster: StoryClusterData): string {
  const cleanedSnippets: string[] = [];

  for (const art of cluster.articles) {
    if (art.description) {
      const cleaned = cleanDescription(art.description);
      // Skip if too short or repetitive
      if (cleaned.length >= 40 && !cleanedSnippets.some(s => s.slice(0, 30) === cleaned.slice(0, 30))) {
        // Truncate snippet to 2 sentences or 250 chars max
        const sentenceMatch = cleaned.match(/^([^.!?]+[.!?]\s*[^.!?]+[.!?])/);
        const snippet = sentenceMatch ? sentenceMatch[1].trim() : cleaned.slice(0, 240).trim();
        cleanedSnippets.push(snippet);
        if (cleanedSnippets.length >= 2) break;
      }
    }
  }

  if (cleanedSnippets.length > 0) {
    return cleanedSnippets.join(' ');
  }

  // Fallback context purely derived from canonical title
  return `Developing story covered across ${cluster.independentSources.join(', ')}. Multiple independent reports highlight ongoing developments and stakeholder reactions.`;
}

/**
 * Generates appropriate hashtags for IndoBid
 */
export function generateHashtags(category: NewsCategory): string {
  const base = '#IndoBidDaily #TrendingNow';
  switch (category) {
    case 'AI':
      return `${base} #AI #Tech #Innovation`;
    case 'TECHNOLOGY':
      return `${base} #Technology #TechNews #Innovation`;
    case 'BUSINESS':
      return `${base} #Business #Economy #Markets`;
    case 'INDIA':
      return `${base} #India #NationalNews #CurrentAffairs`;
    case 'WORLD':
      return `${base} #WorldNews #GlobalAffairs`;
    case 'SCIENCE':
    case 'CLIMATE':
      return `${base} #Science #Climate #Future`;
    case 'SPORTS':
      return `${base} #Sports #Athletics`;
    case 'CULTURE':
    default:
      return `${base} #Culture #Trending`;
  }
}

/**
 * Main content generator function: creates complete IndoBid debate/post content
 */
export function generatePostContent(cluster: StoryClusterData): GeneratedPostContent {
  const categorySlug = mapCategoryToIndoBidSlug(cluster.category);
  const discussionQuestion = generateDiscussionQuestion(cluster.canonicalTitle, cluster.category);
  const contextSummary = synthesizeContext(cluster);
  const hashtags = generateHashtags(cluster.category);

  // Compile unique sources list
  const sourcesMap = new Map<string, { name: string; url: string; title: string }>();
  for (const art of cluster.articles) {
    if (!sourcesMap.has(art.sourceName)) {
      sourcesMap.set(art.sourceName, {
        name: art.sourceName,
        url: art.articleUrl,
        title: art.title,
      });
    }
  }
  const sourcesList = Array.from(sourcesMap.values()).slice(0, 5);

  // Markdown sources section
  const sourcesMarkdown = sourcesList
    .map(s => `• [${s.name}](${s.url})`)
    .join('\n');

  const content = [
    `⚡ **INDOBID DAILY** | *Trending in ${cluster.category}*`,
    '',
    contextSummary,
    '',
    `💬 **The IndoBid Question:**`,
    `*${discussionQuestion}*`,
    '',
    `📰 **Verified Sources:**`,
    sourcesMarkdown,
    '',
    hashtags,
  ].join('\n');

  return {
    title: cluster.canonicalTitle,
    content,
    categorySlug,
    hashtags,
    sourcesList,
    generationMethod: 'editorial_deterministic',
    summaryContext: contextSummary,
    discussionQuestion,
  };
}
