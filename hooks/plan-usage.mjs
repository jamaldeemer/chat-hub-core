// After a chat calls the app's get_usage tool: save the plan numbers (5-hour and weekly) for the
// owner's pace line (pace.mjs). Says nothing to the chat.
import { hookInput } from './config.mjs'
import { planFrom, savePlan } from './pace.mjs'

const input = hookInput()
if (/get_usage$/.test(input.tool_name || '')) {
  const plan = planFrom(input.tool_response)
  if (plan) savePlan(plan)
}
