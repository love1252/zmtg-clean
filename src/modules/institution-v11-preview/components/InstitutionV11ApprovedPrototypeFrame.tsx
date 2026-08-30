'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export const INSTITUTION_V11_APPROVED_HOSPITAL_RUNTIME_PATH =
  '/hospital/institution-v1-1-approved';
export const INSTITUTION_V11_APPROVED_LOGOUT_MESSAGE =
  'institution-v11:logout-complete';

export function InstitutionV11ApprovedPrototypeFrame() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleRuntimeMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow ||
        typeof event.data !== 'object' ||
        event.data === null ||
        !('type' in event.data) ||
        event.data.type !== INSTITUTION_V11_APPROVED_LOGOUT_MESSAGE
      ) {
        return;
      }

      router.replace('/login');
    };

    window.addEventListener('message', handleRuntimeMessage);
    return () => window.removeEventListener('message', handleRuntimeMessage);
  }, [router]);

  return (
    <main
      aria-label="机构端 V1.1 Approved 工作区"
      className="fixed inset-0 z-[100] overflow-hidden bg-white"
      data-institution-v11-approved-runtime="true"
    >
      <iframe
        ref={frameRef}
        src={INSTITUTION_V11_APPROVED_HOSPITAL_RUNTIME_PATH}
        title="机构端 V1.1 Approved 完整界面"
        loading="eager"
        sandbox="allow-same-origin allow-scripts"
        className="block h-full w-full border-0 bg-white"
      />
    </main>
  );
}
