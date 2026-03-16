# Usage Guide

Comprehensive usage guidance for `@fjell/lib`.

## Installation

```bash
npm install @fjell/lib
```

## API Highlights

- `Library`, `LibraryFactory`, `Operations`, and implementation wrappers
- `createOperationContext`, `contextManager`, and `OperationContext` type
- `Primary` and `Contained` namespaces for item-mode specific logic

## Quick Example

```ts
import { createOperationContext, contextManager } from "@fjell/lib";

const operationContext = createOperationContext({
  requestId: "req-1",
  actor: "system",
});

contextManager.run(operationContext, () => {
  // execute library-backed operations
});
```

## Model Consumption Rules

1. Import from the package root (`@fjell/lib`) instead of deep-internal paths unless explicitly documented.
2. Keep usage aligned with exported public symbols listed in this guide.
3. Prefer explicit typing at package boundaries so generated code remains robust during upgrades.
4. Keep error handling deterministic and map infrastructure failures into domain-level errors.
5. Co-locate integration wrappers in your app so model-generated code has one canonical entry point.

## Best Practices

- Keep examples and abstractions consistent with existing Fjell package conventions.
- Favor composable wrappers over one-off inline integration logic.
- Add targeted tests around generated integration code paths.
