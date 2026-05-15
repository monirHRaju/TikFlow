import { z } from 'zod';

export const UuidSchema = z.string().uuid();

export const SlugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9](-?[a-z0-9])*$/, 'lowercase letters, digits, and single hyphens');

export const EmailSchema = z.string().email().max(254).toLowerCase();

export const PhoneSchema = z
  .string()
  .regex(/^\+?[0-9\s-]{8,20}$/, 'expected international phone format');

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  requestId: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
