// Bridges the two places this app runs.
//
//   Published as a Claude Artifact — Claude and storage come from the page's
//   runtime capabilities. Nothing to configure: it uses the viewer's own
//   Claude account and the artifact's database.
//
//   Served from a local folder — there is no runtime, so AI runs through the
//   Anthropic SDK with a key you supply, and everything is stored in IndexedDB.
//
// Every getter resolves null when its capability isn't there, and every caller
// is expected to degrade rather than fail.

const runtime = typeof window !== 'undefined' ? window.claude : undefined;

function useCapability(name) {
  if (!runtime?.use) return Promise.resolve(null);
  return Promise.resolve(runtime.use(name)).catch(() => null);
}

let samplePromise = null;
let dbPromise = null;
let downloadsPromise = null;

/** Claude, via the viewer's account. Null when the page isn't in a viewer. */
export function getSample() {
  if (!samplePromise) samplePromise = useCapability('sample');
  return samplePromise;
}

/** The artifact's shared document store. Null when running locally. */
export function getDb() {
  if (!dbPromise) dbPromise = useCapability('db');
  return dbPromise;
}

export function getDownloads() {
  if (!downloadsPromise) downloadsPromise = useCapability('downloads');
  return downloadsPromise;
}

/** Whether this view can send photos to Claude — images are a per-view grant. */
export async function sampleLimits() {
  const sample = await getSample();
  if (!sample?.limits) return null;
  try {
    return await sample.limits();
  } catch {
    return null;
  }
}

export const isHosted = () => Boolean(runtime?.use);

/** Turn a rejected sample() into copy worth showing a person. */
export function describeSampleError(err) {
  const code = err?.code;
  switch (code) {
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
    case 'capability_removed':
      return new Error('Claude is not available on this page right now.');
    case 'images_unavailable':
      return new Error('This view cannot send photos to Claude. You can still tag pieces by hand.');
    case 'image_rejected':
      return new Error('Claude could not read that image. Try a JPEG or PNG under 20MB.');
    case 'rate_limited':
      return new Error('That is a lot of requests at once. Give it a minute and try again.');
    case 'session_expired':
      return new Error('Your session expired — sign in again and retry.');
    case 'refused':
      return new Error('Claude declined to work on this one. Try a different photo.');
    case 'invalid_json':
      return new Error('Claude replied in an unexpected shape. Try again.');
    case 'empty_completion':
      return new Error('Claude came back empty. Try again with a clearer photo.');
    case 'prompt_too_large':
      return new Error('Your closet is too big to send in one go — that needs splitting up.');
    case 'cancelled':
      return Object.assign(new Error('Cancelled.'), { cancelled: true });
    default:
      return new Error(err?.message || 'That request did not go through. Try again.');
  }
}
