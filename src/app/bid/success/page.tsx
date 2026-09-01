import { redirect } from 'next/navigation';

export default async function BidSuccessRedirect(
  props: { searchParams: Promise<{ debate_id?: string; listing_id?: string }> }
) {
  const params = await props.searchParams;
  if (params.debate_id) {
    redirect(`/debate/${params.debate_id}`);
  }
  redirect('/');
}
