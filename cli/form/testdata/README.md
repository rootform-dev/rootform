# Form fixtures

`state.json` is a state Form with one Recorded architecture labeled "Recorded".
`plan.json` is a plan Form with Planned, Refreshed and reconstructed Recorded
architectures, plus the `changes`, `drift` and `net` comparisons their stages
allow. `comparison.json` is a comparison Form: `cross` compares selected
architectures from its embedded input Forms. Unsettled closures use
`indeterminate`. A missing stage is unavailable, not empty.

The matching `*.display.json` files are display copies. They may omit
record-tier external identities and are not valid saved inputs.

Regenerate all six files with:

```bash
UPDATE_GOLDEN=1 go test ./form -run TestDocumentGoldens
```
