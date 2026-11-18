# Weave

Weave reconciles linked records from a common backup and two independently edited copies. It previews conflicts, records your choices and checks that the combined records still have valid links. It runs locally with Node.js 24 and uses built-in modules.

## Try the synthetic example

Run these commands from this directory. Choose an unused output name.

```sh
node --test
node cli.mjs examples/base.json examples/left.json examples/right.json
node cli.mjs examples/base.json examples/left.json examples/right.json examples/decisions.json output.json
```

The first merge command previews the sample and exits 1 with `note-1` unresolved. Choose `base`, `left` or `right` for each conflict. The bundled decision selects `left`. The second merge command writes a JSON wrapper with `backup` and `decisionLog`.

Both synthetic formats, `notes-v1` and `tasks-v1`, require the branch exports to name the same base revision and schema. The result uses the `merged-preview` placeholder revision. Preserve your original inputs and assign unique revision identities in any workflow built around these formats.

## Reconcile Compass v1 exports

The Compass adapter was verified by restoring a merged backup into a disposable local copy of [Compass 1.1.8](https://github.com/agammann/compass-webmcp/releases/tag/v1.1.8) and re-exporting its records. That round trip preserved the selected note, an independent task completion, a relation and the active Context Pack. Other Compass versions need their own round-trip check.

1. Keep copies of the original exports. Use `--attest-common-base` only when you know that both branch exports descend from the exact base. Compass v1 exports carry no ancestry information.
2. Preview the actual three files. Record your choices in a JSON object keyed by the exact current conflict names, such as `items/item-id` or `settings`. Use `{}` for a conflict-free merge.
3. Write the merged backup to a new path and retain the printed decision log. The output uses the base export timestamp as provenance metadata.
4. Inspect the output, then import it into a disposable local Compass workspace. Compass replaces the destination workspace and switches WebMCP off. Re-export and check the retained records and links before using the result elsewhere.

```sh
node compass-cli.mjs --attest-common-base base.json left.json right.json
node compass-cli.mjs --attest-common-base base.json left.json right.json decisions.json merged.json
```

The adapter accepts a conservative subset of Compass v1 exports. It checks record shapes, IDs, references, active pack consistency and the size limit. Exports with unknown fields or unsupported versions require separate review. Keep real workspace backups separate from the disposable test workspace.

## Decisions and output

Weave chooses whole records. When both copies changed the same record, selecting one version can discard changes made to the other. A combined set of individually valid records can still break a link or create a cycle. Review unresolved conflicts and invalid combinations, and repair the inputs where needed. A saved decision key must still match a conflict in the current preview. Both commands accept JSON with an optional UTF-8 byte-order mark.

Exit 0 means the merge completed. With only the three inputs it prints a preview. Supplying decisions and a new output path writes the backup. Exit 1 means unresolved conflicts or invalid combined records. Exit 2 means invalid arguments or inputs, an outdated decision, or a file error. Both CLIs create output exclusively and preserve existing files. The Compass output is a Compass backup file, with its decision log printed separately.
