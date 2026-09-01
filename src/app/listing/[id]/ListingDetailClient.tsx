'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function ListingDetailClient({ id }: { id?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (id) {
      router.replace(`/debate/${id}`);
    } else {
      router.replace('/');
    }
  }, [id, router]);

  return null;
}
