<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo/lockup-dark.svg">
  <img src="assets/logo/lockup.svg" alt="defensity" width="300">
</picture>

An agent-based automation to detect vulnerabilities in any library or application.

[![CI](https://github.com/gabrielSantosLima/defensity/actions/workflows/ci.yml/badge.svg)](https://github.com/gabrielSantosLima/defensity/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/gabrielSantosLima/defensity?label=release)](https://github.com/gabrielSantosLima/defensity/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) | [Português (Brasil)](README.pt-BR.md) | [Español](README.es.md)

</div>

## Key features

- **Three target types**: web applications, Android APKs and libraries (lockfile
  or SBOM), with optional source code and documentation for deeper analysis.
- **Agent-driven analysis**: the agent runs the whole cycle in an isolated
  process, from reading artifacts to classifying validated findings.
- **Bring your own model**: Anthropic, OpenAI, Google Gemini, DeepInfra or any
  OpenAI-compatible endpoint. API keys live in the operating system keychain.
- **Scoped tooling**: the agent lists, reads and greps the imported source,
  fetches the web target and parses dependency manifests, always inside the
  allowed scope.
- **Validation in containers**: bounded HTTP probes and Gatling load scenarios
  run in Docker with CPU, memory and time limits.
- **Evidence-backed hypotheses**: every hypothesis cites a file, a request or a
  dependency version, and findings require a validator.
- **Issues per workspace**: confirmed findings are ranked by severity, listed
  per workspace and kept across runs.
- **Live run console**: follow steps, tool calls, tokens and elapsed time,
  cancel at any time and rerun with the previous context.
- **Markdown reports**: generate a report per run and save it locally.
- **Local-first**: SQLite storage, no telemetry, runs survive restarts and
  history can be cleared per workspace.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file
for details.
