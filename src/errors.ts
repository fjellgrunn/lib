import { ComKey, Coordinate, Item, LocKeyArray, PriKey } from "@fjell/types";
import { abbrevIK, isComKey, isPriKey } from "@fjell/core";

export class LibError<
  S extends string,
  L1 extends string,
  L2 extends string,
  L3 extends string,
  L4 extends string,
  L5 extends string,
> extends Error {
  private operation: string;
  private coordinate: Coordinate<S, L1, L2, L3, L4, L5>;

  constructor(
    message: string,
    operation: string,
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    super(`${message} - ${coordinate} - ${operation}`, options);

    this.operation = operation;
    this.coordinate = coordinate;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LibError);
    }
  }
}

export class NotFoundError<
  S extends string,
  L1 extends string = never,
  L2 extends string = never,
  L3 extends string = never,
  L4 extends string = never,
  L5 extends string = never,
> extends LibError<S, L1, L2, L3, L4, L5> {
  private key: ComKey<S, L1, L2, L3, L4, L5> | PriKey<S>;

  constructor(
    operation: string,
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    const keyTypeArray = coordinate.kta;
    const isCompositeLibrary = keyTypeArray.length > 1;
    const keyType = isComKey(key) ? 'ComKey' : 'PriKey';
    
    // Build a helpful message that includes the key format
    const message = [
      `Item not found for key: ${abbrevIK(key)}`,
      ``,
      `Note: If you believe this item should exist, verify:`,
      `1. The key values are correct: ${abbrevIK(key)}`,
      `2. The item was created in the expected location`,
      isCompositeLibrary
        ? `3. This is a composite item library - keys should have both parent and location components`
        : `3. This is a primary item library - keys should only have a primary key`,
      ``,
      `Expected key type: ${keyType}`,
    ].join('\n');
    
    super(message, operation, coordinate, options);
    this.key = key;
  }
}

export class InvalidKeyTypeError<
  S extends string,
  L1 extends string = never,
  L2 extends string = never,
  L3 extends string = never,
  L4 extends string = never,
  L5 extends string = never,
> extends LibError<S, L1, L2, L3, L4, L5> {
  private key: any;
  private expectedFormat: string;
  private receivedFormat: string;

  constructor(
    operation: string,
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    key: any,
    expectedIsComposite: boolean,
    options?: {
      cause?: Error
    }
  ) {
    const keyTypeArray = coordinate.kta;
    
    let expectedFormat: string;
    let receivedFormat: string;
    
    if (expectedIsComposite) {
      // This is a composite library
      const locationTypes = keyTypeArray.slice(1).join(', ');
      expectedFormat = `ComKey with format: { kt: '${keyTypeArray[0]}', pk: string|number, loc: [${locationTypes.split(', ').map((kt: string) => `{ kt: '${kt}', lk: string|number }`).join(', ')}] }`;
    } else {
      // This is a primary library
      expectedFormat = `PriKey with format: { kt: '${keyTypeArray[0]}', pk: string|number }`;
    }
    
    // Determine what was received
    if (typeof key === 'string' || typeof key === 'number') {
      receivedFormat = `a ${typeof key} value: ${JSON.stringify(key)}`;
    } else if (key && typeof key === 'object') {
      if (isPriKey(key)) {
        receivedFormat = `PriKey: ${abbrevIK(key)}`;
      } else if (isComKey(key)) {
        receivedFormat = `ComKey: ${abbrevIK(key)}`;
      } else {
        receivedFormat = `an object: ${JSON.stringify(key)}`;
      }
    } else {
      receivedFormat = `${typeof key}: ${JSON.stringify(key)}`;
    }
    
    const message = [
      `Invalid key type for ${operation} operation.`,
      `Expected: ${expectedFormat}`,
      `Received: ${receivedFormat}`,
      ``,
      expectedIsComposite
        ? `This is a composite item library. You must provide both the parent key and location keys.`
        : `This is a primary item library. You should provide just the primary key.`,
      ``,
      `Example correct usage:`,
      expectedIsComposite
        ? `  library.operations.${operation}({ kt: '${keyTypeArray[0]}', pk: 'parent-id', loc: [{ kt: '${keyTypeArray[1]}', lk: 'child-id' }] })`
        : `  library.operations.${operation}({ kt: '${keyTypeArray[0]}', pk: 'item-id' })`
    ].join('\n');
    
    super(message, operation, coordinate, options);
    this.key = key;
    this.expectedFormat = expectedFormat;
    this.receivedFormat = receivedFormat;
  }
}

export class NotUpdatedError<
  S extends string,
  L1 extends string = never,
  L2 extends string = never,
  L3 extends string = never,
  L4 extends string = never,
  L5 extends string = never,
> extends LibError<S, L1, L2, L3, L4, L5> {
  private key: ComKey<S, L1, L2, L3, L4, L5> | PriKey<S>;

  constructor(
    operation: string,
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    // Use abbrevIK to properly format the key instead of JSON.stringify
    super(`Item not updated for key ${abbrevIK(key)}`, operation, coordinate, options);
    this.key = key;
  }
}

export class ValidationError<
  S extends string,
  L1 extends string,
  L2 extends string,
  L3 extends string,
  L4 extends string,
  L5 extends string,
> extends LibError<S, L1, L2, L3, L4, L5> {

  constructor(
    message: string,
    operation: string,
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    super(`Validation failed: ${message}`, operation, coordinate, options);
  }
}

export class CreateValidationError<
  S extends string,
  L1 extends string,
  L2 extends string,
  L3 extends string,
  L4 extends string,
  L5 extends string,
> extends ValidationError<S, L1, L2, L3, L4, L5> {

  constructor(
    parameters: {
      item: Partial<Item<S, L1, L2, L3, L4, L5>>,
      options?: {
        key?: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5> | undefined,
        locations?: LocKeyArray<L1, L2, L3, L4, L5> | [] | undefined,
      }
    },
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    const keyInfo = parameters.options?.key
      ? `key: ${abbrevIK(parameters.options.key)}`
      : parameters.options?.locations
        ? `locations: ${JSON.stringify(parameters.options.locations)}`
        : 'no key/locations';
    super(
      `Create Validation Failed: ${keyInfo}`,
      'create',
      coordinate,
      options
    );
  }
}

export class UpdateValidationError<
  S extends string,
  L1 extends string,
  L2 extends string,
  L3 extends string,
  L4 extends string,
  L5 extends string,
> extends ValidationError<S, L1, L2, L3, L4, L5> {

  constructor(
    parameters: {
      item: Partial<Item<S, L1, L2, L3, L4, L5>>,
      key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5> | undefined,
    },
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    const keyInfo = parameters.key ? `key: ${abbrevIK(parameters.key)}` : 'key: undefined';
    super(
      `Update Validation Failed: ${keyInfo}`,
      'update',
      coordinate,
      options
    );
  }
}

export class RemoveValidationError<
  S extends string,
  L1 extends string = never,
  L2 extends string = never,
  L3 extends string = never,
  L4 extends string = never,
  L5 extends string = never,
> extends ValidationError<S, L1, L2, L3, L4, L5> {

  constructor(
    parameters: {
      key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5> | undefined,
    },
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    const keyInfo = parameters.key ? `key: ${abbrevIK(parameters.key)}` : 'key: undefined';
    super(
      `Remove Validation Failed: ${keyInfo}`,
      'remove',
      coordinate,
      options
    );
  }
}

export class UpdateError<
  S extends string,
  L1 extends string = never,
  L2 extends string = never,
  L3 extends string = never,
  L4 extends string = never,
  L5 extends string = never,
> extends LibError<S, L1, L2, L3, L4, L5> {
  constructor(
    parameters: {
      item: Partial<Item<S, L1, L2, L3, L4, L5>>,
      key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5> | undefined,
    },
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    const keyInfo = parameters.key ? `key: ${abbrevIK(parameters.key)}` : 'key: undefined';
    super(
      `Update Failed: ${keyInfo}`,
      'update',
      coordinate,
      options
    );
  }
}

export class RemoveError<
  S extends string,
  L1 extends string = never,
  L2 extends string = never,
  L3 extends string = never,
  L4 extends string = never,
  L5 extends string = never,
> extends LibError<S, L1, L2, L3, L4, L5> {
  constructor(
    parameters: {
      key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5> | undefined,
    },
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    const keyInfo = parameters.key ? `key: ${abbrevIK(parameters.key)}` : 'key: undefined';
    super(
      `Remove Failed: ${keyInfo}`,
      'remove',
      coordinate,
      options
    );
  }
}

export class HookError<
  S extends string,
  L1 extends string,
  L2 extends string,
  L3 extends string,
  L4 extends string,
  L5 extends string,
> extends LibError<S, L1, L2, L3, L4, L5> {
  constructor(
    message: string,
    operation: string,
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    super(`${message}`, operation, coordinate, options);
  }
}

export class LocationKeyOrderError<
  S extends string,
  L1 extends string = never,
  L2 extends string = never,
  L3 extends string = never,
  L4 extends string = never,
  L5 extends string = never,
> extends LibError<S, L1, L2, L3, L4, L5> {
  private key: ComKey<S, L1, L2, L3, L4, L5>;

  constructor(
    operation: string,
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    key: ComKey<S, L1, L2, L3, L4, L5>,
    options?: {
      cause?: Error
    }
  ) {
    const keyTypeArray = coordinate.kta;
    const expectedLocationTypes = keyTypeArray.slice(1); // Remove primary key type
    const actualLocationTypes = key.loc.map(loc => loc.kt);
    
    // Build detailed error message
    const expectedOrder = expectedLocationTypes.map((kt: string, i: number) =>
      `  [${i}] { kt: '${kt}', lk: <value> }`
    ).join('\n');
    
    const actualOrder = key.loc.map((loc, i: number) =>
      `  [${i}] { kt: '${loc.kt}', lk: ${JSON.stringify(loc.lk)} }`
    ).join('\n');
    
    // Find the mismatches
    const mismatches: string[] = [];
    for (let i = 0; i < Math.max(expectedLocationTypes.length, actualLocationTypes.length); i++) {
      if (i >= expectedLocationTypes.length) {
        mismatches.push(`  • Position ${i}: Unexpected location key with type '${actualLocationTypes[i]}'`);
      } else if (i >= actualLocationTypes.length) {
        mismatches.push(`  • Position ${i}: Missing location key with type '${expectedLocationTypes[i]}'`);
      } else if (expectedLocationTypes[i] !== actualLocationTypes[i]) {
        mismatches.push(`  • Position ${i}: Expected '${expectedLocationTypes[i]}' but got '${actualLocationTypes[i]}'`);
      }
    }
    
    const message = [
      `Location key array order mismatch for ${operation} operation.`,
      ``,
      `The location keys in your ComKey must match the hierarchy defined by the library.`,
      ``,
      `Expected location key order for '${keyTypeArray[0]}':`,
      expectedOrder,
      ``,
      `Received location key order:`,
      actualOrder,
      ``,
      `Issues found:`,
      ...mismatches,
      ``,
      `Understanding the hierarchy:`,
      `  The key type array [${keyTypeArray.map((kt: string) => `'${kt}'`).join(', ')}] defines the containment hierarchy.`,
      `  - '${keyTypeArray[0]}' is the primary item type`,
      expectedLocationTypes.length > 0 ? `  - '${keyTypeArray[0]}' items are contained in '${expectedLocationTypes[0]}'` : '',
      expectedLocationTypes.length > 1 ? `  - '${expectedLocationTypes[0]}' items are contained in '${expectedLocationTypes[1]}'` : '',
      expectedLocationTypes.length > 2 ? `  - '${expectedLocationTypes[1]}' items are contained in '${expectedLocationTypes[2]}'` : '',
      ``,
      `Correct example:`,
      `  library.operations.${operation}({`,
      `    kt: '${keyTypeArray[0]}',`,
      `    pk: 'item-id',`,
      `    loc: [`,
      expectedLocationTypes.map((kt: string) => `      { kt: '${kt}', lk: 'parent-id' }`).join(',\n'),
      `    ]`,
      `  })`
    ].filter(line => line !== '').join('\n');
    
    super(message, operation, coordinate, options);
    this.key = key;
  }
}
