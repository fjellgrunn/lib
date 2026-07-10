# @fjell/lib

Server-side data operations library for Fjell.

## Installation

```bash
npm install @fjell/lib @fjell/core @fjell/registry
```

## Current line (4.4.x)

This package is on the **4.4.x** line. Operations types are shared with `@fjell/core` where applicable; you can import `Operations` from `@fjell/lib` or related types from `@fjell/core` as needed. There is no v5 major release yet—ignore any older references to a v5 migration guide.

## Quick Start

```typescript
import { createLibrary } from '@fjell/lib';
import { createRegistry } from '@fjell/registry';

// Define your data model
interface User {
  kt: 'user';
  pk: string;
  name: string;
  email: string;
}

// Create operations implementation
const userOperations = {
  async create(item) { /* ... */ },
  async get(key) { /* ... */ },
  async update(key, item) { /* ... */ },
  async remove(key) { /* ... */ },
  async all(query) { /* ... */ },
  async one(query) { /* ... */ },
  async find(finder, params) { /* ... */ },
  async findOne(finder, params) { /* ... */ },
  async action(key, action, params) { /* ... */ },
  async allAction(action, params) { /* ... */ },
  async facet(key, facet, params) { /* ... */ },
  async allFacet(facet, params) { /* ... */ },
};

// Create registry and library
const registry = createRegistry();
const userLibrary = createLibrary(registry, coordinate, userOperations, options);

// Use the library
const newUser = await userLibrary.operations.create({
  name: 'Alice',
  email: 'alice@example.com'
});
```

## Features

- **Type-safe operations** - Full TypeScript support with strict typing
- **Hooks system** - Pre/post create, update, and remove hooks
- **Validators** - Validate data before operations
- **Custom finders** - Define custom query methods
- **Actions** - Define business logic operations
- **Facets** - Compute derived views of data
- **Location hierarchies** - Support for hierarchical data organization

## Documentation

For full documentation, examples, and guides, visit the [documentation site](https://getfjell.github.io/lib).

## Examples

See the [examples](./examples) directory for usage patterns.

## License

Apache-2.0

