# Deterministic Test Media Fixtures

This directory contains small, deterministic, synthetic image fixtures used strictly for automated tests.
These files are permanent source-controlled fixtures and must not be used for runtime user uploads.

- `sample.jpg`: Valid minimal JPEG image (120x120)
- `sample.png`: Valid minimal PNG image (120x120)
- `sample.webp`: Valid minimal WebP image (120x120)

Runtime user uploads belong exclusively in persistent storage (`public/uploads/` on web root or symlinked external storage) and are strictly excluded from source control.
