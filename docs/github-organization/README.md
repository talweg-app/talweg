# Organization profile kit

This directory contains ready-to-copy material for the **existing** `talweg-app/.github` repository. It is not active organization configuration in this application repository.

Copy these two directories into the root of `talweg-app/.github`:

```text
.github/                  separate repository owned by talweg-app
├── profile/
│   └── README.md          public organization overview
└── assets/
    ├── talweg.svg
    ├── canvas-dark.png
    ├── canvas-light.png
    └── collaboration.gif
```

This profile is already deployed to the organization. Merge future updates with any newer remote changes; do not replace unrelated files or reset that repository.

Publish the application documentation to `talweg-app/talweg` before using this profile: its guide links point to those files on `main`. The images are bundled here so the profile’s media does not depend on cross-repository raw-image URLs.

Putting this README in the application’s `.github/profile/` directory would not set the organization profile. GitHub reads `profile/README.md` from the separate public `.github` repository. [Official instructions](https://docs.github.com/en/organizations/collaborating-with-groups-in-organizations/customizing-your-organizations-profile).

For descriptions, avatar, repository pins and publication order, follow [the GitHub presentation guide](../github-presentation.md).
