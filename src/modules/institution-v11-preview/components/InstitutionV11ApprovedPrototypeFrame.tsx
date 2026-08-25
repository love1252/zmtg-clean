export const INSTITUTION_V11_APPROVED_HOSPITAL_RUNTIME_PATH =
  '/hospital/institution-v1-1-approved';

export function InstitutionV11ApprovedPrototypeFrame() {
  return (
    <main
      aria-label="机构端 V1.1 Approved 工作区"
      className="fixed inset-0 z-[100] overflow-hidden bg-white"
      data-institution-v11-approved-runtime="true"
    >
      <iframe
        src={INSTITUTION_V11_APPROVED_HOSPITAL_RUNTIME_PATH}
        title="机构端 V1.1 Approved 完整界面"
        loading="eager"
        sandbox="allow-same-origin allow-scripts"
        className="block h-full w-full border-0 bg-white"
      />
    </main>
  );
}
