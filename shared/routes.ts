import { z } from 'zod';
import { insertLeadSchema, insertTaskSchema, insertActivitySchema, leads, tasks, activities, campaigns, tenants } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    me: {
      method: 'GET' as const,
      path: '/api/auth/user' as const,
      responses: {
        200: z.object({
          id: z.string(),
          email: z.string().nullable(),
          firstName: z.string().nullable(),
          lastName: z.string().nullable(),
          profileImageUrl: z.string().nullable(),
        }).nullable(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  tenants: {
    get: {
      method: 'GET' as const,
      path: '/api/tenants/current' as const,
      responses: {
        200: z.custom<typeof tenants.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    }
  },
  leads: {
    list: {
      method: 'GET' as const,
      path: '/api/leads' as const,
      input: z.object({
        status: z.string().optional(),
        search: z.string().optional()
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof leads.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/leads/:id' as const,
      responses: {
        200: z.custom<typeof leads.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/leads' as const,
      input: insertLeadSchema,
      responses: {
        201: z.custom<typeof leads.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/leads/:id' as const,
      input: insertLeadSchema.partial(),
      responses: {
        200: z.custom<typeof leads.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
  tasks: {
    list: {
      method: 'GET' as const,
      path: '/api/tasks' as const,
      responses: {
        200: z.array(z.custom<typeof tasks.$inferSelect>()),
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/tasks/:id' as const,
      input: insertTaskSchema.partial(),
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/tasks' as const,
      input: insertTaskSchema,
      responses: {
        201: z.custom<typeof tasks.$inferSelect>(),
        400: errorSchemas.validation,
      }
    }
  },
  activities: {
    list: {
      method: 'GET' as const,
      path: '/api/leads/:leadId/activities' as const,
      responses: {
        200: z.array(z.custom<typeof activities.$inferSelect>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/leads/:leadId/activities' as const,
      input: insertActivitySchema,
      responses: {
        201: z.custom<typeof activities.$inferSelect>(),
        400: errorSchemas.validation,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
