// MODEL LAYER — plain functions, no React.
//
// Kept apart from the screen on purpose: this file could be called from a
// test, a script, or a different design entirely. `authFetch` attaches the
// signed-in user's token and returns the PARSED body, throwing on failure.
import { authFetch } from '@xeplr/ui-account'

export async function listTasks() {
  const res = await authFetch('/api/tasks')
  return res.dataArray || []
}

/**
 * Create and update in one call.
 *
 * The API takes a CHANGESET — an array where each entry is judged by what it
 * carries: no id means create, an id means update, an id plus `deleted: true`
 * means remove. One request can do all three, and the whole array is applied
 * in a single transaction, so a later failure undoes the earlier entries
 * rather than leaving half of them written.
 */
export function saveTasks(changeset) {
  return authFetch('/api/tasks/save', {
    method: 'POST',
    body: JSON.stringify(changeset)
  })
}

export function deleteTasks(ids) {
  return authFetch('/api/tasks/delete', {
    method: 'POST',
    body: JSON.stringify({ ids })
  })
}
