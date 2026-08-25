import { notFound, redirect } from 'next/navigation';

import { isInstitutionV11VisualPreviewEnabled } from '@/modules/institution-v11-preview/server/visual-preview-gate';

export default function InstitutionV11PreviewPage() {
  if (!isInstitutionV11VisualPreviewEnabled()) notFound();

  redirect('/institution-v1-1-preview/reference/institution.html');
}
