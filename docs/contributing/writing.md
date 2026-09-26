---
title: Writing for Rootform
description: The shared editorial standard for Rootform documentation, interface text, errors, release notes, and product prose.
---

Write for an engineer who knows infrastructure tooling and is learning
Rootform. **Assume technical competence. Never assume Rootform knowledge.**
Expect familiarity with Git, shells, package managers, CI, JSON,
Terraform/OpenTofu, and GitHub Releases. Explain Rootform terms before they
become prerequisites.

This standard applies to documentation, CLI prose, output labels, errors,
release notes, and product pages. Exact commands, identifiers, diagnostics, and
machine contracts keep their defined spelling.

## Document the product, not the process

Public content describes the final Rootform v0.1 experience. It does not narrate
development status, unpublished distribution work, the build used to generate
an example, local fixtures, migration history, release machinery, or backlog.
Those facts help contributors deliver the product; they do not help someone use
it.

Treat documentation as a release contract. When documented behavior is not yet
implemented or published, record the mismatch in an internal release checklist
and block release until product and documentation agree. Do not weaken the page
with a temporary disclaimer. An intentional v0.1 product limit may remain
public when it changes what a user can do.

| Avoid | Write |
| --- | --- |
| “The installer describes the target v0.1 experience but is not published yet.” | Put the recommended install command first. Track installer publication internally. |
| “These guides use a newer documentation verification build than the release.” | Describe the behavior users receive with v0.1. Block release until the binary contains it. |
| “The selected Dialect is only available in our documentation fixture.” | Use an embedded Dialect or document the exact external selection a user can acquire. |
| A candidate-gate matrix on a user container page. | Document supported platforms, mounts, credentials, and runtime behavior. Keep release qualification in an internal runbook. |

## Give every page one job

Choose the content type before deciding the structure:

| Type | Job | Shape |
| --- | --- | --- |
| Tutorial | Teach through one successful path. | Ordered actions, expected results, and only the explanation needed for the next action. |
| How-to | Complete one known task. | Prerequisites, direct procedure, verification, and task-specific recovery. |
| Explanation | Build a Rootform mental model. | Connected reasoning, boundaries, examples, and links to action or exact reference. |
| Reference | Make exact facts easy to find. | Stable headings, complete tables, accepted forms, defaults, and edge behavior. |

Do not turn a tutorial into a concept catalog or a reference into a guided tour.
Link to the content type that answers the reader's next question.

Apply these limits before drafting:

| Page | Keep here | Defer |
| --- | --- | --- |
| Install | Platform choice, recommended command, verification, supported alternatives, and first-run consequence. | Installer internals, release pipeline, publication status, and general shell instruction. |
| Tutorial | One successful path, observable results, and explanation needed for next step. | Complete mental models, every alternative, and edge-case recovery. |
| Concept | One coherent model, its evidence boundary, and consequences for decisions. | Command catalogs, registry resolution algorithms, and repeated how-to procedures. |
| Reference | Complete accepted forms, fields, defaults, outputs, and edge behavior. | Motivation, narrative workflow, and duplicated concept teaching. |

## Keep the information that changes an outcome

For every detail, ask both questions:

> Does this change what the reader must do, understand, decide, expect,
> troubleshoot, secure, or reproduce?

> Why does the reader need this information here?

If not, remove it or move it to the internal source that needs it. Technical
truth alone is not a reason to publish a detail.

State prerequisites instead of teaching industry conventions. Explain product
concepts with enough depth to support a correct decision: instances and
Representations, Rules, Concepts, RF Vocabulary, Dialects, `.rf.hcl`, stages
and closures, Rootform documents, policies and Policy Packs, comparisons and
drift, locks, vendor, offline operation, and provenance. Explain what Rootform
can establish and what it refuses to invent.

Use progressive disclosure. Put the common decision first, then alternatives,
then advanced or manual procedures. A simple task should remain short. A concept
page can be long when its reasoning prevents a wrong conclusion.

## Give each concept one canonical home

A fact may appear on several pages, but its explanation has one owner. Match
depth to context:

- a tutorial uses one sentence and a link;
- a concept page owns the mental model and boundaries;
- an authoring guide explains how to create or change it;
- a reference page defines the exact syntax and behavior.

Apply this rule to Dialects, policies, Rootform documents, comparisons, plans,
locks, and provenance. Do not paste a full definition into every workflow. Link to a stable
heading when another page owns the explanation.

Before adding a paragraph, search neighboring pages. If the same fact already has
a clear home, keep only the local consequence and link. Repeated boilerplate
across generated pages belongs in their shared overview.

## Make claims precise

Use one term for each external-content state. The full explanation belongs in
[Install, add, and vendor](../concepts/external-content.md).

| Term | Meaning | Avoid as an alias |
| --- | --- | --- |
| embedded | ships inside the `rootform` binary | supplied, bundled, built-in, official as a state |
| installed | verified OCI content in `$ROOTFORM_HOME` on this machine | cached, downloaded, available as a state; local source |
| selected | recorded in `rootform.lock` | configured, enabled, pinned as a state, locked as a unit state |
| vendored | selected bytes copied into `.rootform/` and read only from there | cached, bundled |
| active | used by one command run | effective, loaded |
| override | supplied by `--dialect` or `--policy-pack` for one run | local selection, temporary selection |
| prepare | what `init` does: verify local, installed, or vendored content and possibly fetch missing OCI content | install for every `init` |

“Exact identity” names what the lock records. Reserve “pin” for digests
inside identities and “cache” for derived content under `$ROOTFORM_HOME/cache`.

Name the input, behavior, result, and boundary. A diagram describes the
architecture a plan or state records, not live connectivity. An indeterminate
result is not a pass. A
`rootform.lock` fixes selection, while `--offline` controls acquisition during
explicit `init` or `vendor`. Normal analysis does not acquire packages.

Use **architecture** in ordinary prose and **Rootform document** for a saved
`.json` analysis or comparison, as the CLI does. Use **Architecture IR** only
for the public data contract of that document. Name inputs as the reader
produces them: **plan JSON** for `terraform show -json plan.tfplan`, **saved
plan** for the file `terraform plan -out` writes, and **state JSON** for
`terraform show -json`. Use **instance** for a managed or data resource
instance and **Representation** for its entry in a Rootform document. Keep
**Rule**, **Concept**, **RF Vocabulary**, **Dialect**, **Policy Pack**,
**stage**, **closure**, **comparison**, and **drift** consistent; `--diff`
names the flag, not the result. Use **Policy** for a named authored assertion and
**Policy Pack** for its owner and selection. Use lowercase `policy` only for
generic prose. Reserve backticks for commands, paths, flags, identifiers, and
literal values.

The [RF Vocabulary](../concepts/dialects.md) supplies common architectural
terms. A [Dialect](../concepts/dialects.md) interprets provider resources
using those terms. Do not describe the RF Vocabulary as a provider Dialect.

Use **Rootform language** in headings and navigation and **the Rootform language**
in prose. Keep `language` lowercase and omit `(.rf.hcl)` from the section name.
Use `.rf.hcl` explicitly when discussing files and syntax, including `.rf.hcl files`,
`.rf.hcl syntax`, and `.rf.json`.

Use **Dialect** for the named, versioned unit, its source, selection, store, and
distribution. Use **semantics** only for architectural meaning, evaluation
behavior, semantic versions and digests, or exact public identifiers such as
the Architecture IR `semantics` field and `rootform explain semantics`. Never
use “semantic package,” “selected semantics,” or similar aliases for Dialects.

In examples, put one top-level `policy_pack` manifest in a file at the pack
root and top-level `policy` declarations in `.rf.hcl` or `.rf.json` files beneath
that same root. The source root establishes ownership; policies need no explicit
pack reference. Nested `policy` blocks are invalid.

Distinguish the changes a plan proposes from a comparison between two inputs,
and both from drift, which a plan reports for changes made outside Terraform
or OpenTofu.
Describe relations by their declared meaning. Do not turn network context into
a reachability claim or a Terraform dependency into an architecture relation.
Plan evidence supports a Rule's architectural claim but is not itself the
Context or Relation produced by that Rule.

Keep a Representation in Architecture IR distinct from its presentation. A
secondary resource can be present in the document without a permanent card in
every Explorer scene. Link to [Explorer navigation](../guides/explore-architecture.md#reveal-a-secondary-resource)
instead of calling it missing. In a comparison, `undetermined` is neither no change
nor proof that the comparison failed. Link to
[Architecture comparisons](../concepts/diff.md#undetermined-preserves-uncertainty).

## Write directly, with natural rhythm

Use present tense for behavior and imperative verbs for instructions. Prefer
active voice when the actor matters. Start with the task, result, or question,
not an announcement about the page.

Combine ideas that belong together. Vary sentence length according to meaning;
do not replace clipped fragments with overloaded sentences. Remove a sentence
that only repeats its heading, and end when the task or explanation is complete.
A concrete next action is useful; a summary of the page is not.

Avoid forced symmetry, stock contrasts, and lists padded to three items. Do not
repeat sentence openings such as “Rootform does,” “You can,” or “The command”
when a natural subject is available. Use punctuation for syntax, not decoration.
The em dash character (U+2014) is forbidden in public documentation. Use a period,
comma, colon, or parentheses instead. `bun run check:docs` rejects this character
in authored Markdown, including headings and metadata. Avoid decorative middle
dots in technical prose.

| Before | After |
| --- | --- |
| In this guide, we will explore how to get started with Rootform. | Plan a VPC and subnet from a small Terraform configuration. |
| Simply leverage the offline flag for seamless local execution. | Use `init --offline` or `vendor … --offline` to prevent acquisition. Selected third-party content must already be available locally. |
| Rootform ensures your infrastructure is secure. | `rootform run plan.json --policy-pack ./policies` evaluates selected policies. |
| Current access: the executable emits text, JSON, Markdown, and HTML. | `rootform run before.json --diff after.json` emits a comparison document. |
| With these steps, you are ready to continue. | Link to next concrete task, or stop. |

## Use structure only when it reveals meaning

Headings name tasks or questions. Use sentence case and stable wording so links
remain useful. Put prerequisites before the first command and keep a step's expected
result beside that step.

Use numbered steps when order matters, bullets for parallel facts, and tables
for repeated fields or real comparisons. Do not turn every topic into a card,
every section into the same three-part pattern, or conceptual prose into a
sequence merely to make it look actionable.

Callouts interrupt reading, so reserve them for information whose placement or
severity changes behavior:

- **Warning** or **Caution**: risk of data, security, cost, or irreversible harm;
- **Important**: prerequisite or constraint that can invalidate the task;
- **Note**: exceptional context needed at that exact point;
- **Tip**: optional improvement with a concrete benefit.

Ordinary explanation, product limits, and cross-links stay in prose. A callout
must not rescue a weak information hierarchy or hold unrelated caveats.

## Order installation by recommendation

Order methods by recommendation, not implementation importance. Show the
recommended installer first, a platform package manager where offered, and a
manual release archive as fallback. In the container panel, lead with the
versioned image rather than an OS install sequence. Keep the exact commands
and current alternatives in [Install Rootform](../installation.md), their
canonical user page.

Use one `[ macOS | Linux | Windows | Container ]` choice for primary content.
Inside a platform panel, label **Recommended** and **Verify**; add **Other
options** only when that platform has an alternative. Do not repeat the selected
platform as a heading. Put one **Manual installation** section after all panels,
visually secondary to recommended methods. Make `rootform version` visible
without opening manual downloads. Keep OS and CPU detection, temporary files,
archive layout, checksum production, and GitHub Release mechanics out of the
primary path. Manual verification may explain checksums when performed.

GitHub Releases can supply binary bytes without becoming the recommended
installation experience. **Do not expose the release pipeline merely because
releases are the underlying source of the binary.**

## Editorial choices

Use these examples to choose scope and wording:

| Avoid | Write |
| --- | --- |
| “Rootform is one executable. It needs no Node.js, Python…” at the start of Install. | Name supported platforms and the only first-run network consequence. |
| `macOS` as a heading directly below an active `macOS` tab. | Let the selected tab identify the platform; begin with **Recommended**. |
| A Dialects concept page teaching source-priority and registry resolution algorithms. | Explain how Dialects change architecture meaning; link acquisition details to offline operation. |
| A check walkthrough ending with an unrelated pack that evaluates zero targets. | Follow one policy through pass, violation, indeterminate evidence, then the same gate in CI. |
| Reporting a renamed instance as removed and added. | Explain that the plan records the previous address, so Rootform reports the instance as `moved`. |
| “The first run needs registry access.” | “A missing selected OCI Dialect or Policy Pack may need registry access during `init`. Local selections use their recorded paths.” |

## Make examples executable

Identify the shell when syntax depends on it. Do not include a prompt in a
copyable command. Give file examples a filename. Separate commands from output.
Name placeholders and never put an invented token or digest into an apparently
runnable command.

After a command, show stable expected output or describe an observable result.
Label excerpts and variable fields. Public prose does not name an internal
fixture, temporary host path, or verification binary. Internal evidence records
those identities and proves examples before merge.

Use synthetic infrastructure. Never publish customer resources, credentials,
state, raw plans, private paths, or private implementation material. Verify that
the exit status supports the surrounding claim.

## Choose documentary primitives deliberately

Use a filename on file examples and `title="Command"` when a command's purpose
would otherwise be unclear. Untitled output stays compact when surrounding prose
already identifies it; add a precise result label only when ambiguity remains.
Line numbers and highlights must point to something the reader needs.

Use a GitHub alert such as `> [!WARNING]` only under callout rules above. Public
Markdown supports framework-neutral markers:

- `<!-- rootform:directory -->` presents orientation links;
- `<!-- rootform:tabs Label -->` groups two or more complete alternatives.

Shared instructions belong outside tabs. Link to a precise executable example
when it helps; do not duplicate an entire workflow inside a neighboring page.
Keep light/dark figures paired with the same state, caption, and useful
alternative text.

## Apply the standard to each product surface

Documentation explains tasks, models, and exact contracts at their proper
depth. CLI help prioritizes command purpose, accepted input, output, and exit
behavior. Interface labels name actions and use the same term as the resulting state.

Errors explain what happened, the relevant constraint, and a known next action.
Quote user input only when safe. Do not invent recovery or hide an unavailable
decision as success.

Marketing may explain why a capability matters, but factual claims keep the same
evidence boundary. Avoid unmeasured superlatives, fake metrics, and promises
beyond the v0.1 contract. Release notes describe a user-visible change and when a
reader encounters it; internal refactors stay out unless they change behavior.

## Review AI-assisted drafts

AI-assisted prose often repeats familiar shapes instead of answering a page's
question. Treat patterns below as review prompts, never as proof of authorship:

| Pattern | Test | Correction |
| --- | --- | --- |
| Generic opening | Could the opening introduce any developer tool? | Name the Rootform task or result. |
| Inflated vocabulary | Does an adjective replace observable behavior? | Name the command, input, and outcome. |
| Artificial symmetry | Do neighboring sections share the same length and structure without reason? | Let the content determine its form. |
| Forced triplet | Was the third item added only for cadence? | Keep distinct items. |
| Stock contrast | Does “not just X, but Y” avoid precise claim? | State actual boundary or benefit. |
| Mechanical rhythm | Do consecutive sentences repeat subject and length? | Combine related ideas and vary structure. |
| Decorative caveat | Is Note/Important carrying ordinary explanation or project status? | Integrate useful fact or move status internally. |
| Repeated definition | Does another page already own it? | Keep local consequence and link. |
| Formulaic ending | Does the conclusion only restate the completed page? | End at the result or give a concrete next action. |
| Internal leakage | Would the detail matter only to a contributor or release operator? | Move it to an internal contract or checklist. |

Review layout and microcopy with prose. Aim for accuracy and natural explanation.
Random variation and detector scoring do not establish editorial quality.

## Review before merging

Read the page from a search arrival and from its navigation path. Before
merging, confirm:

- The page has one clear job and gives the reader a useful next action.
- Rootform terms are explained before they become prerequisites.
- Commands and behavioral claims match the intended contract.
- Each copyable example has an observable result or a stated expected effect.
- No credentials, customer data, real plans, or private paths appear.
- A canonical page owns each definition rather than duplicating it here.
- Links and anchors work in the built site, including after heading changes.
- Code blocks and tables remain readable at narrow width.
- Prose reads naturally as text, not merely as valid Markdown structure.

Automated checks cover structure and links. Editorial review still decides
whether the page is useful, accurate, and human to read.

## Sources

This standard draws on the [Google developer style guide](https://developers.google.com/style),
[Google Technical Writing](https://developers.google.com/tech-writing/one),
[Microsoft's writing tips](https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice),
[GitLab's documentation style guide](https://docs.gitlab.com/development/documentation/styleguide/),
[Diataxis](https://diataxis.fr/), and the
[Command Line Interface Guidelines](https://clig.dev/).
