import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { createCoordinate } from '@fjell/core';
import { createRegistry, NotFoundError, Operations } from '../../src/index';
import { wrapUpsertOperation } from '../../src/ops/upsert';
import { Item, PriKey } from '@fjell/types';
import { randomUUID } from 'crypto';

vi.mock('@fjell/logging', () => {
  const logger = {
    get: vi.fn().mockReturnThis(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    emergency: vi.fn(),
    default: vi.fn(),
    alert: vi.fn(),
    critical: vi.fn(),
    notice: vi.fn(),
    time: vi.fn().mockReturnThis(),
    end: vi.fn(),
    log: vi.fn(),
  };

  return {
    default: {
      getLogger: () => logger,
    }
  }
});
vi.mock('../src/ops/create');
vi.mock('../src/ops/update');

describe('upsert', () => {
  vi.resetAllMocks();
  let operations: Operations<Item<'test'>, 'test'>;
  let getMethodMock: Mock;
  let updateMethodMock: Mock;
  let createMethodMock: Mock;
  let oneMethodMock: Mock;
  let globalOneMethodMock: Mock;

  beforeEach(() => {
    getMethodMock = vi.fn();
    updateMethodMock = vi.fn();
    createMethodMock = vi.fn();
    oneMethodMock = vi.fn();
    globalOneMethodMock = vi.fn();
    operations = {
      get: getMethodMock,
      update: updateMethodMock,
      create: createMethodMock,
      one: oneMethodMock,
      globalOne: globalOneMethodMock,
    } as unknown as Operations<Item<'test'>, 'test'>;
  });

  describe('upsert with key', () => {
    test('should create new item if it does not exist', async () => {
      const key = { kt: 'test', pk: randomUUID() } as PriKey<'test'>;
      const testItem = { name: 'newItem', key } as unknown as Item<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);

      getMethodMock.mockImplementation(() => {
        throw new NotFoundError('get', coordinate, key, {});
      });
      createMethodMock.mockResolvedValueOnce({ ...testItem, action: 'created', key } as Item<'test'>);

      const registry = createRegistry();
      const result = await wrapUpsertOperation(operations, coordinate, registry)(key, itemProperties);
      expect(result).toBeDefined();
      expect(result.action).toBe('created');
      expect(getMethodMock).toHaveBeenCalled();
      expect(createMethodMock).toHaveBeenCalledWith(itemProperties, { key });
      expect(updateMethodMock).not.toHaveBeenCalled();
    });

    test('should create when get returns null', async () => {
      const key = { kt: 'test', pk: randomUUID() } as PriKey<'test'>;
      const testItem = { name: 'newItem', key } as unknown as Item<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);

      getMethodMock.mockResolvedValueOnce(null);
      createMethodMock.mockResolvedValueOnce({ ...testItem, action: 'created', key } as Item<'test'>);

      const registry = createRegistry();
      const result = await wrapUpsertOperation(operations, coordinate, registry)(key, itemProperties);
      expect(result.action).toBe('created');
      expect(createMethodMock).toHaveBeenCalledWith(itemProperties, { key });
      expect(updateMethodMock).not.toHaveBeenCalled();
    });

    test('should pass key and locations to create for contained items', async () => {
      const key = { kt: 'test', pk: randomUUID(), loc: [{ kt: 'level1', lk: 'loc1' }] } as any;
      const locations = [{ kt: 'level1', lk: 'loc1' }] as any;
      const testItem = { name: 'newItem', key } as unknown as Item<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);

      getMethodMock.mockResolvedValueOnce(null);
      createMethodMock.mockResolvedValueOnce({ ...testItem, action: 'created', key } as Item<'test'>);

      const registry = createRegistry();
      await wrapUpsertOperation(operations, coordinate, registry)(key, itemProperties, locations);
      expect(createMethodMock).toHaveBeenCalledWith(itemProperties, { key, locations });
    });

    test('should update new item if exists', async () => {
      const key = { kt: 'test', pk: randomUUID() } as PriKey<'test'>;
      const testItem = { name: 'newItem', key } as unknown as Item<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);

      getMethodMock.mockResolvedValueOnce(testItem);
      updateMethodMock.mockResolvedValueOnce({ ...testItem, action: 'updated', key } as Item<'test'>);

      const registry = createRegistry();
      const result = await wrapUpsertOperation(operations, coordinate, registry)(key, itemProperties);
      expect(result).toBeDefined();
      expect(result.action).toBe('updated');
      expect(getMethodMock).toHaveBeenCalled();
      expect(createMethodMock).not.toHaveBeenCalled();
      expect(updateMethodMock).toHaveBeenCalledWith(key, itemProperties, undefined);
    });

    test('should forward UpdateOptions.replace on existing item', async () => {
      const key = { kt: 'test', pk: randomUUID() } as PriKey<'test'>;
      const testItem = { name: 'newItem', key } as unknown as Item<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);

      getMethodMock.mockResolvedValueOnce(testItem);
      updateMethodMock.mockResolvedValueOnce({ ...testItem, action: 'updated', key } as Item<'test'>);

      const registry = createRegistry();
      await wrapUpsertOperation(operations, coordinate, registry)(key, itemProperties, undefined, { replace: true });
      expect(updateMethodMock).toHaveBeenCalledWith(key, itemProperties, { replace: true });
    });

    test('should rethrow non-NotFoundError errors from get', async () => {
      const key = { kt: 'test', pk: randomUUID() } as PriKey<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);
      const customError = new Error('Database connection failed');

      getMethodMock.mockImplementation(() => {
        throw customError;
      });

      const registry = createRegistry();
      await expect(wrapUpsertOperation(operations, coordinate, registry)(key, itemProperties)).rejects.toThrow('Database connection failed');
      expect(getMethodMock).toHaveBeenCalled();
      expect(createMethodMock).not.toHaveBeenCalled();
      expect(updateMethodMock).not.toHaveBeenCalled();
    });

    test('should throw when create returns null after NotFound', async () => {
      const key = { kt: 'test', pk: randomUUID() } as PriKey<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);

      getMethodMock.mockImplementation(() => {
        throw new NotFoundError('get', coordinate, key, {});
      });
      createMethodMock.mockResolvedValueOnce(null as unknown as Item<'test'>);

      const registry = createRegistry();
      await expect(wrapUpsertOperation(operations, coordinate, registry)(key, itemProperties)).rejects.toThrow('Failed to retrieve or create item');
      expect(updateMethodMock).not.toHaveBeenCalled();
    });


    test('should retry update when item is deleted concurrently (race condition)', async () => {
      const key = { kt: 'test', pk: randomUUID() } as PriKey<'test'>;
      const testItem = { name: 'newItem', key } as unknown as Item<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);

      getMethodMock.mockResolvedValueOnce(testItem);
      updateMethodMock.mockImplementationOnce(() => {
        throw new NotFoundError('update', coordinate, key, {});
      });
      createMethodMock.mockResolvedValueOnce({ ...testItem, action: 'created' } as Item<'test'>);
      updateMethodMock.mockResolvedValueOnce({ ...testItem, action: 'updated' } as Item<'test'>);

      const registry = createRegistry();
      const result = await wrapUpsertOperation(operations, coordinate, registry)(
        key, itemProperties, undefined, { retryCount: 1 } as any
      );

      expect(result.action).toBe('updated');
      expect(getMethodMock).toHaveBeenCalledTimes(1);
      expect(updateMethodMock).toHaveBeenCalledTimes(2);
      expect(createMethodMock).toHaveBeenCalledTimes(1);
    });

    test('should throw after exhausting retries on repeated concurrent deletion', async () => {
      const key = { kt: 'test', pk: randomUUID() } as PriKey<'test'>;
      const testItem = { name: 'newItem', key } as unknown as Item<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);

      getMethodMock.mockResolvedValueOnce(testItem);
      updateMethodMock.mockImplementation(() => {
        throw new NotFoundError('update', coordinate, key, {});
      });
      createMethodMock.mockResolvedValue({ ...testItem } as Item<'test'>);

      const registry = createRegistry();
      await expect(
        wrapUpsertOperation(operations, coordinate, registry)(
          key, itemProperties, undefined, { retryCount: 2 } as any
        )
      ).rejects.toThrow();

      expect(updateMethodMock).toHaveBeenCalledTimes(3);
      expect(createMethodMock).toHaveBeenCalledTimes(2);
    });

    test('should not retry on non-NotFoundError during update', async () => {
      const key = { kt: 'test', pk: randomUUID() } as PriKey<'test'>;
      const testItem = { name: 'newItem', key } as unknown as Item<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);

      getMethodMock.mockResolvedValueOnce(testItem);
      const dbError = new Error('Database connection lost');
      updateMethodMock.mockImplementationOnce(() => { throw dbError; });

      const registry = createRegistry();
      await expect(
        wrapUpsertOperation(operations, coordinate, registry)(
          key, itemProperties, undefined, { retryCount: 3 } as any
        )
      ).rejects.toThrow('Database connection lost');

      expect(updateMethodMock).toHaveBeenCalledTimes(1);
      expect(createMethodMock).not.toHaveBeenCalled();
    });

    test('should pass retryCount option through to update', async () => {
      const key = { kt: 'test', pk: randomUUID() } as PriKey<'test'>;
      const testItem = { name: 'newItem', key } as unknown as Item<'test'>;
      const itemProperties = { name: 'newItem' } as Partial<Item<'test'>>;
      const coordinate = createCoordinate<'test'>(['test'], []);

      getMethodMock.mockResolvedValueOnce(testItem);
      updateMethodMock.mockResolvedValueOnce({ ...testItem, action: 'updated' } as Item<'test'>);

      const registry = createRegistry();
      const opts = { replace: true, retryCount: 2 } as any;
      await wrapUpsertOperation(operations, coordinate, registry)(key, itemProperties, undefined, opts);
      expect(updateMethodMock).toHaveBeenCalledWith(key, itemProperties, opts);
    });

  });
});
