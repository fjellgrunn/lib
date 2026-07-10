/* eslint-disable indent */
import {
  AffectedKeys,
  Coordinate,
  PrimaryOperations as CorePrimaryOperations,
  Item,
  OperationParams
} from "@fjell/types";
import { ActionMethod, AllActionMethod, AllFacetMethod, FacetMethod, FinderMethod, Options } from "../Options";
import { wrapOperations as wrapAbstractOperations, Operations as AbstractOperations } from "../Operations";

import LibLogger from "../logger";
import { Registry } from "../Registry";

const logger = LibLogger.get("primary", "Operations");

export interface Operations<
  V extends Item<S>,
  S extends string
> extends CorePrimaryOperations<V, S> {
  // Lib-specific extensions
  finders: Record<string, FinderMethod<V, S>>;
  actions: Record<string, ActionMethod<V, S>>;
  facets: Record<string, FacetMethod<V, S>>;
  allActions: Record<string, AllActionMethod<V, S>>;
  allFacets: Record<string, AllFacetMethod>;
}

// Re-export types
export type { OperationParams, AffectedKeys };

export const wrapOperations = <
  V extends Item<S>,
  S extends string
>(
  toWrap: Operations<V, S>,
  options: Options<V, S>,
  coordinate: Coordinate<S>,
  registry: Registry,

): Operations<V, S> => {
  logger.debug("wrapOperations", { toWrap, options, coordinate, registry });
  // Primary types use 2 type params (V, S) while abstract uses 7 (V, S, L1-L5 defaulting to never).
  // Cast through the 7-param form with never defaults to bridge the parametricity gap safely.
  const operations = wrapAbstractOperations(
    toWrap as AbstractOperations<V, S, never, never, never, never, never>,
    options as Options<V, S, never, never, never, never, never>,
    coordinate as Coordinate<S, never, never, never, never, never>,
    registry,
  );
  return operations as Operations<V, S>;
};
