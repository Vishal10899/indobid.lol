import React from 'react';
import { Metadata } from 'next';
import { getDebateById } from '@/lib/debates';
import { DebateDetailClient } from './DebateDetailClient';
import { formatINR } from '@/lib/money';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await props.params;
  const debate = await getDebateById(id);

  if (!debate) {
    return {
      title: 'Debate Not Found — IndoBid',
      description: 'The requested debate is unavailable or still pending verification.',
    };
  }

  const title = `${debate.title} — IndoBid`;
  const description = `${debate.content.substring(0, 160)}... (${formatINR(debate.totalVerifiedContribution)} contributed across ${debate.contributionCount} contributions)`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://indobid.lol/debate/${debate.id}`,
      siteName: 'IndoBid.lol',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

import { AuthGate } from '@/components/AuthGate';

export default async function DebatePage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const debate = await getDebateById(id);

  if (!debate) {
    notFound();
  }

  return (
    <AuthGate>
      <DebateDetailClient initialDebate={JSON.parse(JSON.stringify(debate))} />
    </AuthGate>
  );
}
