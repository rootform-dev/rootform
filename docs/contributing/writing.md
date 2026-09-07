---
title: Writing for Rootform
description: The shared writing standard for Rootform documentation, interface text, errors, and release notes.
---

Write for an engineer who knows Terraform or OpenTofu and is learning Rootform.
Explain what Rootform adds, what evidence supports it, and what to do next.
Use plain English with enough detail to make a decision or complete a task.

This is the shared editorial standard for documentation, CLI prose, renderer
labels, errors, release notes, and product pages. Wire identifiers and
surface-specific output contracts remain exact. Do not rewrite a real command
or diagnostic to make it fit a style preference.

## Start with the reader's need

A page has one primary job. State its outcome before background. A tutorial
guides a first success; a procedure solves a specific task; a concept explains
meaning; a reference makes exact facts easy to find. Link between these forms
when the reader needs a different kind of answer.

Assume infrastructure knowledge. Explain a Dialect before using it as a
prerequisite. Do not explain what a directory or a terminal is. Define
Rootform terms where their meaning differs from familiar Terraform terms.

## Make claims as precise as the evidence

Name the input, behavior, and boundary. A diagram describes declared
architecture; it does not prove live connectivity. An unresolved result is
not a pass. A lock fixes selection; it does not itself prevent downloads.

Use **architecture** in ordinary prose and **Rootform architecture file** for
the saved document. Use **Architecture IR** when explaining the public data
contract. Keep **Dialect**, **Policy Pack**, **Survey**, **Plan**, **Focus**,
and **Inspector** consistent. Use lowercase `policy` for a rule within a
Policy Pack. Reserve backticks for commands, paths, flags, identifiers, and
literal values.

Distinguish the renderer's **Plan view** from a **Terraform or OpenTofu plan**.
Describe relations using their actual meaning. Do not turn a network context
into a reachability claim or a source dependency into an architecture relation.

## Write directly

Use present tense for behavior and imperative verbs for instructions. Prefer
active voice when the actor matters. Let sentence length follow the idea.
A short qualification is useful when it changes the reader's decision.

Remove introductions that announce the page, explanations of the obvious,
and conclusions that repeat it. Avoid calling a task easy or simple. State
the prerequisites instead. Replace generic praise with an observable result.

| Before | After |
| --- | --- |
| In this guide, we will explore how to get started with Rootform. | Render a VPC and subnet from a small Terraform configuration. |
| Simply leverage the offline flag for seamless local execution. | Use `--offline` to prevent network access. Required Dialects must already be available locally. |
| Rootform ensures your infrastructure is secure. | `rootform check` evaluates the policies selected for this project. |
| Improved reliability and performance. | Fixed locked initialization failing when a configured credential helper returned no credentials. |
| Invalid input. | Name the rejected input and the form the command accepts. |

## Use structure to expose meaning

Headings name tasks or questions the section answers. Use sentence case and
stable, descriptive headings so links remain useful. Put prerequisites before
the first command. Keep a step's explanation with that step.

Use numbered lists when order matters, bullets for parallel facts, and tables
for real comparisons. Do not invent a third item to complete a pattern. Avoid
giving every section the same rhythm or forcing unrelated ideas into cards.
Long reference pages can be systematic; concept pages need room to explain.

Use periods and colons for ordinary sentence structure. An em dash can mark
an interruption, but repeated interruptions make technical prose harder to
scan. Do not use middle dots as editorial separators. Mathematical symbols,
literal output, and quoted identifiers keep their original punctuation.
These are readability choices, not tests of who wrote the text.

## Review AI-assisted drafts

AI-assisted drafts often repeat familiar structures instead of responding to
the page's actual question. Review the whole page, including its layout and
microcopy. A polished sentence can still hide an unsupported claim or say
nothing useful. These patterns are reasons to edit, not evidence of authorship.

| Pattern to catch | What it looks like | Correction |
| --- | --- | --- |
| Generic opening | “In today's evolving infrastructure landscape…” before any useful fact. | Open with the task, result, or concept the reader came for. |
| Inflated vocabulary | “Seamlessly leverage powerful capabilities” without saying what changes. | Name the command, input, and observable behavior. |
| Artificial symmetry | Every section has the same introduction, three bullets, and a conclusion. | Let each section's evidence determine its length and form. |
| Forced triplets | “Clear, powerful, seamless” or three benefits where only two are distinct. | Keep the meaningful items. Do not write to a count. |
| Mechanical punctuation | Middle-dot metadata rows, an em dash in every paragraph, or colons doing the same job in every heading. | Use punctuation for the sentence's meaning. Remove decorative separators. |
| Stock contrast | “This isn't just a diagram. It's a new way to understand infrastructure.” | Explain the specific evidence the architecture contains. |
| Empty transitions | “Importantly,” “it is worth noting,” “let's dive deeper,” repeated between facts. | Connect the facts directly or start a new paragraph. |
| Reassurance without proof | “Simply run…”, “effortlessly integrate…”, “production-ready” with no prerequisites or evidence. | State requirements and limits. Verify the claimed workflow. |
| Repeated explanation | A heading, lead, callout, and conclusion all restate the same point. | Give each fact one home; cross-link when another task needs it. |
| Fabricated precision | Invented terminal output, convenient resource counts, working-looking placeholder hashes, or an unverified install command. | Run the example or label the unavailable method explicitly. |
| Formulaic ending | “With these steps, you're now equipped to…” after the task already succeeded. | End at the result. Link to a concrete next task if one is useful. |

For example, replace:

> Rootform seamlessly bridges the gap between code and clarity, empowering
> teams to visualize, validate, and collaborate with confidence.

with:

> Rootform builds an architecture from Terraform or OpenTofu. Select a subnet
> to inspect which declaration and Dialect rule established its network context.

The second version names a real operation and a reason to use it. It does
not need a slogan to make the operation useful.

### Check the page, not just the prose

Do not turn every topic into a card, every link into a pill, or every section
into an identical numbered block. Use numbers for a sequence and tables for a
comparison. An eyebrow, badge, icon, or callout must add information the text
does not already provide. Avoid fake metrics and decorative “architecture”
diagrams that assert relationships the product has not established.

The Rootform Design System owns visual identity. A draft does not get a new
palette, type style, radius, gradient, glass surface, or animation because a
generator supplied one. Review rendered pages for unnecessary decoration and
repeated component patterns as well as inaccurate words.

Read neighboring sections aloud or in sequence. If their rhythm is identical,
their opening sentences are interchangeable, or their claims could describe
any developer tool, rewrite around the actual Rootform task. Do not add
quirks, errors, or random variation to make text appear human. Accuracy and
natural explanation are the standard.

## Make examples executable

Identify the shell when syntax depends on it. Keep commands separate from
terminal output. Do not include a shell prompt in a copyable command. Give
configuration blocks a filename. Name placeholders and explain how to replace
them; never put an invented token or digest into an apparently runnable command.

After a command, show an observed output or explain an observable result.
Label excerpts and variable output. Include the binary version and fixture in
verification evidence. Prefer a stable assertion over a snapshot of download
progress, timing, temporary ports, or host paths.

Use synthetic infrastructure. Never include real state, raw plans, customer
resources, credentials, or machine-specific paths in documentation evidence.
Verify that a command's exit status means what the surrounding prose claims.

## Write useful errors and labels

An error should explain what happened, the relevant constraint, and a next
action when one is known. Quote the user's input without exposing secrets.
Do not invent a recovery step or disguise an unavailable result as success.
Preserve the CLI's exact diagnostic and stream contracts in terminal output.

Interface labels name actions: **Copy command**, **Search**, **Focus**.
Use the same term in the control and its result. Essential instructions belong
in visible text. Colour, an icon, or a tooltip cannot carry the only explanation.

## Write changes for users

Release notes identify what changed and when a reader would encounter it.
Use the command, input, or workflow as context. Internal refactors need no
user-facing announcement unless they change a relevant behavior.

Product pages can explain why a capability matters, but every factual claim
still needs evidence. Avoid unmeasured superlatives, fake statistics, and
promises that exceed the shipped product. Installation previews must be
clearly distinguished from available methods.

## Review before merging

Read the page as someone arriving from search. Can they identify its purpose,
prerequisites, and next action without reading another introduction? Check
commands against help and examples against a real binary. Check links, headings,
and narrow-screen code blocks in the rendered page.

The repository's documentation check validates structure and navigation.
Editorial judgment stays with the reviewer: no word-frequency score or
punctuation blacklist can prove that a page is accurate or useful.

## Sources

This standard draws on the [Google developer style guide](https://developers.google.com/style),
[Google Technical Writing](https://developers.google.com/tech-writing/one),
[Microsoft's writing tips](https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice),
[GitLab's documentation style guide](https://docs.gitlab.com/development/documentation/styleguide/),
[Diátaxis](https://diataxis.fr/), and the
[Command Line Interface Guidelines](https://clig.dev/).
