# @fjell/lib - Agentic Guide

## Purpose

Server-side Fjell library primitives for implementation operations and processing flows.

This guide is optimized for AI-assisted code generation and integration workflows.

## Documentation

- **[Usage Guide](./usage.md)** - API-oriented usage patterns and model-safe examples
- **[Integration Guide](./integration.md)** - Architecture placement, composition rules, and implementation guidance

## Key Capabilities

- Defines core library operations and implementation wrappers
- Provides operation context creation and context manager utilities
- Exposes primary and contained module namespaces for backend composition

## Installation

```bash
npm install @fjell/lib
```

## Public API Highlights

- `Library`, `LibraryFactory`, `Operations`, and implementation wrappers
- `createOperationContext`, `contextManager`, and `OperationContext` type
- `Primary` and `Contained` namespaces for item-mode specific logic
