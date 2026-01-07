An application that intentionally does almost nothing.

# Nothing

Nothing is a calm, deliberate desktop application that intentionally does almost nothing. It is not a joke or a productivity tool. The experience is meant to feel complete in its quietness, and the absence of features is protected by design.

## Behavior

- A single centered window with a full-bleed canvas.
- A soft, slow animation and no visible UI controls.
- No onboarding, accounts, metrics, or analytics.
- Press the M key to toggle the optional ambient audio.

## Build and run

Prerequisites:
- Rust (stable)
- Tauri CLI v2 (`cargo install tauri-cli --version "^2"`)
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Visual Studio Build Tools with C++ and WebView2

Run in dev mode:

```bash
cd src-tauri
cargo tauri dev
```

Create a release build:

```bash
cd src-tauri
cargo tauri build
```
