<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo/lockup-dark.svg">
  <img src="assets/logo/lockup.svg" alt="defensity" width="300">
</picture>

Una automatización basada en agentes para detectar vulnerabilidades en cualquier biblioteca o aplicación.

[![CI](https://github.com/gabrielSantosLima/defensity/actions/workflows/ci.yml/badge.svg)](https://github.com/gabrielSantosLima/defensity/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/gabrielSantosLima/defensity?label=release)](https://github.com/gabrielSantosLima/defensity/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) | [Português (Brasil)](README.pt-BR.md) | [Español](README.es.md)

</div>

## Funciones principales

- **Tres tipos de objetivo**: aplicaciones web, APKs de Android y bibliotecas
  (lockfile o SBOM), con código fuente y documentación opcionales para un
  análisis más profundo.
- **Análisis dirigido por agente**: el agente ejecuta todo el ciclo en un
  proceso aislado, desde la lectura de los artefactos hasta la clasificación de
  los hallazgos validados.
- **Usa tu propio modelo**: Anthropic, OpenAI, Google Gemini, DeepInfra o
  cualquier endpoint compatible con OpenAI. Las claves viven en el llavero del
  sistema operativo.
- **Herramientas con alcance**: el agente lista, lee y busca en el código
  importado, consulta el objetivo web e interpreta manifiestos de dependencias,
  siempre dentro del alcance permitido.
- **Validación en contenedores**: sondas HTTP acotadas y escenarios de carga
  Gatling se ejecutan en Docker con límites de CPU, memoria y tiempo.
- **Hipótesis con evidencia**: cada hipótesis cita un archivo, una petición o
  una versión de dependencia, y los hallazgos requieren un validador.
- **Issues por workspace**: los hallazgos confirmados se ordenan por severidad,
  se listan por workspace y se conservan entre ejecuciones.
- **Consola en vivo**: sigue pasos, llamadas de herramientas, tokens y tiempo,
  cancela en cualquier momento y vuelve a ejecutar con el contexto anterior.
- **Informes en Markdown**: genera un informe por ejecución y guárdalo localmente.
- **Local-first**: almacenamiento SQLite, sin telemetría, las ejecuciones
  sobreviven a reinicios y el historial se puede borrar por workspace.

## Licencia

Este proyecto está licenciado bajo la Licencia MIT. Consulte el archivo
[LICENSE](LICENSE) para obtener más detalles.
