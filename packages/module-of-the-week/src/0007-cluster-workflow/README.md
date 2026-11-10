# Cluster, Part 5: Workflow

Run from the repository root after installing dependencies:

```sh
vp install
node packages/module-of-the-week/src/0007-cluster-workflow/Program.ts
```

The example batches messages, starts a durable workflow, and acknowledges the messages once the workflow is saved. The workflow writes and posts a joke, waits an hour, then checks reactions and explains the joke if nobody laughed.

Like the previous examples, Chat and PunGenerator are local mocks. Posts are logged to the terminal, and the reaction count is always zero. No Slack credentials are needed. The program stays running for the durable wake-up; stop it with Ctrl+C.

State is saved in `.data/0007-cluster-workflow.sqlite`. Restarting uses the same database and resumes unfinished workflows. Each launch also sends a new set of demo messages. To shorten the demo, change the sleep duration in Workflow.ts; keep it above 60 seconds to exercise durable suspension.

The first-message key follows the post's batching tradeoff: new messages that join a redelivered batch can be acknowledged without entering the existing workflow. Posting to an external service also needs that service's idempotency support to prevent duplicates if a crash occurs after posting but before the activity result is saved.
