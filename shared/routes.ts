import { z } from 'zod';
import { insertLeadSchema, insertTaskSchema, insertActivitySchema, insertMasterSchema, leads, tasks, activities, campaigns, tenants } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
};

export const masterRecordSchema = z.object({
  id: z.number(),
  tenantId: z.number(),
  code: z.string(),
  name: z.string(),
  status: z.string(),
  displayOrder: z.number().nullable(),
  createdAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  modifiedAt: z.string().nullable(),
  modifiedBy: z.string().nullable(),
});

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
  },
  masters: {
    list: {
      method: 'GET' as const,
      path: '/api/masters/:tableName' as const,
      responses: {
        200: z.array(masterRecordSchema),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/masters/:tableName/:id' as const,
      responses: {
        200: masterRecordSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/masters/:tableName' as const,
      input: insertMasterSchema.extend({
        // Allow additional fields for specialized master tables
      }).passthrough(),
      responses: {
        201: masterRecordSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/masters/:tableName/:id' as const,
      input: insertMasterSchema.partial().passthrough(),
      responses: {
        200: masterRecordSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/masters/:tableName/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    categories: {
      method: 'GET' as const,
      path: '/api/masters-categories' as const,
      responses: {
        200: z.array(z.object({
          category: z.string(),
          tables: z.array(z.object({
            key: z.string(),
            label: z.string(),
          })),
        })),
      },
    },
  },
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

// Master categories definition for frontend navigation
export const MASTER_CATEGORIES = [
  {
    category: "Location",
    tables: [
      { key: "countries", label: "Country" },
      { key: "states", label: "State" },
      { key: "cities", label: "City" },
      { key: "areas", label: "Area & PIN Code" },
      { key: "pinCodes", label: "PIN Code" },
      { key: "branchServiceability", label: "Branch Serviceability" },
    ]
  },
  {
    category: "Organisation",
    tables: [
      { key: "organisations", label: "Organisation" },
      { key: "branches", label: "Branch" },
      { key: "administrativeDepartments", label: "Administrative Department" },
      { key: "administrativeSubDepartments", label: "Administrative Sub-Department" },
      { key: "designations", label: "Designation" },
      { key: "employmentTypes", label: "Employment Type" },
      { key: "systemRoles", label: "System Role" },
      { key: "crmUsers", label: "CRM User" },
      { key: "callingLines", label: "Calling Line" },
      { key: "userLineAssignments", label: "User Line Assignment" },
    ]
  },
  {
    category: "Treatment & Providers",
    tables: [
      { key: "treatmentDepartments", label: "Treatment Department" },
      { key: "treatmentSubDepartments", label: "Treatment Sub-Department" },
      { key: "consultationTypes", label: "Consultation Type" },
    ]
  },
  {
    category: "Doctors",
    tables: [
      { key: "doctors", label: "Doctor" },
      { key: "opdTimings", label: "OPD Timing" },
      { key: "doctorLeaveExceptions", label: "Doctor Leave Configuration" },
      { key: "doctorSpecialityMappings", label: "Doctor Speciality Mapping" },
    ]
  },
  {
    category: "Lead Generation",
    tables: [
      { key: "leadSourceCategories", label: "Lead Source Category" },
      { key: "leadSources", label: "Lead Source" },
      { key: "campaignChannels", label: "Campaign Channel" },
      { key: "utmSources", label: "UTM Source" },
      { key: "utmMediums", label: "UTM Medium" },
      { key: "utmCampaigns", label: "UTM Campaign" },
      { key: "utmTerms", label: "UTM Term" },
      { key: "utmContents", label: "UTM Content" },
      { key: "referrers", label: "Referrer" },
      { key: "corporateInsurances", label: "Corporate / Insurance" },
      { key: "leadCreationChannels", label: "Lead Creation Channel" },
    ]
  },
  {
    category: "Consultation",
    tables: [
      { key: "appointmentTypes", label: "Appointment Type" },
      { key: "conversionStages", label: "Conversion Stage" },
      { key: "lostReasons", label: "Lost Reason" },
      { key: "noShowReasons", label: "No-Show Reason" },
    ]
  },
  {
    category: "Activity & Workflow",
    tables: [
      { key: "activityTypes", label: "Activity Type" },
      { key: "nextActionTypes", label: "Next Action Type" },
      { key: "taskCategories", label: "Task Category" },
      { key: "leadStatuses", label: "Lead Status" },
      { key: "appointmentStatuses", label: "Appointment Status" },
      { key: "referralStatuses", label: "Referral Status" },
      { key: "callStatuses", label: "Call Status" },
      { key: "callDirections", label: "Call Direction" },
    ]
  },
  {
    category: "Communication",
    tables: [
      { key: "templates", label: "Template" },
      { key: "holidays", label: "Holiday" },
      { key: "tags", label: "Tag" },
    ]
  },
  {
    category: "Governance",
    tables: [
      { key: "slaRules", label: "SLA Rule" },
      { key: "reminderPolicies", label: "Reminder Policy" },
      { key: "dataRetentionPolicies", label: "Data Retention Policy" },
    ]
  },
];
