# Public Host contract

The source contract is [zurge-co/ponpoko-surface-sdk](https://github.com/zurge-co/ponpoko-surface-sdk), pinned at `cca8c6cb3e975186df75d8ea2124a4c0f40e615f`.
External agents start with its [SKILL.md](https://github.com/zurge-co/ponpoko-surface-sdk/blob/cca8c6cb3e975186df75d8ea2124a4c0f40e615f/SKILL.md).
No private Host checkout is needed to build or check this surface.

`ai-contract.json` and `host-ai.*` are generated assets from that revision. The surface owns
`ai-requests.json`; it contains safe representative inputs, with no credentials.
Clone the public SDK at that revision, then run:

```sh
node <sdk-checkout>/scripts/copy-ai-assets.mjs <surface-checkout>
node <sdk-checkout>/scripts/check-surface.mjs <surface-checkout>/dist
```

`bun test` checks the vendored schema, its hash, and the surface request fixtures locally.
The SDK checker verifies the built manifest and files as well. Both checks are offline
compatibility evidence; inference and visual acceptance need a running Host and remain unmeasured.
There is no automatic CI workflow in this repository.
