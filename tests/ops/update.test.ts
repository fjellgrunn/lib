import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createCoordinate } from '@fjell/core';
import { HookError, UpdateError, UpdateValidationError } from '../../src/errors';
import { Operations } from '../../src/Operations';
import { createOptions, Options } from '../../src/Options';
import { wrapUpdateOperation } from '../../src/ops/update';
import { createRegistry, Registry } from '../../src/Registry';
import { ComKey, Item } from '@fjell/types';

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

interface TestItem extends Item<'test', 'level1'> {
  id: string;
  name: string;
}

describe('wrapUpdateOperation', () => {
  let mockOperations: Operations<TestItem, 'test', 'level1'>;
  let mockOptions: Options<TestItem, 'test', 'level1'>;
  let mockCoordinate: any;
  let registry: Registry;

  beforeEach(() => {
    mockOperations = {
      update: vi.fn(),
    } as unknown as Operations<TestItem, 'test', 'level1'>;

    registry = createRegistry();
    mockOptions = createOptions<TestItem, 'test', 'level1'>();
    mockCoordinate = createCoordinate(['test', 'level1']);
  });

  describe('basic update operation', () => {
    test('should call wrapped operations update with correct parameters using ComKey', async () => {
      const updateOperation = wrapUpdateOperation(mockOperations, mockOptions, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'updated-name' };
      const expectedItem: TestItem = {
        id: 'test-id',
        name: 'updated-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(expectedItem);

      const result = await updateOperation(key, item);

      expect(mockOperations.update).toHaveBeenCalledWith(key, item, undefined);
      expect(result).toEqual(expectedItem);
    });

    test('should propagate errors from underlying operations as UpdateError', async () => {
      const updateOperation = wrapUpdateOperation(mockOperations, mockOptions, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'updated-name' };
      const updateError = new Error('Database error');

      (mockOperations.update as any).mockRejectedValue(updateError);

      try {
        await updateOperation(key, item);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.cause).toBeInstanceOf(UpdateError);
      }
    });
  });

  describe('pre-update hooks', () => {
    test('should run preUpdate hook and use modified item', async () => {
      const preUpdateHook = vi.fn().mockResolvedValue({ name: 'hook-modified-name', id: 'hook-id' });
      const optionsWithHook = {
        ...mockOptions,
        hooks: { preUpdate: preUpdateHook }
      };

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHook, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: Partial<TestItem> = { name: 'original-name' };
      const expectedResult: TestItem = {
        id: 'hook-id',
        name: 'hook-modified-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(expectedResult);

      const result = await updateOperation(key, originalItem);

      expect(preUpdateHook).toHaveBeenCalledWith(key, originalItem);
      expect(mockOperations.update).toHaveBeenCalledWith(key, { name: 'hook-modified-name', id: 'hook-id' }, undefined);
      expect(result).toEqual(expectedResult);
    });

    test('should throw HookError when preUpdate hook fails', async () => {
      const hookError = new Error('Hook failed');
      const preUpdateHook = vi.fn().mockRejectedValue(hookError);
      const optionsWithHook = {
        ...mockOptions,
        hooks: { preUpdate: preUpdateHook }
      };

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHook, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test-name' };

      try {
        await updateOperation(key, item);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.cause).toBeInstanceOf(HookError);
      }
      expect(mockOperations.update).not.toHaveBeenCalled();
    });

    test('should work without preUpdate hook', async () => {
      const updateOperation = wrapUpdateOperation(mockOperations, mockOptions, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test-name' };
      const expectedResult: TestItem = {
        id: 'test-id',
        name: 'test-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(expectedResult);

      const result = await updateOperation(key, item);

      expect(mockOperations.update).toHaveBeenCalledWith(key, item, undefined);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('post-update hooks', () => {
    test('should run postUpdate hook and return modified result', async () => {
      const postUpdateHook = vi.fn().mockResolvedValue({
        id: 'modified-id',
        name: 'hook-modified-result',
        key: { kt: 'test', pk: 'test-id' }
      } as TestItem);
      const optionsWithHook = {
        ...mockOptions,
        hooks: { postUpdate: postUpdateHook }
      };

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHook, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test-name' };
      const updateResult: TestItem = {
        id: 'test-id',
        name: 'test-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(updateResult);

      const result = await updateOperation(key, item);

      expect(postUpdateHook).toHaveBeenCalledWith(updateResult);
      expect(result).toEqual({
        id: 'modified-id',
        name: 'hook-modified-result',
        key: { kt: 'test', pk: 'test-id' }
      });
    });

    test('should throw UpdateError with HookError as cause when postUpdate hook fails', async () => {
      const hookError = new Error('Post-hook failed');
      const postUpdateHook = vi.fn().mockRejectedValue(hookError);
      const optionsWithHook = {
        ...mockOptions,
        hooks: { postUpdate: postUpdateHook }
      };

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHook, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test-name' };
      const updateResult: TestItem = {
        id: 'test-id',
        name: 'test-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(updateResult);

      try {
        await updateOperation(key, item);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.cause).toBeInstanceOf(UpdateError);
        expect(error.cause.cause).toBeInstanceOf(HookError);
      }
    });

    test('should work without postUpdate hook', async () => {
      const updateOperation = wrapUpdateOperation(mockOperations, mockOptions, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test-name' };
      const expectedResult: TestItem = {
        id: 'test-id',
        name: 'test-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(expectedResult);

      const result = await updateOperation(key, item);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('validation', () => {
    test('should run validation and proceed when valid', async () => {
      const validator = vi.fn().mockResolvedValue(true);
      const optionsWithValidator = {
        ...mockOptions,
        validators: { onUpdate: validator }
      };

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithValidator, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test-name' };
      const expectedResult: TestItem = {
        id: 'test-id',
        name: 'test-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(expectedResult);

      const result = await updateOperation(key, item);

      expect(validator).toHaveBeenCalledWith(key, item);
      expect(mockOperations.update).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    test('should throw UpdateValidationError when validation returns false', async () => {
      const validator = vi.fn().mockResolvedValue(false);
      const optionsWithValidator = {
        ...mockOptions,
        validators: { onUpdate: validator }
      };

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithValidator, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test-name' };

      try {
        await updateOperation(key, item);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(UpdateValidationError);
      }
      expect(validator).toHaveBeenCalledWith(key, item);
      expect(mockOperations.update).not.toHaveBeenCalled();
    });

    test('should throw UpdateValidationError when validator throws error', async () => {
      const validationError = new Error('Validation failed');
      const validator = vi.fn().mockRejectedValue(validationError);
      const optionsWithValidator = {
        ...mockOptions,
        validators: { onUpdate: validator }
      };

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithValidator, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test-name' };

      try {
        await updateOperation(key, item);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(UpdateValidationError);
      }
      expect(validator).toHaveBeenCalledWith(key, item);
      expect(mockOperations.update).not.toHaveBeenCalled();
    });

    test('should work without validation', async () => {
      const updateOperation = wrapUpdateOperation(mockOperations, mockOptions, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test-name' };
      const expectedResult: TestItem = {
        id: 'test-id',
        name: 'test-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(expectedResult);

      const result = await updateOperation(key, item);

      expect(mockOperations.update).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('combined scenarios', () => {
    test('should run preUpdate hook, validation, update, and postUpdate hook in sequence', async () => {
      const preUpdateHook = vi.fn().mockResolvedValue({ name: 'pre-hook-modified' });
      const validator = vi.fn().mockResolvedValue(true);
      const postUpdateHook = vi.fn().mockResolvedValue({
        id: 'post-hook-id',
        name: 'post-hook-modified',
        key: { kt: 'test', pk: 'test-id' }
      } as TestItem);

      const optionsWithAll = {
        ...mockOptions,
        hooks: {
          preUpdate: preUpdateHook,
          postUpdate: postUpdateHook
        },
        validators: { onUpdate: validator }
      };

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithAll, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: Partial<TestItem> = { name: 'original' };
      const updateResult: TestItem = {
        id: 'updated-id',
        name: 'pre-hook-modified',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(updateResult);

      const result = await updateOperation(key, originalItem);

      expect(preUpdateHook).toHaveBeenCalledWith(key, originalItem);
      expect(validator).toHaveBeenCalledWith(key, { name: 'pre-hook-modified' });
      expect(mockOperations.update).toHaveBeenCalledWith(key, { name: 'pre-hook-modified' }, undefined);
      expect(postUpdateHook).toHaveBeenCalledWith(updateResult);
      expect(result).toEqual({
        id: 'post-hook-id',
        name: 'post-hook-modified',
        key: { kt: 'test', pk: 'test-id' }
      });
    });

    test('should stop execution if preUpdate hook fails', async () => {
      const preUpdateHook = vi.fn().mockRejectedValue(new Error('Pre-hook failed'));
      const validator = vi.fn();
      const postUpdateHook = vi.fn();

      const optionsWithAll = {
        ...mockOptions,
        hooks: {
          preUpdate: preUpdateHook,
          postUpdate: postUpdateHook
        },
        validators: { onUpdate: validator }
      };

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithAll, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test' };

      try {
        await updateOperation(key, item);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.cause).toBeInstanceOf(HookError);
      }
      expect(preUpdateHook).toHaveBeenCalled();
      expect(validator).not.toHaveBeenCalled();
      expect(mockOperations.update).not.toHaveBeenCalled();
      expect(postUpdateHook).not.toHaveBeenCalled();
    });

    test('should stop execution if validation fails', async () => {
      const preUpdateHook = vi.fn().mockResolvedValue({ name: 'pre-hook-modified' });
      const validator = vi.fn().mockResolvedValue(false);
      const postUpdateHook = vi.fn();

      const optionsWithAll = {
        ...mockOptions,
        hooks: {
          preUpdate: preUpdateHook,
          postUpdate: postUpdateHook
        },
        validators: { onUpdate: validator }
      };

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithAll, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test' };

      try {
        await updateOperation(key, item);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(UpdateValidationError);
      }
      expect(preUpdateHook).toHaveBeenCalled();
      expect(validator).toHaveBeenCalled();
      expect(mockOperations.update).not.toHaveBeenCalled();
      expect(postUpdateHook).not.toHaveBeenCalled();
    });
  });

  describe('onChange hooks', () => {
    test('should fetch original item and call onChange hook with both items', async () => {
      const onChangeHook = vi.fn().mockResolvedValue(undefined);
      const optionsWithHook = {
        ...mockOptions,
        hooks: { onChange: onChangeHook }
      };

      // Mock the get operation for fetching original item
      mockOperations.get = vi.fn();
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: TestItem = {
        id: 'test-id',
        name: 'original-name',
        key
      } as TestItem;
      const updatedItem: TestItem = {
        id: 'test-id',
        name: 'updated-name',
        key
      } as TestItem;

      (mockOperations.get as any).mockResolvedValue(originalItem);
      (mockOperations.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHook, mockCoordinate, registry);
      const item: Partial<TestItem> = { name: 'updated-name' };

      const result = await updateOperation(key, item);

      expect(mockOperations.get).toHaveBeenCalledWith(key);
      expect(mockOperations.update).toHaveBeenCalledWith(key, item, undefined);
      expect(onChangeHook).toHaveBeenCalledWith(originalItem, updatedItem);
      expect(result).toEqual(updatedItem);
    });

    test('should call onChange after postUpdate hook', async () => {
      const callOrder: string[] = [];
      const onChangeHook = vi.fn().mockImplementation(() => {
        callOrder.push('onChange');
        return Promise.resolve();
      });
      const postUpdateHook = vi.fn().mockImplementation((item) => {
        callOrder.push('postUpdate');
        return Promise.resolve(item);
      });
      const optionsWithHooks = {
        ...mockOptions,
        hooks: {
          postUpdate: postUpdateHook,
          onChange: onChangeHook
        }
      };

      mockOperations.get = vi.fn();
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: TestItem = {
        id: 'test-id',
        name: 'original-name',
        key
      } as TestItem;
      const updatedItem: TestItem = {
        id: 'test-id',
        name: 'updated-name',
        key
      } as TestItem;

      (mockOperations.get as any).mockResolvedValue(originalItem);
      (mockOperations.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHooks, mockCoordinate, registry);
      await updateOperation(key, { name: 'updated-name' });

      expect(callOrder).toEqual(['postUpdate', 'onChange']);
    });

    test('should not fetch original item if onChange hook is not present', async () => {
      mockOperations.get = vi.fn();
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const updatedItem: TestItem = {
        id: 'test-id',
        name: 'updated-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOperations, mockOptions, mockCoordinate, registry);
      await updateOperation(key, { name: 'updated-name' });

      expect(mockOperations.get).not.toHaveBeenCalled();
    });

    test('should not call onChange if fetching original item fails', async () => {
      const onChangeHook = vi.fn();
      const optionsWithHook = {
        ...mockOptions,
        hooks: { onChange: onChangeHook }
      };

      mockOperations.get = vi.fn();
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const updatedItem: TestItem = {
        id: 'test-id',
        name: 'updated-name',
        key
      } as TestItem;

      (mockOperations.get as any).mockRejectedValue(new Error('Failed to fetch'));
      (mockOperations.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHook, mockCoordinate, registry);
      const result = await updateOperation(key, { name: 'updated-name' });

      expect(mockOperations.get).toHaveBeenCalledWith(key);
      expect(onChangeHook).not.toHaveBeenCalled();
      expect(result).toEqual(updatedItem);
    });

    test('should throw HookError when onChange hook fails', async () => {
      const hookError = new Error('onChange failed');
      const onChangeHook = vi.fn().mockRejectedValue(hookError);
      const optionsWithHook = {
        ...mockOptions,
        hooks: { onChange: onChangeHook }
      };

      mockOperations.get = vi.fn();
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: TestItem = {
        id: 'test-id',
        name: 'original-name',
        key
      } as TestItem;
      const updatedItem: TestItem = {
        id: 'test-id',
        name: 'updated-name',
        key
      } as TestItem;

      (mockOperations.get as any).mockResolvedValue(originalItem);
      (mockOperations.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHook, mockCoordinate, registry);

      try {
        await updateOperation(key, { name: 'updated-name' });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.cause).toBeInstanceOf(HookError);
        expect(error.cause.message).toContain('Error in onChange');
      }
    });

    test('should support synchronous onChange hooks', async () => {
      let onChangeCalled = false;
      const onChangeHook = (original: TestItem, updated: TestItem) => {
        onChangeCalled = true;
        expect(original.name).toBe('original-name');
        expect(updated.name).toBe('updated-name');
      };
      const optionsWithHook = {
        ...mockOptions,
        hooks: { onChange: onChangeHook }
      };

      mockOperations.get = vi.fn();
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: TestItem = {
        id: 'test-id',
        name: 'original-name',
        key
      } as TestItem;
      const updatedItem: TestItem = {
        id: 'test-id',
        name: 'updated-name',
        key
      } as TestItem;

      (mockOperations.get as any).mockResolvedValue(originalItem);
      (mockOperations.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHook, mockCoordinate, registry);
      await updateOperation(key, { name: 'updated-name' });

      expect(onChangeCalled).toBe(true);
    });

    test('should detect field changes in onChange hook', async () => {
      interface ExtendedTestItem extends TestItem {
        statusId: string;
      }

      let detectedChange = false;
      const onChangeHook = (original: ExtendedTestItem, updated: ExtendedTestItem) => {
        if (original.statusId !== updated.statusId) {
          detectedChange = true;
        }
      };
      const optionsWithHook = {
        ...mockOptions,
        hooks: { onChange: onChangeHook }
      } as any;

      const mockOps = {
        ...mockOperations,
        get: vi.fn(),
        update: vi.fn()
      } as unknown as Operations<ExtendedTestItem, 'test', 'level1'>;

      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: ExtendedTestItem = {
        id: 'test-id',
        name: 'test-name',
        statusId: 'status-1',
        key
      } as ExtendedTestItem;
      const updatedItem: ExtendedTestItem = {
        id: 'test-id',
        name: 'test-name',
        statusId: 'status-2',
        key
      } as ExtendedTestItem;

      (mockOps.get as any).mockResolvedValue(originalItem);
      (mockOps.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOps, optionsWithHook, mockCoordinate, registry);
      await updateOperation(key, { statusId: 'status-2' } as any);

      expect(detectedChange).toBe(true);
    });

    test('should not call onChange when field has not changed', async () => {
      interface ExtendedTestItem extends TestItem {
        statusId: string;
      }

      let changeDetected = false;
      const onChangeHook = (original: ExtendedTestItem, updated: ExtendedTestItem) => {
        if (original.statusId !== updated.statusId) {
          changeDetected = true;
        }
      };
      const optionsWithHook = {
        ...mockOptions,
        hooks: { onChange: onChangeHook }
      } as any;

      const mockOps = {
        ...mockOperations,
        get: vi.fn(),
        update: vi.fn()
      } as unknown as Operations<ExtendedTestItem, 'test', 'level1'>;

      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: ExtendedTestItem = {
        id: 'test-id',
        name: 'test-name',
        statusId: 'status-1',
        key
      } as ExtendedTestItem;
      const updatedItem: ExtendedTestItem = {
        id: 'test-id',
        name: 'updated-name',
        statusId: 'status-1', // Same statusId
        key
      } as ExtendedTestItem;

      (mockOps.get as any).mockResolvedValue(originalItem);
      (mockOps.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOps, optionsWithHook, mockCoordinate, registry);
      await updateOperation(key, { name: 'updated-name' } as any);

      expect(changeDetected).toBe(false);
    });
  });

  describe('combined scenarios with onChange', () => {
    test('should run preUpdate, update, postUpdate, and onChange in sequence', async () => {
      const callOrder: string[] = [];
      const preUpdateHook = vi.fn().mockImplementation((k, item) => {
        callOrder.push('preUpdate');
        return Promise.resolve(item);
      });
      const postUpdateHook = vi.fn().mockImplementation((item) => {
        callOrder.push('postUpdate');
        return Promise.resolve(item);
      });
      const onChangeHook = vi.fn().mockImplementation(() => {
        callOrder.push('onChange');
        return Promise.resolve();
      });

      const optionsWithAll = {
        ...mockOptions,
        hooks: {
          preUpdate: preUpdateHook,
          postUpdate: postUpdateHook,
          onChange: onChangeHook
        }
      };

      mockOperations.get = vi.fn();
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: TestItem = {
        id: 'test-id',
        name: 'original-name',
        key
      } as TestItem;
      const updatedItem: TestItem = {
        id: 'test-id',
        name: 'updated-name',
        key
      } as TestItem;

      (mockOperations.get as any).mockResolvedValue(originalItem);
      (mockOperations.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithAll, mockCoordinate, registry);
      await updateOperation(key, { name: 'updated-name' });

      expect(callOrder).toEqual(['preUpdate', 'postUpdate', 'onChange']);
      expect(onChangeHook).toHaveBeenCalledWith(originalItem, updatedItem);
    });

    test('should not call onChange if update fails', async () => {
      const onChangeHook = vi.fn();
      const optionsWithHook = {
        ...mockOptions,
        hooks: { onChange: onChangeHook }
      };

      mockOperations.get = vi.fn();
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: TestItem = {
        id: 'test-id',
        name: 'original-name',
        key
      } as TestItem;

      (mockOperations.get as any).mockResolvedValue(originalItem);
      (mockOperations.update as any).mockRejectedValue(new Error('Update failed'));

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHook, mockCoordinate, registry);

      try {
        await updateOperation(key, { name: 'updated-name' });
        expect.fail('Should have thrown an error');
      } catch {
        // Expected error
      }

      expect(onChangeHook).not.toHaveBeenCalled();
    });

    test('should not call onChange if postUpdate fails', async () => {
      const onChangeHook = vi.fn();
      const postUpdateHook = vi.fn().mockRejectedValue(new Error('postUpdate failed'));
      const optionsWithHooks = {
        ...mockOptions,
        hooks: {
          postUpdate: postUpdateHook,
          onChange: onChangeHook
        }
      };

      mockOperations.get = vi.fn();
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: TestItem = {
        id: 'test-id',
        name: 'original-name',
        key
      } as TestItem;
      const updatedItem: TestItem = {
        id: 'test-id',
        name: 'updated-name',
        key
      } as TestItem;

      (mockOperations.get as any).mockResolvedValue(originalItem);
      (mockOperations.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithHooks, mockCoordinate, registry);

      try {
        await updateOperation(key, { name: 'updated-name' });
        expect.fail('Should have thrown an error');
      } catch {
        // Expected error
      }

      expect(onChangeHook).not.toHaveBeenCalled();
    });

    test('should allow onChange to work with validation', async () => {
      const validator = vi.fn().mockResolvedValue(true);
      const onChangeHook = vi.fn().mockResolvedValue(undefined);
      const optionsWithValidationAndHook = {
        ...mockOptions,
        validators: { onUpdate: validator },
        hooks: { onChange: onChangeHook }
      };

      mockOperations.get = vi.fn();
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const originalItem: TestItem = {
        id: 'test-id',
        name: 'original-name',
        key
      } as TestItem;
      const updatedItem: TestItem = {
        id: 'test-id',
        name: 'updated-name',
        key
      } as TestItem;

      (mockOperations.get as any).mockResolvedValue(originalItem);
      (mockOperations.update as any).mockResolvedValue(updatedItem);

      const updateOperation = wrapUpdateOperation(mockOperations, optionsWithValidationAndHook, mockCoordinate, registry);
      await updateOperation(key, { name: 'updated-name' });

      expect(validator).toHaveBeenCalledWith(key, { name: 'updated-name' });
      expect(onChangeHook).toHaveBeenCalledWith(originalItem, updatedItem);
    });
  });

  describe('edge cases', () => {
    test('should handle empty item object', async () => {
      const updateOperation = wrapUpdateOperation(mockOperations, mockOptions, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = {};
      const expectedResult: TestItem = {
        id: 'test-id',
        name: 'existing-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(expectedResult);

      const result = await updateOperation(key, item);

      expect(mockOperations.update).toHaveBeenCalledWith(key, {}, undefined);
      expect(result).toEqual(expectedResult);
    });

    test('should handle undefined options', async () => {
      const updateOperation = wrapUpdateOperation(mockOperations, {} as Options<TestItem, 'test', 'level1'>, mockCoordinate, registry);
      const key: ComKey<'test', 'level1'> = {
        kt: 'test',
        pk: 'test-id',
        loc: [{ kt: 'level1', lk: 'location1' }]
      };
      const item: Partial<TestItem> = { name: 'test-name' };
      const expectedResult: TestItem = {
        id: 'test-id',
        name: 'test-name',
        key
      } as TestItem;

      (mockOperations.update as any).mockResolvedValue(expectedResult);

      const result = await updateOperation(key, item);

      expect(result).toEqual(expectedResult);
    });
  });
});
