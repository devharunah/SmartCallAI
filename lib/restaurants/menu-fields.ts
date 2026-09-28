import { z } from "zod";

export const ItemFields = z.object({
  name: z.string().trim().min(1).max(80),
  nameLg: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  price: z.number().int().min(0).max(10_000_000),
  categoryId: z.string().uuid().nullable().optional(),
  available: z.boolean().optional(),
  aliases: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});
export type ItemFields = z.infer<typeof ItemFields>;

export const ITEM_COLUMNS = "id, category_id, name, name_lg, description, price, available, image_path, aliases, position";

export function itemRow(f: Partial<ItemFields>) {
  return {
    ...(f.name !== undefined && { name: f.name }),
    ...(f.nameLg !== undefined && { name_lg: f.nameLg || null }),
    ...(f.description !== undefined && { description: f.description || null }),
    ...(f.price !== undefined && { price: f.price }),
    ...(f.categoryId !== undefined && { category_id: f.categoryId }),
    ...(f.available !== undefined && { available: f.available }),
    ...(f.aliases !== undefined && { aliases: f.aliases.map((a) => a.toLowerCase()) }),
  };
}
