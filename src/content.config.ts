import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string().min(1).default('PALDYN'),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    type: z.enum(['record', 'knowledge']).default('record'),
    category: z.string().min(1),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    thumb: z.string().optional(),
    thumbVariant: z.enum(['a', 'b', 'c', 'd', 'e', 'f']).optional(),
    heroGradient: z.string().optional(),
  }),
});

export const collections = { posts };
