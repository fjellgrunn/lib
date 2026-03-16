# Integration Guide

Guide for integrating `@fjell/lib` into larger Fjell-based systems.

## Where It Fits

Server-side Fjell library primitives for implementation operations and processing flows.

## Recommended Integration Pattern

- Use as the base abstraction when writing adapters for specific persistence engines
- Thread operation context through all service calls for traceability
- Compose with @fjell/core, backend libs, and @fjell/validation in service layers

## System Composition Checklist

- Define package boundaries: schema/types, transport, operations, adapters, and UI.
- Keep contracts stable by sharing @fjell/types interfaces where applicable.
- Centralize retries/timeouts/logging around infrastructure-facing operations.
- Validate inputs at API boundaries before invoking persistence or provider layers.
- Add contract and integration tests for every generated workflow.

## Cross-Library Pairings

- Pair with @fjell/types for shared contracts.
- Pair with @fjell/validation for input and schema checks.
- Pair with @fjell/logging for observability in integration flows.
- Pair with storage/router/provider packages based on your runtime architecture.

## Integration Example Shape

Use this package behind an application service layer that exposes stable domain methods. Generated code should call those service methods, not raw infrastructure primitives, unless your architecture intentionally keeps infrastructure at the edge.
