
import {
  ComKey,
  Coordinate,
  Item,
  PriKey,
  RemoveMethod
} from "@fjell/types";
import {
  executeWithContext,
  OperationContext
} from "@fjell/core";

import { Options } from "../Options";
import { HookError, RemoveError, RemoveValidationError } from "../errors";
import LibLogger from "../logger";
import { Operations } from "../Operations";
import { Registry } from "../Registry";

const logger = LibLogger.get('library', 'ops', 'remove');

export const wrapRemoveOperation = <
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
  ): RemoveMethod<V, S, L1, L2, L3, L4, L5> => {

  const remove = async (
    key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5>
  ): Promise<V | void> => {
    try {
      logger.debug('remove', { key });

      await runPreRemoveHook(key);

      await validateRemove(key);

      const context: OperationContext = {
        itemType: coordinate.kta[0],
        operationType: 'remove',
        operationName: 'remove',
        params: { key },
        key
      };

      const item = await executeWithContext(
        () => toWrap.remove(key),
        context
      );

      if (!item) {
        logger.error('Remove operation failed - no item returned', { key });
        throw new RemoveError({ key }, coordinate);
      }

      await runPostRemoveHook(item);

      logger.debug("Remove operation completed successfully", { item });
      return item;
    } catch (error) {
      // Wrap all errors in a generic Error with the lib error as cause
      throw new Error((error as Error).message, { cause: error });
    }
  };

  return remove;

  async function runPreRemoveHook(key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5>) {
    if (options?.hooks?.preRemove) {
      try {
        await options.hooks.preRemove(key);
      } catch (error: unknown) {
        throw new HookError('preRemove', 'remove', coordinate, { cause: error as Error });
      }
    } else {
    }
  }

  async function runPostRemoveHook(item: V) {
    if (options?.hooks?.postRemove) {
      try {
        await options.hooks.postRemove(item);
      } catch (error: unknown) {
        throw new HookError('postRemove', 'remove', coordinate, { cause: error as Error });
      }
    } else {
    }
  }

  async function validateRemove(key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5>) {
    if (!options?.validators?.onRemove) {
      return;
    }

    try {
      const isValid = await options.validators.onRemove(key);
      if (!isValid) {
        throw new RemoveValidationError(
          { key },
          coordinate,
          { cause: new Error('Error validating remove') }
        );
      }
    } catch (error: unknown) {
      if (error instanceof RemoveValidationError) throw error;
      throw new RemoveValidationError(
        { key },
        coordinate,
        { cause: error as Error }
      );
    }
  }

}
