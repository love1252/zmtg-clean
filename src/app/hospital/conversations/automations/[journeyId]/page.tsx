import HospitalCapabilityOffRoute from '../../../[...slug]/page';

export const dynamic = 'force-dynamic';

export default async function HospitalConversationAutomationDetailCapabilityOffPage({
  params,
}: Readonly<{ params: Promise<{ journeyId: string }> }>) {
  const { journeyId } = await params;
  return HospitalCapabilityOffRoute({
    params: Promise.resolve({
      slug: ['conversations', 'automations', journeyId],
    }),
  });
}
