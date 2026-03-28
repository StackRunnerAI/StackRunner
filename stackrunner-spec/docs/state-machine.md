# State Machine

## Execution States

- `created`
- `planned`
- `running`
- `blocked`
- `failed`
- `completed`
- `rolled_back`
- `cancelled`

Valid execution transitions:

- `created -> planned | cancelled`
- `planned -> running | blocked | cancelled`
- `running -> blocked | failed | completed | rolled_back | cancelled`
- `blocked -> planned | running | failed | cancelled`
- `failed -> rolled_back | cancelled`

`completed`, `rolled_back`, and `cancelled` are terminal in v0.1.

## Step States

- `pending`
- `ready`
- `running`
- `awaiting_approval`
- `verifying`
- `verified`
- `failed`
- `blocked`
- `rolled_back`
- `skipped`

Valid step transitions:

- `pending -> ready | skipped`
- `ready -> running | awaiting_approval | blocked | skipped`
- `running -> verifying | failed | blocked`
- `awaiting_approval -> ready | failed | blocked | skipped`
- `verifying -> verified | failed | blocked`
- `failed -> rolled_back | skipped`

`verified`, `rolled_back`, and `skipped` are terminal in v0.1.

Operational meaning:

- a step only becomes complete after it reaches `verified`
- `awaiting_approval` blocks execution without losing step context
- `blocked` means an external dependency or policy condition prevents progress
