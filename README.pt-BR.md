<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo/lockup-dark.svg">
  <img src="assets/logo/lockup.svg" alt="defensity" width="300">
</picture>

Uma automação baseada em agentes para detectar vulnerabilidades em qualquer biblioteca ou aplicação.

[![CI](https://github.com/gabrielSantosLima/defensity/actions/workflows/ci.yml/badge.svg)](https://github.com/gabrielSantosLima/defensity/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/gabrielSantosLima/defensity?label=release)](https://github.com/gabrielSantosLima/defensity/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) | [Português (Brasil)](README.pt-BR.md) | [Español](README.es.md)

</div>

## Principais recursos

- **Três tipos de alvo**: aplicações web, APKs Android e bibliotecas (lockfile
  ou SBOM), com código-fonte e documentação opcionais para análise mais
  profunda.
- **Análise conduzida por agente**: o agente executa todo o ciclo em um processo
  isolado, da leitura dos artefatos à classificação dos findings validados.
- **Traga seu modelo**: Anthropic, OpenAI, Google Gemini, DeepInfra ou qualquer
  endpoint compatível com OpenAI. As chaves ficam no keychain do sistema.
- **Ferramentas com escopo**: o agente lista, lê e busca no código importado,
  consulta o alvo web e interpreta manifestos de dependência, sempre dentro do
  escopo permitido.
- **Validação em containers**: probes HTTP limitados e cenários de carga Gatling
  rodam no Docker com limites de CPU, memória e tempo.
- **Hipóteses com evidência**: cada hipótese cita arquivo, requisição ou versão
  de dependência, e findings exigem um validador.
- **Issues por workspace**: findings confirmados são ordenados por severidade,
  listados por workspace e mantidos entre execuções.
- **Console ao vivo**: acompanhe passos, chamadas de ferramenta, tokens e tempo,
  cancele a qualquer momento e reexecute com o contexto anterior.
- **Relatórios em Markdown**: gere um relatório por execução e salve localmente.
- **Local-first**: armazenamento SQLite, sem telemetria, runs sobrevivem a
  reinícios e o histórico pode ser apagado por workspace.

## Licença

Este projeto está licenciado sob a Licença MIT. Consulte o arquivo
[LICENSE](LICENSE) para mais detalhes.
