import HospitalCapabilityOffRoute from '../../[...slug]/page';

export const dynamic = 'force-dynamic';

export default async function HospitalConversationAutomationsCapabilityOffPage() {
  return HospitalCapabilityOffRoute({
    params: Promise.resolve({
      slug: ['conversations', 'automations'],
    }),
  });
}
