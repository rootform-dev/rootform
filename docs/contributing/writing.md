---
title: Writing for Rootform
description: The shared editorial standard for Rootform documentation, interface text, errors, release notes, and product prose.
---

Write for an engineer who knows infrastructure tooling and is learning
Rootform. **Assume technical competence. Never assume Rootform knowledge.**
Expect familiarity with Git, shells, package managers, CI, JSON,
Terraform/OpenTofu, and GitHub Releases. Explain Rootform terms before they
become prerequisites.

This standard applies to documentation, CLI prose, renderer labels, errors,
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
| “These guides use a newer documentation verification build than the release.” | Describe the renderer users receive with v0.1. Block release until the binary contains it. |
| “The interactive renderer has no CLI entry point yet.” | State supported Diff outputs and how to open any shipped interactive view. Track missing entry points internally. |
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
concepts with enough depth to support a correct decision: Dialects, `.rf`,
Architecture IR, policies and Policy Packs, Survey, Plan, Focus, Diff, locks,
vendor, offline operation, and provenance. Explain what Rootform can establish
and what it refuses to invent.

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

Apply this rule to Dialects, policies, Architecture IR, Diff, plans, locks, and
provenance. Do not paste a full definition into every workflow. Link to a stable
heading when another page owns the explanation.

Before adding a paragraph, search neighboring pages. If the same fact already has
a clear home, keep only the local consequence and link. Repeated boilerplate
across generated pages belongs in their shared overview.

## Make claims precise

Name the input, behavior, result, and boundary. A diagram describes declared
architecture; it does not prove live connectivity. An unresolved result is not
a pass. A lock fixes selection; it does not prevent downloads unless offline
operation is also requested.

Use **architecture** in ordinary prose and **Rootform architecture file** for a
saved document. Use **Architecture IR** for the public data contract. Keep
**Dialect**, **Policy Pack**, **Survey**, **Plan**, **Focus**, **Diff**, and
**Inspector** consistent. Use lowercase `policy` for a rule owned by a Policy
Pack. Reserve backticks for commands, paths, flags, identifiers, and literal
values.

Use **Rootform language** in headings and navigation and **the Rootform language**
in prose. Keep `language` lowercase and omit `(.rf)` from the section name.
Use `.rf` explicitly when discussing files and syntax, including `.rf files`,
`.rf syntax`, and `.rf.json`.

In new examples, put one top-level `policy_pack` manifest in a file at the pack
root and top-level `policy` declarations in `.rf` or `.rf.json` files beneath
that same root. The source root establishes ownership; policies need no explicit
pack reference. Nested `policy` blocks inside `policy_pack` remain accepted for
compatibility only. Teach the top-level form for new policies and multi-file packs.

Distinguish renderer **Plan** from a Terraform or OpenTofu plan. Describe
relations by their declared meaning. Do not turn network context into a
reachability claim or a source dependency into an architecture relation.

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
| In this guide, we will explore how to get started with Rootform. | Render a VPC and subnet from a small Terraform configuration. |
| Simply leverage the offline flag for seamless local execution. | Use `--offline` to prevent network access. Required Dialects must already be available locally. |
| Rootform ensures your infrastructure is secure. | `rootform check` evaluates policies selected for this project. |
| Current access: the executable emits text, JSON, and Markdown. | `rootform diff` emits text, JSON, or Markdown. |
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

**Installation methods are ordered by recommendation, not by implementation
importance. Show the simplest supported path first; package managers come next;
manual release downloads are fallback paths.**

- macOS: `curl -fsSL https://rootform.dev/install | sh`, then
  `brew install --cask rootform`, then the manual archive;
- Linux: `curl -fsSL https://rootform.dev/install | sh`, then the manual archive;
- Windows: `Invoke-RestMethod https://rootform.dev/install.ps1 | Invoke-Expression`, then
  `winget install --id Rootform.Rootform --exact`, then the manual ZIP;
- Container: a top-level platform choice that goes directly to the GHCR command,
  not an OS install sequence.

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
| Describing `moved` as a machine Diff entry state. | Explain that Delta strictly derives a move from removed and added context facts. |
| “The first run needs registry access.” | “The first run may need network access to download required Dialects that are not already available locally.” |

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

Shared instructions belong outside tabs. Link to a precise Playground scenario
when interaction helps; do not embed a second renderer inside a documentation
page. Keep light/dark figures paired with the same state, caption, and useful
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

Read every changed page from search arrival and within its navigation path.
Confirm that the purpose, prerequisite, expected result, and next action are
discoverable without an introduction. Read neighboring pages for repeated
definitions and contradictory limits. Check commands against the intended v0.1
contract, examples against the product, links and anchors against the built site,
and code blocks at narrow width.

Automated checks validate structure, navigation, examples, and explicit punctuation
rules. Editorial review evaluates usefulness, scope, rhythm, and the boundary
between product guidance and development process.

## Sources

This standard draws on the [Google developer style guide](https://developers.google.com/style),
[Google Technical Writing](https://developers.google.com/tech-writing/one),
[Microsoft's writing tips](https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice),
[GitLab's documentation style guide](https://docs.gitlab.com/development/documentation/styleguide/),
[Diataxis](https://diataxis.fr/), and the
[Command Line Interface Guidelines](https://clig.dev/).
