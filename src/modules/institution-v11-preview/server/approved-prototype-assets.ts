import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const APPROVED_PACKAGE_NAME = 'ZMTG_INSTITUTION_PROTOTYPE_V1_1_APPROVED';

export const APPROVED_PROTOTYPE_ROOT_CANDIDATES = [
  path.join(
    process.cwd(),
    '.codex-reference/institution-v1.1-approved',
    APPROVED_PACKAGE_NAME,
  ),
] as const;

const contentTypes: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const DOCUMENT_CLICK_DISPATCHER = "document.addEventListener('click',e=>{";
const PREVIEW_ACTION_PRIORITY_BRIDGE = [
  "document.addEventListener('click',e=>{",
  "const act=e.target.closest?.('[data-action]');",
  "if(!act||act.matches('select,input,textarea')||(act.classList.contains('backdrop')&&e.target!==act))return;",
  'e.preventDefault();',
  'e.stopImmediatePropagation();',
  'handleAction(act.dataset.action,act)',
  '},true);',
].join('');

export function prepareApprovedPrototypeHtml(html: string) {
  return html.replace(
    DOCUMENT_CLICK_DISPATCHER,
    `${PREVIEW_ACTION_PRIORITY_BRIDGE}${DOCUMENT_CLICK_DISPATCHER}`,
  );
}

export function resolveApprovedPrototypeAssetPath(
  root: string,
  segments: readonly string[],
) {
  if (segments.length === 0 || segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0'))) {
    return null;
  }

  const resolvedRoot = path.resolve(root);
  const resolvedAsset = path.resolve(resolvedRoot, ...segments);
  if (!resolvedAsset.startsWith(`${resolvedRoot}${path.sep}`)) return null;

  return resolvedAsset;
}

export function getApprovedPrototypeContentType(assetPath: string) {
  return contentTypes[path.extname(assetPath).toLowerCase()] ?? 'application/octet-stream';
}

export async function findApprovedPrototypePackageRoot(
  candidates: readonly string[] = APPROVED_PROTOTYPE_ROOT_CANDIDATES,
) {
  for (const candidate of candidates) {
    try {
      await access(path.join(candidate, 'institution.html'));
      return candidate;
    } catch {
      // Continue to the repository-owned read-only reference fallback.
    }
  }

  return null;
}

export async function readApprovedPrototypeAsset(
  segments: readonly string[],
  candidates: readonly string[] = APPROVED_PROTOTYPE_ROOT_CANDIDATES,
) {
  const root = await findApprovedPrototypePackageRoot(candidates);
  if (!root) return null;

  const assetPath = resolveApprovedPrototypeAssetPath(root, segments);
  if (!assetPath) return null;

  try {
    const sourceBytes = await readFile(assetPath);
    const isInstitutionHtml =
      segments.length === 1 && segments[0] === 'institution.html';

    return {
      bytes: isInstitutionHtml
        ? Buffer.from(prepareApprovedPrototypeHtml(sourceBytes.toString('utf8')))
        : sourceBytes,
      contentType: getApprovedPrototypeContentType(assetPath),
      assetPath,
      root,
    };
  } catch {
    return null;
  }
}
