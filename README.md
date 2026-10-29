# Weave: backup reconciliation research prototype

Weave explores explicit, inspectable three-way reconciliation of linked records. It is an alpha research prototype, not a safe production backup tool or evidence of market fit. It runs locally with Node.js 24 and no dependencies.

The `notes-v1` and `tasks-v1` formats are synthetic. A separate experimental Compass v1 adapter models the export/import shape in [Compass repository.ts at acf582f](https://github.com/agammann/compass-webmcp/blob/acf582fe7559749fd28a93a15c1007690ae8d5b7/lib/repository.ts). **Actual app re-import has not been tested**, so compatibility remains unverified. Other app versions are not assessed. There is no Cove adapter, JSON Schema validator, GUI, or browser worker. Do not use this on irreplaceable data. Ancestry is a caller-supplied assertion, not cryptographic proof. Records are resolved as whole objects; decisions may intentionally discard changes. Synthetic result revision is a placeholder, not a unique identity.

## Experimental Compass v1

`node compass-cli.mjs --attest-common-base BASE LEFT RIGHT [DECISIONS OUTPUT]` previews or creates a Compass-shaped JSON file. Use the flag only when you know both exports descend from the specified base: Compass v1 does not record ancestry. Decisions map keys such as `items/item-id` or `settings` to `base`, `left`, or `right`. The preview prints the decision log; keep it separately. It validates record shapes, IDs, references, active pack consistency and size, refuses unsupported versions and unknown fields, and does not overwrite files. Conflicting arrays inside a record are resolved with the whole record. This conservative validator may reject exports that Compass would normalize. Compass import **replaces** the destination workspace and forces WebMCP off; use only a disposable instance for experiments. Test actual import and export before considering real use.

## Try the synthetic example

```sh
node --test
node cli.mjs examples/base.json examples/left.json examples/right.json
node cli.mjs examples/base.json examples/left.json examples/right.json examples/decisions.json output.json
```

The preview command exits 1 when unresolved. For each conflict, the decisions JSON maps the record ID to `base`, `left`, or `right`. The output wrapper includes a backup and decision log. Output is created exclusively and cannot overwrite existing files. Inputs must be independently valid and identify the same base revision and schema. The result is withheld when references or cycles are invalid. Deleting a parent can require additional decisions or manual repair.

## Research context

[jsonmerge](https://github.com/avian2/jsonmerge) provides schema-directed merging; [jsondiffpatch](https://github.com/benjamine/jsondiffpatch) offers structured diffs and patches; [DeltaJSON](https://docs.deltaxignia.com/deltajson/latest/user-guide) already supports three-way concurrent merges. The hypothesis here is that verified adapters and understandable domain decisions may help people reconcile a specific app's linked exports; generic merge itself is not novel. This prototype uses no third-party code. Future work must obtain documented schemas, create app-specific adapters and test actual application re-import before claiming compatibility. Older exports with no ancestry must be refused or reconciled manually.
