import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/user-auth';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' || !process.env.ALLOW_DEMO_SEED) {
    console.log('⚠️ Demo data seeding is disabled for production safety.');
    console.log('IndoBid uses real database records only. Set ALLOW_DEMO_SEED=1 explicitly if needed in isolated local development.');
    return;
  }
  console.log('Seeding rich test debates for IndoBid.lol visual preview...');

  // Database wakeup retry loop
  for (let i = 0; i < 6; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      break;
    } catch (e) {
      console.log(`Database waking up... retry ${i + 1}/6`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // Ensure default categories exist
  const categoryDefs = [
    { slug: 'ai', name: 'AI', sortOrder: 1 },
    { slug: 'startups', name: 'Startups', sortOrder: 2 },
    { slug: 'money', name: 'Markets & Money', sortOrder: 3 },
    { slug: 'technology', name: 'Technology', sortOrder: 4 },
    { slug: 'society', name: 'Society', sortOrder: 5 },
    { slug: 'business', name: 'Business', sortOrder: 6 },
    { slug: 'politics', name: 'Politics', sortOrder: 7 },
    { slug: 'culture', name: 'Culture', sortOrder: 8 },
  ];

  const categories: Record<string, string> = {};

  for (const cat of categoryDefs) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: { slug: cat.slug, name: cat.name, sortOrder: cat.sortOrder },
    });
    categories[cat.slug] = record.id;
  }

  // Create or upsert demo users with verified statuses
  const demoUsers = [
    {
      username: 'rohan_tech',
      displayName: 'Rohan Sharma',
      bio: 'AI researcher & systems engineer. Writing about frontier models and cognitive architectures.',
      email: 'rohan@example.com',
      isVerified: true,
      rank: 1,
    },
    {
      username: 'aravind_ai',
      displayName: 'Aravind Swaminathan',
      bio: 'Machine learning practitioner. Scaling compute and reasoning experiments.',
      email: 'aravind@example.com',
      isVerified: true,
      rank: 3,
    },
    {
      username: 'priya_vc',
      displayName: 'Priya Mehta',
      bio: 'Deep tech angel investor & former founder. Skeptical optimist.',
      email: 'priya@example.com',
      isVerified: true,
      rank: 2,
    },
    {
      username: 'dev_kunal',
      displayName: 'Kunal Kapoor',
      bio: 'Building agents and autonomous workflows in Bangalore.',
      email: 'kunal@example.com',
      isVerified: false,
      rank: 5,
    },
    {
      username: 'kavya_builds',
      displayName: 'Kavya Reddy',
      bio: 'Bootstrapped founder @ SaaS. Passionate about profitability and unit economics.',
      email: 'kavya@example.com',
      isVerified: true,
      rank: 4,
    },
    {
      username: 'samir_capital',
      displayName: 'Samir Joshi',
      bio: 'Venture Partner. Backing Indian founders building for the globe.',
      email: 'samir@example.com',
      isVerified: true,
      rank: 6,
    },
    {
      username: 'ananya_macro',
      displayName: 'Ananya Desai',
      bio: 'Macroeconomist and public market strategist. Long India compounding.',
      email: 'ananya@example.com',
      isVerified: true,
      rank: 1,
    },
    {
      username: 'vikram_trades',
      displayName: 'Vikram Malhotra',
      bio: 'Derivatives trader and quant analyst. Managing volatility.',
      email: 'vikram@example.com',
      isVerified: false,
      rank: 8,
    },
    {
      username: 'tanmay_remote',
      displayName: 'Tanmay Verma',
      bio: 'Distributed work advocate. Living between Pune and the mountains.',
      email: 'tanmay@example.com',
      isVerified: false,
      rank: 10,
    },
    {
      username: 'aditya_dev',
      displayName: 'Aditya Nair',
      bio: 'Low-latency systems & Rust developer. Zero-overhead abstractions.',
      email: 'aditya@example.com',
      isVerified: true,
      rank: 7,
    },
  ];

  const userMap: Record<string, string> = {};

  for (const u of demoUsers) {
    const saltHash = hashPassword('Password123!');
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        displayName: u.displayName,
        bio: u.bio,
        isVerified: u.isVerified,
        rank: u.rank,
      },
      create: {
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        bio: u.bio,
        isVerified: u.isVerified,
        passwordHash: saltHash,
        rank: u.rank,
      },
    });
    userMap[u.username] = user.id;
  }

  // Create Demo Debates
  const debatesToSeed = [
    {
      slug: 'ai-scaling-plateau',
      title: 'AGI will not be solved through LLM scaling alone — fundamental world models are required.',
      content:
        'Autoregressive language models predict next tokens with impressive accuracy, but lack true world models, causal reasoning, and persistent memory. Pouring billions into compute scaling without architectural breakthroughs in spatial reasoning and sensorimotor grounding will yield diminishing returns before achieving true artificial general intelligence.',
      categorySlug: 'ai',
      authorUsername: 'rohan_tech',
      authorDisplayName: 'Rohan Sharma',
      hashtags: '#AI #FutureOfAI #DeepLearning',
      originalContribution: 5000, // ₹50
      likeCount: 42,
      impressionCount: 1450,
      contributions: [
        {
          authorUsername: 'rohan_tech',
          authorDisplayName: 'Rohan Sharma',
          amount: 5000, // ₹50
          sequence: 1,
          content:
            'Autoregressive language models predict next tokens with impressive accuracy, but lack true world models, causal reasoning, and persistent memory. Pouring billions into compute scaling without architectural breakthroughs in spatial reasoning and sensorimotor grounding will yield diminishing returns before achieving true artificial general intelligence.',
        },
        {
          authorUsername: 'aravind_ai',
          authorDisplayName: 'Aravind Swaminathan',
          amount: 7500, // ₹75
          sequence: 2,
          content:
            'Scaling compute already unlocks unexpected emergent behavior. Reasoning models that perform search over thought chains at inference time (test-time compute) bridge the reasoning gap without needing to rebuild entire foundational architectures from scratch.',
        },
        {
          authorUsername: 'priya_vc',
          authorDisplayName: 'Priya Mehta',
          amount: 12000, // ₹120
          sequence: 3,
          content:
            'Inference compute search is still bounded by token probability spaces. Without embodied interaction and sensory feedback loops, AI systems remain statistical mimics unable to ground knowledge in physical reality.',
        },
        {
          authorUsername: 'dev_kunal',
          authorDisplayName: 'Kunal Kapoor',
          amount: 20000, // ₹200
          sequence: 4,
          content:
            'The massive economic incentives will force hybrid neuro-symbolic integrations by 2027. We are already seeing tool-calling, state graphs, and external memory systems augment raw model limits effectively in production.',
        },
      ],
    },
    {
      slug: 'bootstrapping-vs-vc-india',
      title: 'Bootstrapping to ₹10 Crore ARR in India is now faster and healthier than early-stage VC funding.',
      content:
        'With low cloud overhead, global distribution via modern developer channels, and access to domestic engineering talent, Indian founders can reach ₹10 Crore ($1.2M) ARR profitably in under 24 months. Early-stage venture capital introduces misaligned growth mandates, premature scaling, and heavy dilution before product-market fit.',
      categorySlug: 'startups',
      authorUsername: 'kavya_builds',
      authorDisplayName: 'Kavya Reddy',
      hashtags: '#Startups #SaaS #Bootstrapping',
      originalContribution: 2500, // ₹25
      likeCount: 28,
      impressionCount: 980,
      contributions: [
        {
          authorUsername: 'kavya_builds',
          authorDisplayName: 'Kavya Reddy',
          amount: 2500, // ₹25
          sequence: 1,
          content:
            'With low cloud overhead, global distribution via modern developer channels, and access to domestic engineering talent, Indian founders can reach ₹10 Crore ($1.2M) ARR profitably in under 24 months. Early-stage venture capital introduces misaligned growth mandates, premature scaling, and heavy dilution before product-market fit.',
        },
        {
          authorUsername: 'samir_capital',
          authorDisplayName: 'Samir Joshi',
          amount: 4000, // ₹40
          sequence: 2,
          content:
            'VC is an accelerant, not a handicap. For category-defining global software companies originating in Bangalore, market windows are narrow. Capital front-loading allows you to hire top-tier go-to-market leaders in the US and preempt copycats before competitors solidify market share.',
        },
        {
          authorUsername: 'kavya_builds',
          authorDisplayName: 'Kavya Reddy',
          amount: 6000, // ₹60
          sequence: 3,
          content:
            'Premature dilution creates misaligned board pressures that prioritize vanity metrics over customer retention. Building a profitable business gives founders complete sovereignty and optionality to raise growth capital later on their own terms.',
        },
      ],
    },
    {
      slug: 'indian-markets-compounding',
      title: 'Indian equity markets will outperform the S&P 500 over the next decade due to domestic SIP inflows.',
      content:
        'The structural shift in Indian household wealth from physical assets (gold, real estate) to financial assets is unprecedented. Domestic mutual fund SIP inflows exceeding ₹25,000 Crore every month create an institutional liquidity floor that insulates the Indian economy from foreign capital flight and powers domestic compounding.',
      categorySlug: 'money',
      authorUsername: 'ananya_macro',
      authorDisplayName: 'Ananya Desai',
      hashtags: '#Markets #Investing #Economy',
      originalContribution: 10000, // ₹100
      likeCount: 56,
      impressionCount: 2400,
      contributions: [
        {
          authorUsername: 'ananya_macro',
          authorDisplayName: 'Ananya Desai',
          amount: 10000, // ₹100
          sequence: 1,
          content:
            'The structural shift in Indian household wealth from physical assets (gold, real estate) to financial assets is unprecedented. Domestic mutual fund SIP inflows exceeding ₹25,000 Crore every month create an institutional liquidity floor that insulates the Indian economy from foreign capital flight and powers domestic compounding.',
        },
        {
          authorUsername: 'vikram_trades',
          authorDisplayName: 'Vikram Malhotra',
          amount: 15000, // ₹150
          sequence: 2,
          content:
            'Indian equities are currently trading at peak historical valuation multiples. When mid-cap indices trade at 35x+ P/E, any slowdown in corporate earnings growth below 14% triggers severe price corrections, regardless of domestic retail liquidity support.',
        },
        {
          authorUsername: 'ananya_macro',
          authorDisplayName: 'Ananya Desai',
          amount: 25000, // ₹250
          sequence: 3,
          content:
            'P/E multiples reflect return on equity and generational demographic tailwinds. India will generate 20%+ of global GDP incremental growth this decade. Valuation expansion is justified when supported by high single-digit real GDP growth and infrastructure investments.',
        },
      ],
    },
    {
      slug: 'remote-work-deep-work',
      title: 'Distributed async work produces higher-quality software architecture than co-located office teams.',
      content:
        'Writing clear architecture decision records (ADRs), asynchronous pull request reviews, and uninterrupted deep focus blocks result in modular, resilient codebases. Colocated offices favor conversational consensus and extroverted meeting culture over rigorous written technical specifications.',
      categorySlug: 'society',
      authorUsername: 'tanmay_remote',
      authorDisplayName: 'Tanmay Verma',
      hashtags: '#RemoteWork #EngineeringCulture #Productivity',
      originalContribution: 1500, // ₹15
      likeCount: 21,
      impressionCount: 720,
      contributions: [
        {
          authorUsername: 'tanmay_remote',
          authorDisplayName: 'Tanmay Verma',
          amount: 1500, // ₹15
          sequence: 1,
          content:
            'Writing clear architecture decision records (ADRs), asynchronous pull request reviews, and uninterrupted deep focus blocks result in modular, resilient codebases. Colocated offices favor conversational consensus and extroverted meeting culture over rigorous written technical specifications.',
        },
        {
          authorUsername: 'rohan_tech',
          authorDisplayName: 'Rohan Sharma',
          amount: 2500, // ₹25
          sequence: 2,
          content:
            'Async documentation is critical, but whiteboard debugging and high-bandwidth architectural debates when architecting distributed microservices from scratch still happen 5x faster in a room together.',
        },
      ],
    },
    {
      slug: 'rust-replacing-cpp',
      title: 'Rust will replace C++ in mission-critical infrastructure and low-latency systems by 2030.',
      content:
        'Memory safety vulnerabilities account for over 70% of all critical CVEs in enterprise infrastructure. Rust provides zero-cost abstractions, deterministic memory management without garbage collection, and modern package tooling that eliminates the entire class of buffer overflow exploits natively.',
      categorySlug: 'technology',
      authorUsername: 'aditya_dev',
      authorDisplayName: 'Aditya Nair',
      hashtags: '#Rust #SystemsProgramming #Security',
      originalContribution: 1000, // ₹10
      likeCount: 35,
      impressionCount: 1100,
      contributions: [
        {
          authorUsername: 'aditya_dev',
          authorDisplayName: 'Aditya Nair',
          amount: 1000, // ₹10
          sequence: 1,
          content:
            'Memory safety vulnerabilities account for over 70% of all critical CVEs in enterprise infrastructure. Rust provides zero-cost abstractions, deterministic memory management without garbage collection, and modern package tooling that eliminates the entire class of buffer overflow exploits natively.',
        },
        {
          authorUsername: 'vikram_trades',
          authorDisplayName: 'Vikram Malhotra',
          amount: 2000, // ₹20
          sequence: 2,
          content:
            'In ultra-low-latency HFT matching engines and specialized compiler toolchains, millions of lines of optimized C++ codebase with custom memory layouts will not be rewritten. Modern C++20/23 concepts and static sanitizers are closing the safety gap without rewrite overhead.',
        },
      ],
    },
  ];

  for (const d of debatesToSeed) {
    const categoryId = categories[d.categorySlug] || Object.values(categories)[0];
    const authorId = userMap[d.authorUsername] || null;

    const totalVerified = d.contributions.reduce((sum, c) => sum + c.amount, 0);
    const lastAmount = d.contributions[d.contributions.length - 1].amount;
    const count = d.contributions.length;
    const trendingScore = (totalVerified / 100) * 1.5 + d.likeCount * 2 + count * 5;

    // Create or update Debate
    const existing = await prisma.debate.findFirst({
      where: { title: d.title },
    });

    let debateId = existing?.id;

    if (!existing) {
      const debate = await prisma.debate.create({
        data: {
          title: d.title,
          content: d.content,
          categoryId,
          authorId,
          authorUsername: d.authorUsername,
          authorDisplayName: d.authorDisplayName,
          hashtags: d.hashtags,
          originalContribution: d.originalContribution,
          totalVerifiedContribution: totalVerified,
          lastContributionAmount: lastAmount,
          contributionCount: count,
          status: 'active',
          trendingScore,
          likeCount: d.likeCount,
          impressionCount: d.impressionCount,
          lastContributionAt: new Date(),
        },
      });
      debateId = debate.id;
    } else {
      await prisma.debate.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          totalVerifiedContribution: totalVerified,
          lastContributionAmount: lastAmount,
          contributionCount: count,
          trendingScore,
          likeCount: d.likeCount,
          impressionCount: d.impressionCount,
        },
      });
    }

    if (debateId) {
      // Clear old contributions and re-seed clean chain
      await prisma.contribution.deleteMany({ where: { debateId } });
      await prisma.debateActivityEvent.deleteMany({ where: { debateId } });

      for (const c of d.contributions) {
        const contribAuthorId = userMap[c.authorUsername] || null;
        const contrib = await prisma.contribution.create({
          data: {
            debateId,
            authorId: contribAuthorId,
            authorUsername: c.authorUsername,
            authorDisplayName: c.authorDisplayName,
            amount: c.amount,
            sequence: c.sequence,
            content: c.content,
            status: 'verified',
            verifiedAt: new Date(),
          },
        });

        // Add corresponding activity event
        await prisma.debateActivityEvent.create({
          data: {
            debateId,
            contributionId: contrib.id,
            type: c.sequence === 1 ? 'new_debate' : 'continued_debate',
            authorUsername: c.authorUsername,
            authorDisplayName: c.authorDisplayName,
            amount: c.amount,
            title: d.title,
            message:
              c.sequence === 1
                ? `@${c.authorUsername} started opinion with ₹${c.amount / 100} backed`
                : `@${c.authorUsername} continued debate with ₹${c.amount / 100} backed`,
          },
        });
      }
    }
  }

  console.log('✓ Successfully seeded 5 rich demo debates with active contribution chains!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
