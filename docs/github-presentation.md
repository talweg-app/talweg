# Presenting Talweg on GitHub

[Documentation](README.md)

The README, guides and organization profile are published. The first beta is available under the [v0.1.0-beta tag](https://github.com/talweg-app/talweg/releases/tag/v0.1.0-beta), with application version `0.1.0-beta.1`. The settings below are the reference for maintaining the presentation.

## Repository summary

Suggested description:

> A local workspace for diagrams, connected notes and plans. Windows and Linux, with live peer collaboration.

Suggested topics: `whiteboard`, `local-first`, `diagrams`, `mindmap`, `markdown`, `electron`, `webrtc`, `yjs`.

## Organization overview

The `talweg-app` organization and its public `.github` repository use the profile and media from [the organization kit](github-organization/README.md). Keep that kit and the separate profile repository in sync when changing the overview.

Use these values in the organization’s public profile settings:

| Field | Value |
| --- | --- |
| Display name | `Talweg` |
| Description | `A local workspace for diagrams, connected notes and plans.` |
| Website | `https://github.com/talweg-app/talweg` until there is a real project website |
| Avatar | [Gold monogram, 500 × 500](../assets/branding/org_avatar_golden_monogram_500.png) |

Copy `profile/` and `assets/` from the kit to the root of **`talweg-app/.github`**. Its README uses the same visual identity as the application and explains the product before linking to the beta. This belongs in the separate organization repository, not in this app’s `.github` directory. [GitHub organization-profile instructions](https://docs.github.com/en/organizations/collaborating-with-groups-in-organizations/customizing-your-organizations-profile).

Pin `talweg` first. There is no need to fill all six available pins with setup repositories; add a library or examples repository when it becomes useful on its own. Keep `.github` as supporting configuration rather than the primary product card.

Once the application docs are published, these commands apply the suggested metadata under your authenticated GitHub account:

```bash
gh auth login
gh api --method PATCH /orgs/talweg-app \
  -f name='Talweg' \
  -f description='A local workspace for diagrams, connected notes and plans.' \
  -f blog='https://github.com/talweg-app/talweg'

gh repo edit talweg-app/talweg \
  --description 'A local workspace for diagrams, connected notes and plans. Windows and Linux, with live peer collaboration.' \
  --homepage 'https://github.com/talweg-app/talweg#readme' \
  --add-topic whiteboard,local-first,diagrams,mindmap,markdown,electron,webrtc,yjs
```

The shell continuation above uses Bash syntax. Use the corresponding web settings or adapt line continuations in PowerShell. These commands were prepared locally, not run against GitHub.

## Keep the presentation consistent

Use the gold-on-dark application mark for the avatar, a real canvas screenshot near the top of the README, and one short demonstration below the feature explanation. Keep English as the main repository language and link the Russian version prominently. Avoid adding download-count or build badges before the corresponding package or workflow exists.

Set the repository About description and topics so the project is understandable even when someone only sees a repository card. The README explains use; the issue forms collect reproducible problems; the changelog explains the candidate’s actual state. Enable Discussions only when there is time to answer them, and keep a separate wiki hidden if all maintained guides live in `docs/`.

Package ownership and the npm account steps are tracked separately in [names and packages](names-and-packages.md). No npm ownership badge should be added until publication succeeds.

## Social preview

Use the existing [gold Talweg preview](../assets/branding/github_social_preview_gold.png). It is 1280 × 640 and below 1 MB. On the repository, open **Settings → General → Social preview → Edit → Upload an image**.

This setting controls the card shown when someone shares the repository URL. Adding an image to the README does not set it automatically. [GitHub’s social preview guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview) describes the supported sizes and formats.

## Screenshots and motion

The README uses theme-aware screenshots of the real app, a small looping GIF for shared editing, and an MP4 link. All examples use built-in template content. There are no active session links or personal project paths in the captures.

For an inline video player on a GitHub release, upload [collaboration.mp4](media/collaboration.mp4) in the release editor and keep the generated attachment link. The relative MP4 link in the README remains a file link; it is not presented as an embedded player.

## Prepare a beta release

1. Complete manual Windows and P2P checks for the next release, retaining the test results alongside automated checks. These checks were completed by the maintainer for the first beta.
2. Choose the release commit and build installers from that exact source.
3. Create the beta tag and mark the GitHub release as a pre-release.
4. Attach the Windows installer and Linux artifacts you actually built, plus a SHA-256 checksum file.
5. Use the changelog as the release summary. State that Windows is unsigned and describe remaining verified limitations.
6. Check that the download links work, then change the README’s candidate wording if that version has been published.

Keep installers in release assets rather than adding them to Git history. Project libraries, browser profiles, settings and credentials must stay out of release archives.
