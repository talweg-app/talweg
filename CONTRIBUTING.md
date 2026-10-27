# Contributing to Talweg

Talweg is preparing its first Windows/Linux beta. Fixes that make saving, canvas interactions and shared editing reliable are especially useful.

## Report a bug

Use a [bug report](https://github.com/talweg-app/talweg/issues/new?template=bug_report.yml). English or Russian is welcome. Include the app version, operating system, desktop/browser mode, steps and the result you expected. For layout problems, mention interface scale and canvas zoom separately.

For collaboration issues, include host/guest roles, whether both users were on the same network, and which operations reached the other side. Never post a complete invitation, TURN credentials or a personal project without checking its contents.

If a bug affects saving, keep the original file and browser profile. Export a copy if possible before attempting recovery. A small anonymised reproduction board is more useful than a screenshot alone.

## Propose a change

Describe the task that is awkward today and show what a better result would look like. A workflow example helps more than a feature list. For a substantial change, open a [proposal](https://github.com/talweg-app/talweg/issues/new?template=feature_request.yml) before building it.

## Work on a fix

Follow the [development guide](docs/development.md) for setup and checks. Keep changes focused and use a separate project folder for experiments. `projects/` is user data, not a fixture directory.

Use TypeScript types already present in the relevant package and keep code close to its existing structure. For a behavioural fix, add a regression test that fails without the fix. Core, router and storage currently enforce full coverage; retain their existing coverage thresholds.

Run the relevant tests, typecheck and lint. Build or run a focused browser scenario when a UI change needs it. In the pull request, explain the trigger, resulting behaviour and what you actually checked. Call out any platform or network case you could not test.

Update the user guide when a visible workflow changes. Use real screenshots of public examples for documentation, and keep personal paths, project data and session secrets out of recordings.

## Commit messages

Use the existing `type(scope): short description` style, in plain English. For example: `fix(canvas): keep labels readable after changing a fill`. Explain the change directly; avoid generic messages such as “improve everything”.

Contributions are made under the repository’s [MIT license](LICENSE).
