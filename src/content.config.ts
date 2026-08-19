import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const announcements = defineCollection({
  type: 'content_layer',
  loader: glob({ pattern: '**/*.md', base: './src/content/announcements' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    category: z.string().default('通知'),
    summary: z.string().default(''),
    draft: z.boolean().default(false),
  }),
});

const activities = defineCollection({
  type: 'content_layer',
  loader: glob({ pattern: '**/*.md', base: './src/content/activities' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    location: z.string().default(''),
    category: z.string().default('活动'),
    summary: z.string().default(''),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  type: 'content_layer',
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    category: z.string().default('项目'),
    tech: z.array(z.string()).default([]),
    status: z.string().default('进行中'),
    summary: z.string().default(''),
    draft: z.boolean().default(false),
  }),
});

export const collections = { announcements, activities, projects };
