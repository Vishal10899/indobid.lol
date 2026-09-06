/**
 * INDOBID DAILY — PUBLISHER
 * Publishes verified story clusters as permanent IndoBid posts under the
 * system author @indobiddaily.
 */

import { StoryClusterData } from './types';
import { generatePostContent } from './content-generator';
import { prisma } from '@/infrastructure/database/prisma';

export const INDOBID_DAILY_BOT_USERNAME = 'indobiddaily';
export const INDOBID_DAILY_BOT_EMAIL = 'indobiddaily@indobid.lol';
export const INDOBID_DAILY_BOT_NAME = 'IndoBid Daily';

/**
 * Ensures the system bot account exists in the database
 */
export async function getOrCreateSystemBot() {
  let bot = await prisma.user.findFirst({
    where: {
      OR: [
        { username: INDOBID_DAILY_BOT_USERNAME },
        { email: INDOBID_DAILY_BOT_EMAIL },
      ],
    },
  });

  if (!bot) {
    bot = await prisma.user.create({
      data: {
        username: INDOBID_DAILY_BOT_USERNAME,
        displayName: INDOBID_DAILY_BOT_NAME,
        email: INDOBID_DAILY_BOT_EMAIL,
        isVerified: true,
        role: 'user',
        bio: 'Automated 24/7 world and national trend intelligence engine for IndoBid.',
      },
    });
  } else if (!bot.isVerified) {
    // Ensure verified badge is active
    bot = await prisma.user.update({
      where: { id: bot.id },
      data: { isVerified: true },
    });
  }

  return bot;
}

/**
 * Publishes a story cluster as a permanent IndoBid Debate/Post
 */
export async function publishStoryCluster(cluster: StoryClusterData): Promise<{
  debateId: string;
  clusterId: string;
  automatedPostId: string;
  title: string;
}> {
  const botUser = await getOrCreateSystemBot();
  const generated = generatePostContent(cluster);

  // 1. Resolve Category
  let category = await prisma.category.findFirst({
    where: { slug: generated.categorySlug },
  });

  if (!category) {
    // Fallback to society or any category
    category = await prisma.category.findFirst({
      where: { slug: 'society' },
    });
    if (!category) {
      category = await prisma.category.findFirst();
    }
  }

  if (!category) {
    throw new Error(`Cannot publish: No category found for slug ${generated.categorySlug}`);
  }

  // 2. Upsert StoryCluster record
  const dbCluster = await prisma.storyCluster.upsert({
    where: { fingerprint: cluster.fingerprint },
    update: {
      canonicalTitle: cluster.canonicalTitle,
      category: cluster.category,
      region: cluster.region,
      sourceCount: cluster.sourceCount,
      trendScore: cluster.trendScore,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      lastSeenAt: cluster.lastSeenAt,
    },
    create: {
      fingerprint: cluster.fingerprint,
      canonicalTitle: cluster.canonicalTitle,
      category: cluster.category,
      region: cluster.region,
      sourceCount: cluster.sourceCount,
      trendScore: cluster.trendScore,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      firstSeenAt: cluster.firstSeenAt,
      lastSeenAt: cluster.lastSeenAt,
    },
  });

  // 3. Save NewsArticles linked to this cluster (ignore duplicate URLs gracefully)
  for (const art of cluster.articles) {
    await prisma.newsArticle.upsert({
      where: { articleUrl: art.articleUrl },
      update: {
        clusterId: dbCluster.id,
      },
      create: {
        sourceId: art.sourceId,
        sourceName: art.sourceName,
        title: art.title,
        normalizedTitle: art.normalizedTitle,
        description: art.description || null,
        articleUrl: art.articleUrl,
        fingerprint: art.fingerprint,
        category: art.category,
        region: art.region,
        publishedAt: art.publishedAt,
        clusterId: dbCluster.id,
      },
    }).catch(err => {
      // Ignore individual article upsert errors if duplicate
      console.warn(`[IndoBid Daily] Non-fatal article upsert error: ${err.message}`);
    });
  }

  // 4. Create Debate (Permanent Post)
  const debate = await prisma.debate.create({
    data: {
      authorId: botUser.id,
      authorUsername: botUser.username || INDOBID_DAILY_BOT_USERNAME,
      authorDisplayName: botUser.displayName || INDOBID_DAILY_BOT_NAME,
      title: generated.title,
      content: generated.content,
      categoryId: category.id,
      isAutomated: true,
      status: 'active',
      hashtags: generated.hashtags,
      originalContribution: 0,
      totalVerifiedContribution: 0,
      contributionCount: 1,
      trendingScore: cluster.trendScore,
    },
  });

  // 5. Create Sequence 1 Contribution
  await prisma.contribution.create({
    data: {
      debateId: debate.id,
      authorId: botUser.id,
      content: generated.content,
      sequence: 1,
      amount: 0,
      status: 'verified',
      authorUsername: botUser.username || INDOBID_DAILY_BOT_USERNAME,
      authorDisplayName: botUser.displayName || INDOBID_DAILY_BOT_NAME,
    },
  });

  // 6. Create AutomatedPost record
  const automatedPost = await prisma.automatedPost.create({
    data: {
      debateId: debate.id,
      clusterId: dbCluster.id,
      trendScore: cluster.trendScore,
      confidenceScore: 1.0,
      sourceCount: cluster.sourceCount,
      sourcesJson: JSON.stringify(generated.sourcesList),
      generationMethod: generated.generationMethod,
    },
  });

  return {
    debateId: debate.id,
    clusterId: dbCluster.id,
    automatedPostId: automatedPost.id,
    title: debate.title,
  };
}
