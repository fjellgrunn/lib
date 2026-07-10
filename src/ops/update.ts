import {
  ComKey,
  Coordinate,
  Item,
  PriKey,
  UpdateMethod,
  UpdateOptions
} from "@fjell/types";
import {
  executeWithContext,
  OperationContext
} from "@fjell/core";

import { Options } from "../Options";
import { HookError, UpdateError, UpdateValidationError } from "../errors";
import LibLogger from '../logger';
import { Operations } from "../Operations";
import { Registry } from "../Registry";
import { validateSchema } from "@fjell/validation";

const logger = LibLogger.get('library', 'ops', 'update');

export const wrapUpdateOperation = <
  V extends Item<S, L1, L2, L3, L4, L5>,
  S extends string,
  L1 extends string = never,
  L2 extends string = never,
  L3 extends string = never,
  L4 extends string = never,
  L5 extends string = never
>(
    toWrap: Operations<V, S, L1, L2, L3, L4, L5>,
    options: Options<V, S, L1, L2, L3, L4, L5>,
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
    registry: Registry,
  ): UpdateMethod<V, S, L1, L2, L3, L4, L5> => {

  const update = async (
    key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5>,
    item: Partial<Item<S, L1, L2, L3, L4, L5>>,
    updateOptions?: UpdateOptions
  ): Promise<V> => {
    try {
      logger.debug('update', { key, item, updateOptions });

      // Fetch original item if onChange hook is present
      let originalItem: V | null | undefined;
      if (options?.hooks?.onChange) {
        try {
          originalItem = await toWrap.get(key);
        } catch (error: any) {
          // Log warning but don't fail the update if we can't fetch the original
          logger.warning('Failed to fetch original item for onChange hook', {
            component: 'lib',
            operation: 'update',
            phase: 'fetch-for-onChange',
            key: JSON.stringify(key),
            itemType: coordinate.kta[0],
            errorType: error?.constructor?.name || typeof error,
            errorMessage: error?.message,
            note: 'Update will continue without onChange hook',
            coordinate: JSON.stringify(coordinate)
          });
        }
      }

      let itemToUpdate = item;
      
      itemToUpdate = await runPreUpdateHook(key, itemToUpdate);

      await validateUpdate(key, itemToUpdate);

      const context: OperationContext = {
        itemType: coordinate.kta[0],
        operationType: 'update',
        operationName: 'update',
        params: { key, updates: itemToUpdate },
        key
      };

      let updatedItem: V;
      try {
        updatedItem = await executeWithContext(
          () => toWrap.update(key, itemToUpdate, updateOptions),
          context
        );
      } catch (updateError) {
        // Wrap underlying update errors in UpdateError
        throw new UpdateError({ key, item: itemToUpdate }, coordinate, { cause: updateError as Error });
      }

      try {
        updatedItem = await runPostUpdateHook(updatedItem);
      } catch (hookError) {
        // Wrap post-update hook errors in UpdateError
        throw new UpdateError({ key, item: itemToUpdate }, coordinate, { cause: hookError as Error });
      }

      // Call onChange hook if present and we successfully fetched the original item
      if (options?.hooks?.onChange && originalItem != null) {
        try {
          await options.hooks.onChange(originalItem, updatedItem);
        } catch (error: unknown) {
          throw new HookError(
            'Error in onChange',
            'update',
            coordinate,
            { cause: error as Error }
          );
        }
      }

      logger.debug("Update operation completed successfully", { updatedItem });
      return updatedItem;
    } catch (error) {
      // If it is a UpdateValidationError, throw it directly
      if (error instanceof UpdateValidationError) {
        throw error;
      }
      // Wrap all errors in a generic Error with the lib error as cause
      throw new Error((error as Error).message, { cause: error });
    }
  };

  return update;

  async function runPreUpdateHook(
    key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5>,
    itemToUpdate: Partial<Item<S, L1, L2, L3, L4, L5>>
  ): Promise<Partial<Item<S, L1, L2, L3, L4, L5>>> {
    if (options?.hooks?.preUpdate) {
      try {
        itemToUpdate = await options.hooks.preUpdate(key, itemToUpdate);
      } catch (error: unknown) {
        throw new HookError(
          'Error in preUpdate',
          'update',
          coordinate,
          { cause: error as Error }
        );
      }
    } else {
    }
    return itemToUpdate;
  }

  async function runPostUpdateHook(
    updatedItem: V
  ): Promise<V> {
    if (options?.hooks?.postUpdate) {
      try {
        updatedItem = await options.hooks.postUpdate(updatedItem);
      } catch (error: unknown) {
        throw new HookError(
          'Error in postUpdate',
          'update',
          coordinate,
          { cause: error as Error }
        );
      }
    } else {
    }
    return updatedItem;
  }

  async function validateUpdate(
    key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5>,
    itemToUpdate: Partial<Item<S, L1, L2, L3, L4, L5>>
  ) {
    // 1. Schema Validation
    if (options?.validation) {
      try {
        // Priority 1: Specific updateSchema
        if (options.validation.updateSchema) {
          await validateSchema(itemToUpdate, options.validation.updateSchema);
        }
        // Priority 2: Main schema (if it allows partials or if this is a full replace)
        // Note: We can't easily know if main schema allows partials here without trying,
        // but usually users should provide updateSchema if they want partial validation.
        // However, purely relying on updateSchema is safer.
        // If no updateSchema is provided, we skip schema validation for updates
        // UNLESS we decide to enforce strictness.
        // Decision: Only validate if updateSchema is present to avoid false positives on partial updates.
      } catch (error: any) {
        throw new UpdateValidationError(
          { key, item: itemToUpdate },
          coordinate,
          { cause: error as Error }
        );
      }
    }

    // 2. Manual Validators
    if (!options?.validators?.onUpdate) {
      return;
    }

    try {
      const isValid = await options.validators.onUpdate(key, itemToUpdate);
      if (!isValid) {
        throw new UpdateValidationError(
          { key, item: itemToUpdate },
          coordinate,
          { cause: new Error('Invalid item') }
        );
      }
    } catch (error: unknown) {
      if (error instanceof UpdateValidationError) throw error;
       
      throw new UpdateValidationError(
        { key, item: itemToUpdate },
        coordinate,
        { cause: error as Error }
      );
    }
  }

}
