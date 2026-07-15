/* ============================================================
   GITHUB — publishes site-config.json to the repo.
   The personal access token lives ONLY in this device's
   localStorage; it is never written into the config or the repo.
   ============================================================ */
import { state, getToken } from './state.js';

function repoInfo() {
  const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content?.trim() || '';
  const g = state.config?.meta?.github || {};
  const owner = g.owner || meta('github-owner');
  const repo = g.repo || meta('github-repo');
  const branch = g.branch || meta('github-branch') || 'main';
  return { owner, repo, branch };
}

const b64 = (str) => btoa(unescape(encodeURIComponent(str)));

/**
 * Push the current config to <repo>/site-config.json.
 * Returns { ok, msg }. Handles fresh-SHA fetch + one 409/422 retry.
 */
export async function publishConfig() {
  const token = getToken();
  if (!token) return { ok: false, msg: 'No GitHub token saved. Add one in the theme studio.' };

  const { owner, repo, branch } = repoInfo();
  if (!owner || !repo) return { ok: false, msg: 'Repo not configured (meta tags or config.meta.github).' };

  state.config.updatedAt = Date.now();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/site-config.json`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const freshSha = async () => {
    const r = await fetch(`${url}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`, { headers, cache: 'no-store' });
    if (r.ok) return (await r.json()).sha;
    if (r.status === 404) return undefined; // file doesn't exist yet — create it
    throw new Error(`read ${r.status}`);
  };

  const put = (sha) => fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Update site content',
      content: b64(JSON.stringify(state.config, null, 2)),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  try {
    let res = await put(await freshSha());
    if (res.status === 409 || res.status === 422) res = await put(await freshSha()); // retry once on SHA race
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, msg: err.message || `GitHub HTTP ${res.status}` };
    }
    return { ok: true, msg: 'Published — live in ~1 minute' };
  } catch (e) {
    return { ok: false, msg: e.message || 'Network error' };
  }
}
