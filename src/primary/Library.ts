import { createLibrary as createAbstractLibrary, Library as AbstractLibrary } from "../Library";
import LibLogger from "../logger";
import { Operations } from "./Operations";
import { Operations as AbstractOperations } from "../Operations";
import { Coordinate, Item } from "@fjell/types";
import { Registry } from "@fjell/registry";
import { Options } from "./Options";
import { Options as AbstractOptions } from "../Options";

const logger = LibLogger.get("primary", "Instance");

export interface Library<
  V extends Item<S>,
  S extends string
> {
  coordinate: Coordinate<S>;
  registry: Registry;
  operations: Operations<V, S>;
  options: Options<V, S>;
}

export const createLibrary = <
  V extends Item<S>,
  S extends string
>(
    registry: Registry,
    coordinate: Coordinate<S>,
    operations: Operations<V, S>,
    options: Options<V, S>,
  ): Library<V, S> => {

  logger.debug("createLibrary", { coordinate, operations, registry, options });

  // Primary types use 2 type params (V, S) while abstract uses 7 (V, S, L1-L5 defaulting to never).
  // Cast through the 7-param form with never defaults to bridge the parametricity gap safely.
  const library = createAbstractLibrary(
    registry,
    coordinate as Coordinate<S, never, never, never, never, never>,
    operations as AbstractOperations<V, S, never, never, never, never, never>,
    options as AbstractOptions<V, S, never, never, never, never, never>,
  ) as AbstractLibrary<V, S, never, never, never, never, never> | null;

  // Handle null/undefined returns from abstract createLibrary
  if (!library) {
    // library is null here; cast to the expected return type for the null case.
    return null as unknown as Library<V, S>;
  }

  // Cast through unknown: the abstract Library has wider finders/actions types (7 params)
  // than the primary Library (2 params). The runtime shape is identical; the mismatch
  // is purely a TypeScript parametricity artifact from the L1-L5 defaults being never.
  return {
    ...(library as unknown as Library<V, S>),
    operations,
  };
}
