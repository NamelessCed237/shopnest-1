import { z } from 'zod'
import { MoneySchema } from '../primitives/money.js'
import { CursorQuerySchema } from '../primitives/pagination.js'

export const PRODUCT_STATUS = ['draft', 'active', 'archived'] as const
export type ProductStatus = (typeof PRODUCT_STATUS)[number]

export const ProductVariantSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  price: MoneySchema,
  stock: z.number().int().min(0),
  attributes: z.record(z.string()).default({}),
})
export type ProductVariant = z.infer<typeof ProductVariantSchema>

export const ProductSchema = z.object({
  id: z.string().uuid(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'errors.product.invalidSlug'),
  name: z.string().min(1).max(200),
  description: z.string().max(10_000).default(''),
  price: MoneySchema,
  status: z.enum(PRODUCT_STATUS),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  imageUrls: z.array(z.string().url()).max(10).default([]),
  categoryIds: z.array(z.string().uuid()).default([]),
  variants: z.array(ProductVariantSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Product = z.infer<typeof ProductSchema>

/**
 * doc/06 §2 — les schémas d'entrée DÉRIVENT du schéma d'entité.
 * Les recopier à la main est la duplication de connaissance que DRY interdit.
 */
export const CreateProductSchema = ProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  variants: true,
})
export type CreateProductInput = z.infer<typeof CreateProductSchema>

export const UpdateProductSchema = CreateProductSchema.partial()
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>

export const ListProductsQuerySchema = CursorQuerySchema.extend({
  status: z.enum(PRODUCT_STATUS).optional(),
  categoryId: z.string().uuid().optional(),
  minPriceCents: z.number().int().optional(),
  maxPriceCents: z.number().int().optional(),
  sortBy: z.enum(['createdAt', 'name', 'price', 'stock']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>
