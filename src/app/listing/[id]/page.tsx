import { redirect } from 'next/navigation';

export default async function LegacyListingPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  redirect(`/debate/${id}`);
}
