# EventLog

Run from the repository root after installing dependencies. Start the sync server first:

```sh
vp install
node packages/module-of-the-week/src/0009-event-log/server.ts
```

It listens for devices at `ws://localhost:3000/sync`. In another terminal, run any of the three examples:

```sh
# The laptop and phone log different ideas, and both end up with the same vault
node packages/module-of-the-week/src/0009-event-log/sync.ts

# Both devices log `readme-typo` while offline. The `conflicts` check keeps the newer pitch
node packages/module-of-the-week/src/0009-event-log/conflicts.ts

# Both devices patch different fields of the same row while offline. EventRow keeps both
node packages/module-of-the-week/src/0009-event-log/merge.ts
```

Each example runs the laptop and phone in one process, with a separate `Vault` and `EventJournal` for each. They go offline by disconnecting from the server and come back online by reconnecting.

`events.ts`, `handlers.ts` and `row.ts` are the files from the post. `device.ts` holds the device wiring from `sync.ts` in the post (`IdentityLayer`, `DeviceLayer`, `SyncedDeviceLayer`), plus a few helpers for the examples.

## Encrypted and unencrypted sync

`server.ts` runs `EventLogServerEncrypted`. It logs each batch it receives, and all it can see is encrypted bytes.

To sync in plaintext, run `server-unencrypted.ts` instead, and set `UNENCRYPTED=true` for the examples:

```sh
node packages/module-of-the-week/src/0009-event-log/server-unencrypted.ts
UNENCRYPTED=true node packages/module-of-the-week/src/0009-event-log/sync.ts
```

This switches the devices from `EventLogRemote.layerEncrypted` to `EventLogRemote.layerUnencrypted`. The plaintext server decodes every entry and runs its own handlers, which log each event. Its authorization lets every identity in, so add your own checks before deploying it.

## Notes

- Both servers keep entries in memory. Each example run syncs to a store of its own, so reruns start from an empty vault.
- The devices and server use `RpcSerialization.layerSchemaBinary()`. The sync protocol sends binary data (auth challenges and encrypted batches), which `RpcSerialization.layerJson` can't encode.
- `device.ts` has a demo identity baked in so the examples work out of the box. Run `identity.ts` to print a new one, and keep real identities out of source control.
