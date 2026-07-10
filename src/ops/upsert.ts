
import {
  ComKey,
  Coordinate,
  Item,
  LocKeyArray,
  PriKey,
  UpdateOptions,
  UpsertMethod
} from "@fjell/types";
import {
  abbrevIK,
  executeWithContext,
  OperationContext
} from "@fjell/core";

import LibLogger from "../logger";
import { NotFoundError } from "../errors";
import { Operations } from "../Operations";
import { Registry } from "../Registry";

const logger = LibLogger.get('ops', 'upsert');

// TODO: Explore how you are using the this keyword.
export const wrapUpsertOperation = <
  V extends Item<S, L1, L2, L3, L4, L5>,
  S extends string,
  L1 extends string = never,
  L2 extends string = never,
  L3 extends string = never,
  L4 extends string = never,
  L5 extends string = never>(
    ops: Operations<V, S, L1, L2, L3, L4, L5>,
    coordinate: Coordinate<S, L1, L2, L3, L4, L5>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    registry: Registry,
  ): UpsertMethod<V, S, L1, L2, L3, L4, L5> => {

  const upsert = async (
    key: PriKey<S> | ComKey<S, L1, L2, L3, L4, L5>,
    itemProperties: Partial<Item<S, L1, L2, L3, L4, L5>>,
    locations?: LocKeyArray<L1, L2, L3, L4, L5>,
    options?: UpdateOptions
  ): Promise<V> => {
    logger.debug('upsert', { key, itemProperties });

    const context: OperationContext = {
      itemType: coordinate.kta[0],
      operationType: 'upsert',
      operationName: 'upsert',
      params: { key, item: itemProperties },
      key
    };

    return executeWithContext(
      async () => {
        let item: V | null = null;
        let created = false;
        let attemptedCreate = false;
        try {
          logger.debug('Retrieving item by key', { key });
          item = await ops.get(key);
        } catch (error: any) {
          // Check if this is a NotFoundError (preserved by core wrapper)
          // Check both instanceof and error code to handle cases where
          // module duplication might break instanceof checks
          const isNotFound = error instanceof NotFoundError ||
            error?.name === 'NotFoundError' ||
            error?.errorInfo?.code === 'NOT_FOUND';

          if (isNotFound) {
            logger.debug('Item not found, creating new item', { key, errorType: error?.name, errorCode: error?.errorInfo?.code });
            // CreateOptions is key XOR locations at the type level; backends that need both
            // (e.g. sequelize contained creates) accept both at runtime.
            const createOptions = locations
              ? ({ key, locations } as any)
              : { key };
            attemptedCreate = true;
            item = await ops.create(itemProperties, createOptions);
            created = !!item;
          } else {
            // Re-throw other errors (connection issues, permissions, etc.)
            logger.error('Unexpected error during upsert get operation', {
              component: 'lib',
              operation: 'upsert',
              phase: 'get-existing',
              key: abbrevIK(key),
              itemType: coordinate.kta[0],
              errorType: error?.constructor?.name || typeof error,
              errorMessage: error?.message,
              errorName: error?.name,
              errorCode: error?.errorInfo?.code,
              suggestion: 'Check database connectivity, permissions, and key validity',
              coordinate: String(coordinate)
            });
            throw error;
          }
        }

        // Some backends (e.g. lib-fs) return null on miss instead of throwing NotFoundError
        if (!item && !attemptedCreate) {
          logger.debug('Item get returned null, creating new item', { key });
          const createOptions = locations
            ? ({ key, locations } as any)
            : { key };
          attemptedCreate = true;
          item = await ops.create(itemProperties, createOptions);
          created = !!item;
        }

        if (!item) {
          logger.error('Failed to retrieve or create item during upsert', {
            component: 'lib',
            operation: 'upsert',
            key: abbrevIK(key),
            itemType: coordinate.kta[0],
            suggestion: 'This should not happen. Check create operation implementation and error handling.',
            coordinate: String(coordinate)
          });
          throw new Error(`Failed to retrieve or create item for upsert with key: ${abbrevIK(key)}`);
        }

        // After a successful create, skip redundant update unless replace was requested.
        // This matches backend-native upsert semantics (create OR update) and avoids
        // double hook firing / extra race window on the create path.
        if (created && !options?.replace) {
          logger.debug('Item created during upsert, skipping redundant update', { key: item.key });
          return item;
        }

        // Update with retry for concurrent deletion/modification.
        // If the item was deleted between our get and update (race condition),
        // retry by re-creating it. This handles the most common race scenario.
        const maxRetries = options?.retryCount ?? 0;
        let retryAttempts = 0;
        let updateResult: V | null = null;

        while (retryAttempts <= maxRetries) {
          try {
            logger.debug('Updating item', { key: item.key, itemProperties, attempt: retryAttempts });
            updateResult = await ops.update(item.key, itemProperties, options);
            logger.debug('Item updated successfully', { item: updateResult });
            break;
          } catch (updateError: any) {
            const isNotFoundOnUpdate = updateError instanceof NotFoundError ||
              updateError?.name === 'NotFoundError' ||
              updateError?.errorInfo?.code === 'NOT_FOUND';

            if (isNotFoundOnUpdate && retryAttempts < maxRetries) {
              logger.warning('Item not found during update, retrying upsert (likely concurrent deletion)', {
                key: abbrevIK(key),
                attempt: retryAttempts + 1,
                maxRetries
              });
              retryAttempts++;
              // Re-create the item since it was deleted
              const createOptions = locations
                ? ({ key, locations } as any)
                : { key };
              item = await ops.create(itemProperties, createOptions);
              continue;
            }

            // Re-throw if not NotFoundError or retries exhausted
            logger.error('Update failed during upsert', {
              component: 'lib',
              operation: 'upsert',
              phase: 'update',
              key: abbrevIK(key),
              itemType: coordinate.kta[0],
              errorType: updateError?.constructor?.name || typeof updateError,
              errorMessage: updateError?.message,
              retryAttempts,
              maxRetries,
              coordinate: String(coordinate)
            });
            throw updateError;
          }
        }

        return updateResult!;
      },
      context
    );
  };

  return upsert;
}
