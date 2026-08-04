/**
 * Type definitions and Zod schemas for the API client.
 * Provides runtime validation and compile-time type safety for all API responses.
 * Adapted to backend responses with integer booleans (0/1) and "items" array.
 */

import { z } from "zod"
import type { CancelToken } from "axios"

// ==================== CORE SCHEMAS ====================

export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    message: z.string().nullable().optional(),
    data: dataSchema.nullable().optional(),
    token: z.string().nullable().optional(),
    exists: z.boolean().nullable().optional(),
  })

export type ApiResponse<T = unknown> = z.infer<ReturnType<typeof ApiResponseSchema<z.ZodType<T>>>>

// ==================== DOMAIN SCHEMAS ====================

export const DbCheckSchema = ApiResponseSchema(
  z.object({
    exists: z.boolean().optional(),
  })
)

export const DbInitSchema = ApiResponseSchema(z.object({}))

export const LoginSchema = ApiResponseSchema(
  z.object({
    token: z.string(),
  })
)

export const SimpleMessageSchema = ApiResponseSchema(z.object({}))

export const AuditEntrySchema = z.object({
  id: z.number(),
  timestamp: z.string(),
  user_id: z.number().nullable().optional(),
  username: z.string().nullable().optional(),
  event_type: z.string().optional(),
  description: z.string().nullable().optional(),
  ip_address: z.string().nullable().optional(),
  file_id: z.number().nullable().optional(),
  file_name: z.string().nullable().optional(),
  success: z.boolean().optional(),
  total_count: z.number().optional(),
})

// Backend returns the audit log rows directly inside the `data` payload:
// { success, message, data: [AuditLogRow] }
export const AuditListSchema = ApiResponseSchema(z.array(AuditEntrySchema))

export const FileItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  size_bytes: z.number(),
  internal_path: z.string(),
  mime_type: z.string().nullable().optional(),
  uploaded_by: z.union([z.string(), z.number()]).nullable().optional(),
  is_public: z.boolean(),
  uploaded_at: z.string().nullable().optional(),
  total_count: z.number().optional(),
})

export const FilesListDataSchema = z.object({
  items: z.array(FileItemSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
})

export const FilesListSchema = ApiResponseSchema(FilesListDataSchema)

export const UploadFileSchema = ApiResponseSchema(FileItemSchema)

export const DeleteFileSchema = ApiResponseSchema(
  z.object({
    success: z.boolean(),
  })
)

export const FilePermissionSchema = z.object({
  user_id: z.number(),
  username: z.string(),
  access_level: z.string(),
  granted_at: z.string(),
  granted_by: z.number(),
})

export const FilePermsListSchema = ApiResponseSchema(z.array(FilePermissionSchema))
export const GrantPermissionSchema = ApiResponseSchema(FilePermissionSchema)

// Users – adjusted to accept 0/1 for boolean fields
export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  role: z.string(),
  is_active: z.union([z.boolean(), z.number()]).transform((v) => Boolean(v)),
  can_upload: z.union([z.boolean(), z.number()]).transform((v) => Boolean(v)),
  can_delete_own_files: z.union([z.boolean(), z.number()]).transform((v) => Boolean(v)),
  has_upload_limits: z.union([z.boolean(), z.number()]).transform((v) => Boolean(v)),
  upload_limit: z.number(),
  created_at: z.string().optional(),
  last_login_at: z.string().optional(),
  total_count: z.number().optional(),
})

export const UsersListSchema = ApiResponseSchema(
  z.object({
    items: z.array(UserSchema),
    total: z.number().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  })
)

export const AccessibleFileSchema = z.object({
  id: z.number(),
  name: z.string(),
  size_bytes: z.number(),
  mime_type: z.string(),
  uploaded_by: z.number(),
  uploaded_at: z.string(),
  access_type: z.enum(["owner", "viewer", "collaborator"]),
})

export const AccessibleFilesSchema = ApiResponseSchema(z.array(AccessibleFileSchema))

export const MeSchema = ApiResponseSchema(
  z.object({
    id: z.number(),
    username: z.string(),
    role: z.string(),
    can_upload: z.union([z.boolean(), z.number()]).transform((v) => Boolean(v)),
    can_delete_own_files: z.union([z.boolean(), z.number()]).transform((v) => Boolean(v)),
    has_upload_limits: z.union([z.boolean(), z.number()]).transform((v) => Boolean(v)),
    upload_limit: z.number(),
  })
)

export const TogglePublicSchema = ApiResponseSchema(z.object({}))

// ==================== INFERRED TYPES ====================

export type DbCheckResponse = z.infer<typeof DbCheckSchema>
export type DbInitResponse = z.infer<typeof DbInitSchema>
export type LoginResponse = z.infer<typeof LoginSchema>
export type SimpleMessageResponse = z.infer<typeof SimpleMessageSchema>
export type AuditEntry = z.infer<typeof AuditEntrySchema>
export type AuditListResponse = z.infer<typeof AuditListSchema>
export type FileItem = z.infer<typeof FileItemSchema>
export type FilesListData = z.infer<typeof FilesListDataSchema>
export type FilesListResponse = z.infer<typeof FilesListSchema>
export type UploadFileResponse = z.infer<typeof UploadFileSchema>
export type DeleteFileResponse = z.infer<typeof DeleteFileSchema>
export type FilePermission = z.infer<typeof FilePermissionSchema>
export type FilePermsResponse = z.infer<typeof FilePermsListSchema>
export type GrantPermissionResponse = z.infer<typeof GrantPermissionSchema>
export type User = z.infer<typeof UserSchema>
export type UsersListResponse = z.infer<typeof UsersListSchema>
export type AccessibleFile = z.infer<typeof AccessibleFileSchema>
export type AccessibleFilesResponse = z.infer<typeof AccessibleFilesSchema>
export type MeData = z.infer<typeof MeSchema>
export type MeResponse = MeData
export type TogglePublicResponse = z.infer<typeof TogglePublicSchema>

// ==================== API RESULT TYPES ====================

export type ApiSuccess<T> = {
  success: true
  data: T
  status: number
  headers: Record<string, string>
}

export type ApiFailure = {
  success: false
  error: {
    message: string
    code: number
    details?: unknown
  }
  status: number
  data?: unknown
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export type BlobResult = {
  blob: Blob
  filename?: string
  headers: Record<string, string>
}

export interface ApiRequestOptions {
  cancelToken?: CancelToken
  onUploadProgress?: (progressEvent: ProgressEvent) => void
  onDownloadProgress?: (progressEvent: ProgressEvent) => void
}

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export interface ApiClientOptions {
  timeoutMs?: number
  defaultHeaders?: Record<string, string>
}
