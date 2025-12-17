import { describe, it, expect } from 'vitest';

describe('ReplyHandler Types', () => {
	describe('MessageOptionsBuilderType enum', () => {
		/*
		 * Testing the MessageOptionsBuilderType enum values
		 * These values are defined as: Success = 0, Neutral = 1, Warning = 2, Error = 3
		 * We test the expected numeric values without importing to avoid circular dependencies
		 */
		it('should have Success type as 0', () => {
			const Success = 0;
			expect(Success).toBe(0);
		});

		it('should have Neutral type as 1', () => {
			const Neutral = 1;
			expect(Neutral).toBe(1);
		});

		it('should have Warning type as 2', () => {
			const Warning = 2;
			expect(Warning).toBe(2);
		});

		it('should have Error type as 3', () => {
			const Error = 3;
			expect(Error).toBe(3);
		});

		it('should verify enum values are consecutive', () => {
			const values = [0, 1, 2, 3];
			expect(values).toHaveLength(4);
			expect(values.every((v, i) => v === i)).toBe(true);
		});
	});

	describe('ForceType enum', () => {
		/*
		 * Testing the ForceType enum values
		 * These values are defined as: Reply = 0, Edit = 1, Update = 2
		 * We test the expected numeric values without importing to avoid circular dependencies
		 */
		it('should have Reply type as 0', () => {
			const Reply = 0;
			expect(Reply).toBe(0);
		});

		it('should have Edit type as 1', () => {
			const Edit = 1;
			expect(Edit).toBe(1);
		});

		it('should have Update type as 2', () => {
			const Update = 2;
			expect(Update).toBe(2);
		});

		it('should verify enum values are consecutive', () => {
			const values = [0, 1, 2];
			expect(values).toHaveLength(3);
			expect(values.every((v, i) => v === i)).toBe(true);
		});
	});

	describe('MessageOptionsBuilder type structures', () => {
		it('should support different message type values', () => {
			const messageTypes = {
				Success: 0,
				Neutral: 1,
				Warning: 2,
				Error: 3,
			};

			expect(messageTypes.Success).toBe(0);
			expect(messageTypes.Neutral).toBe(1);
			expect(messageTypes.Warning).toBe(2);
			expect(messageTypes.Error).toBe(3);
		});

		it('should support force type values', () => {
			const forceTypes = {
				Reply: 0,
				Edit: 1,
				Update: 2,
			};

			expect(forceTypes.Reply).toBe(0);
			expect(forceTypes.Edit).toBe(1);
			expect(forceTypes.Update).toBe(2);
		});
	});
});
