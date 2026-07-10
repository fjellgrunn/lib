import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Coordinate, Item } from '@fjell/types';
import { createOptions } from '../src/Options';
import { wrapCreateOperation } from '../src/ops/create';
import { wrapUpdateOperation } from '../src/ops/update';
import { CreateValidationError, UpdateValidationError } from '../src/errors';

// Mock item type
interface TestItem extends Item<"test", "loc1"> {
  id: string;
  name: string;
  age: number;
  email?: string;
}

// Mock operations
const mockOperations = {
  create: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  all: vi.fn(),
  find: vi.fn(),
  finder: vi.fn(),
  action: vi.fn(),
  facet: vi.fn(),
  allFacets: {},
};

// Mock registry
const mockRegistry: any = {};

// Mock coordinate
const coordinate: Coordinate<"test", "loc1"> = {
  kta: ["test", "loc1"],
  params: {
    primaryKey: "testId",
    locationKeys: ["loc1Id"]
  }
};

describe('Validation Library Integration', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockOperations.create.mockImplementation(async (item) => item);
    mockOperations.update.mockImplementation(async (key, item) => item);
  });

  describe('Create Validation', () => {
    const userSchema = z.object({
      id: z.string(),
      name: z.string().min(3, "Name too short"),
      age: z.number().min(18, "Must be 18+"),
      email: z.string().email().optional(),
      // Item properties
      kta: z.any().optional(),
      meta: z.any().optional(),
      events: z.any().optional(),
      refs: z.any().optional(),
      aggs: z.any().optional(),
    });

    it('should pass validation with valid data', async () => {
      const options = createOptions<TestItem, "test", "loc1">({
        validation: {
          schema: userSchema as any
        }
      });

      const createOp = wrapCreateOperation(mockOperations as any, options, coordinate, mockRegistry);
      const validItem: Partial<TestItem> = {
        id: "123",
        name: "Alice",
        age: 25,
        email: "alice@example.com"
      };

      // Mock validateKey and validateLocations which are called internally
      vi.mock('@fjell/validation', async (importOriginal) => {
        const mod = await importOriginal<any>();
        return {
          ...mod,
          validateKey: vi.fn(),
          validateLocations: vi.fn(),
        };
      });

      const result = await createOp(validItem, { locations: [{ kt: "loc1", lk: "loc1Id" }] as any });
      expect(result).toEqual(validItem);
      expect(mockOperations.create).toHaveBeenCalledWith(validItem, expect.anything());
    });

    it('should fail validation with invalid data and return structured errors', async () => {
      const options = createOptions<TestItem, "test", "loc1">({
        validation: {
          schema: userSchema as any
        }
      });

      const createOp = wrapCreateOperation(mockOperations as any, options, coordinate, mockRegistry);
      const invalidItem: Partial<TestItem> = {
        id: "123",
        name: "Al", // Too short
        age: 15,   // Too young
        email: "not-an-email" // Invalid email
      };

      try {
        await createOp(invalidItem, { locations: [{ kt: "loc1", lk: "loc1Id" }] as any });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(CreateValidationError);
        // The error cause might be wrapped or plain object depending on how vitest handles cross-package errors
        const cause = error.cause;
        
        // Try to find fieldErrors in various locations
        // Debugging output
        console.log('Error Cause:', JSON.stringify(cause, null, 2));
        
        const errors = cause.fieldErrors || cause.errorInfo?.details?.fieldErrors || cause.details?.fieldErrors;
        
        expect(errors).toBeDefined();
        expect(errors).toHaveLength(3);
        
        const nameError = errors?.find((e: any) => e.path.includes('name'));
        expect(nameError?.message).toContain("Name too short");
        
        const ageError = errors?.find((e: any) => e.path.includes('age'));
        expect(ageError?.message).toContain("Must be 18+");
      }
    });

    it('should work alongside legacy manual validators', async () => {
      const manualValidator = vi.fn().mockResolvedValue(true);
      const options = createOptions<TestItem, "test", "loc1">({
        validation: {
          schema: userSchema as any
        },
        validators: {
          onCreate: manualValidator
        }
      });

      const createOp = wrapCreateOperation(mockOperations as any, options, coordinate, mockRegistry);
      const validItem: Partial<TestItem> = {
        id: "123",
        name: "Alice",
        age: 25
      };

      await createOp(validItem, { locations: [{ kt: "loc1", lk: "loc1Id" }] as any });
      expect(manualValidator).toHaveBeenCalled();
    });

    it('should fail if legacy manual validator returns false', async () => {
      const manualValidator = vi.fn().mockResolvedValue(false);
      const options = createOptions<TestItem, "test", "loc1">({
        validation: {
          schema: userSchema as any
        },
        validators: {
          onCreate: manualValidator
        }
      });
  
      const createOp = wrapCreateOperation(mockOperations as any, options, coordinate, mockRegistry);
      const validItem: Partial<TestItem> = {
        id: "123",
        name: "Alice",
        age: 25
      };
  
      try {
        await createOp(validItem, { locations: [{ kt: "loc1", lk: "loc1Id" }] as any });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(CreateValidationError);
      }
    });
  });

  describe('Update Validation', () => {
    const updateSchema = z.object({
      name: z.string().min(3, "Name too short").optional(),
      age: z.number().min(18, "Must be 18+").optional(),
      email: z.string().email().optional(),
    });

    it('should pass validation with valid partial update', async () => {
      const options = createOptions<TestItem, "test", "loc1">({
        validation: {
          updateSchema: updateSchema as any
        }
      });

      const updateOp = wrapUpdateOperation(mockOperations as any, options, coordinate, mockRegistry);
      const validUpdate: Partial<TestItem> = {
        name: "Bob",
        // age is missing, should be fine
      };

      const result = await updateOp({ pk: "123" }, validUpdate);
      expect(result).toEqual(validUpdate);
      expect(mockOperations.update).toHaveBeenCalledWith({ pk: "123" }, validUpdate, undefined);
    });

    it('should fail validation with invalid partial update', async () => {
      const options = createOptions<TestItem, "test", "loc1">({
        validation: {
          updateSchema: updateSchema as any
        }
      });
  
      const updateOp = wrapUpdateOperation(mockOperations as any, options, coordinate, mockRegistry);
      const invalidUpdate: Partial<TestItem> = {
        name: "Bo", // Too short
      };
  
      try {
        await updateOp({ pk: "123" }, invalidUpdate);
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(UpdateValidationError);
        const cause = error.cause;
          
        // Try to find fieldErrors in various locations
        const errors = cause.fieldErrors || cause.errorInfo?.details?.fieldErrors || cause.details?.fieldErrors;
          
        expect(errors).toBeDefined();
        expect(errors[0].path).toContain('name');
      }
    });

    it('should NOT validate if no updateSchema is provided (even if schema is present)', async () => {
      // This confirms our design decision to avoid false positives on partial updates
      const mainSchema = z.object({
        name: z.string().min(3),
        age: z.number().min(18) // Required in main schema
      });

      const options = createOptions<TestItem, "test", "loc1">({
        validation: {
          schema: mainSchema as any
          // No updateSchema
        }
      });
  
      const updateOp = wrapUpdateOperation(mockOperations as any, options, coordinate, mockRegistry);
      const partialUpdate: Partial<TestItem> = {
        name: "Bob"
        // age missing, would fail main schema, but should pass here
      };
  
      await updateOp({ pk: "123" }, partialUpdate);
      expect(mockOperations.update).toHaveBeenCalled();
    });
  });
});

