<!-- The hub sends this to a chat that's finishing. The chat answers in exactly this shape; it never calls itself ready. -->
Wrapping up. Do what's missing, then reply in exactly this shape:

**Wrap-up · <code>**
- **Commit:** <newest commit SHA> on `<branch>` (level 0: "no branch"); nothing uncommitted.
- **Done:** one line per item in the settings' `done` list: what you ran or checked, and the result. "Not checked" with the reason if you couldn't.
- **Follow-ups:** written to `<the settings' followups file, else docs/backlog.md>` (list them), or "none".
- **Open:** anything unfinished, or a question for the owner; "nothing" if none.

Commit only with the owner's OK. Level 1+: push your branch. Level 2: wait for CI and tell the hub the result. Then send the report to the hub. The hub checks your folder itself before anything is marked ready.
