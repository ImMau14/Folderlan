// API client for handling HTTP requests to the backend.
// Provides type-safe methods for all endpoints with proper error handling.
// Uses Zod for runtime validation and CancelToken for request cancellation.

import axios, {
  type AxiosRequestConfig,
  type AxiosError,
  type CancelTokenSource,
  type AxiosProgressEvent,
} from "axios"
import { z, type ZodError } from "zod"
import { envConfig } from "@shared/config/env"

import {
  // Zod schemas
  DbCheckSchema,
  DbInitSchema,
  LoginSchema,
  SimpleMessageSchema,
  AuditListSchema,
  UploadFileSchema,
  FilesListSchema,
  DeleteFileSchema,
  FilePermsListSchema,
  GrantPermissionSchema,
  UsersListSchema,
  AccessibleFilesSchema,

  // TypeScript types
  type ApiResult,
  type BlobResult,
  type ApiClientOptions,
  type ApiRequestOptions,
  type DbCheckResponse,
  type DbInitResponse,
  type LoginResponse,
  type SimpleMessageResponse,
  type AuditListResponse,
  type UploadFileResponse,
  type FilesListResponse,
  type DeleteFileResponse,
  type FilePermsResponse,
  type GrantPermissionResponse,
  type UsersListResponse,
  type AccessibleFilesResponse,

  // ApiError class
  ApiError,
} from "./types"

export class ApiClient {
  private axiosInstance
  private token: string | null = null
  private baseUrl: string = envConfig.API_URL

  constructor(opts?: ApiClientOptions) {
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: opts?.timeoutMs ?? 30_000,
      headers: {
        "Content-Type": "application/json",
        ...(opts?.defaultHeaders ?? {}),
      },
    })

    this.setupInterceptors()
  }

  // ==================== INTERCEPTORS ====================

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use((config) => {
      if (this.token && config.headers) {
        config.headers.Authorization = `Bearer ${this.token}`
      }
      return config
    })

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.code === "ECONNABORTED") {
          throw new ApiError(408, "Request timeout")
        }
        if (!error.response) {
          throw new ApiError(0, "Network error", error.message)
        }
        return Promise.reject(error)
      }
    )
  }

  // ==================== TOKEN MANAGEMENT ====================

  setToken(token: string | null): void {
    this.token = token
    if (token) {
      this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`
    } else {
      delete this.axiosInstance.defaults.headers.common["Authorization"]
    }
  }

  clearToken(): void {
    this.setToken(null)
  }

  // ==================== REQUEST CANCELLATION ====================

  createCancelToken(): CancelTokenSource {
    return axios.CancelToken.source()
  }

  cancelWithMessage(source: CancelTokenSource, message: string = "Request cancelled"): void {
    source.cancel(message)
  }

  // ==================== CORE REQUEST METHODS ====================

  private async request<T>(
    config: AxiosRequestConfig,
    schema: z.ZodType<T>,
    options?: ApiRequestOptions
  ): Promise<ApiResult<T>> {
    try {
      const headers = { ...(config.headers ?? {}) } as Record<string, string | undefined>

      if (config.data instanceof FormData) {
        headers["Content-Type"] = undefined
        headers["content-type"] = undefined
      }

      const finalConfig: AxiosRequestConfig = {
        ...config,
        headers,
        cancelToken: options?.cancelToken,
        // Cast to AxiosProgressEvent to match axios expectations
        onUploadProgress: options?.onUploadProgress as
          | ((progressEvent: AxiosProgressEvent) => void)
          | undefined,
        onDownloadProgress: options?.onDownloadProgress as
          | ((progressEvent: AxiosProgressEvent) => void)
          | undefined,
      }

      const response = await this.axiosInstance.request(finalConfig)
      const validated = schema.parse(response.data)

      return {
        success: true,
        data: validated,
        status: response.status,
        headers: response.headers as Record<string, string>,
      }
    } catch (error: unknown) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: {
            message: error.message || "Request cancelled",
            code: 499,
            details: error,
          },
          status: 499,
          data: undefined,
        }
      }

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: {
            message: "Response validation failed",
            code: 0,
            details: (error as ZodError).issues,
          },
          status: 0,
          data: undefined,
        }
      }

      if (error instanceof ApiError) {
        return {
          success: false,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
          },
          status: error.code,
          data: undefined,
        }
      }

      if (axios.isAxiosError(error) && error.response) {
        const response = error.response
        const data = response.data

        let message = `HTTP ${response.status}`
        if (data?.message) {
          message = data.message
        } else if (typeof data === "string") {
          message = data
        }

        return {
          success: false,
          error: {
            message,
            code: response.status,
            details: data,
          },
          status: response.status,
          data: data,
        }
      }

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          code: 0,
          details: error,
        },
        status: 0,
        data: undefined,
      }
    }
  }

  private async requestBlob(
    config: AxiosRequestConfig,
    options?: ApiRequestOptions
  ): Promise<ApiResult<BlobResult>> {
    try {
      const finalConfig: AxiosRequestConfig = {
        ...config,
        responseType: "blob",
        cancelToken: options?.cancelToken,
        onDownloadProgress: options?.onDownloadProgress as
          | ((progressEvent: AxiosProgressEvent) => void)
          | undefined,
      }

      const response = await this.axiosInstance.request(finalConfig)

      let filename: string | undefined
      const contentDisposition = response.headers["content-disposition"]
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+?)"/)
        if (match?.[1]) {
          filename = match[1]
        }
      }

      return {
        success: true,
        data: {
          blob: response.data,
          filename,
          headers: response.headers as Record<string, string>,
        },
        status: response.status,
        headers: response.headers as Record<string, string>,
      }
    } catch (error: unknown) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: {
            message: error.message || "Request cancelled",
            code: 499,
            details: error,
          },
          status: 499,
          data: undefined,
        }
      }

      if (error instanceof ApiError) {
        return {
          success: false,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
          },
          status: error.code,
          data: undefined,
        }
      }

      if (axios.isAxiosError(error) && error.response) {
        const response = error.response
        let message = `HTTP ${response.status}`

        if (response.headers["content-type"]?.includes("application/json")) {
          try {
            const blob = response.data as Blob
            const text = await blob.text()
            const jsonError = JSON.parse(text)
            if (jsonError.message) {
              message = jsonError.message
            }
          } catch {
            // Keep default message
          }
        }

        return {
          success: false,
          error: {
            message,
            code: response.status,
            details: response.data,
          },
          status: response.status,
          data: response.data,
        }
      }

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          code: 0,
          details: error,
        },
        status: 0,
        data: undefined,
      }
    }
  }

  // ==================== CONVENIENCE METHODS ====================

  private get<T>(
    url: string,
    params?: unknown,
    schema?: z.ZodType<T>,
    options?: ApiRequestOptions
  ) {
    return this.request<T>({ method: "GET", url, params }, schema!, options)
  }

  private post<T>(url: string, data?: unknown, schema?: z.ZodType<T>, options?: ApiRequestOptions) {
    return this.request<T>({ method: "POST", url, data }, schema!, options)
  }

  private delete<T>(url: string, schema?: z.ZodType<T>, options?: ApiRequestOptions) {
    return this.request<T>({ method: "DELETE", url }, schema!, options)
  }

  // ==================== DATABASE ENDPOINTS ====================

  async checkDb(): Promise<ApiResult<DbCheckResponse>> {
    return this.get("/api/db", undefined, DbCheckSchema)
  }

  async initDb(): Promise<ApiResult<DbInitResponse>> {
    return this.post("/api/db", undefined, DbInitSchema)
  }

  // ==================== AUTHENTICATION ENDPOINTS ====================

  async login(username: string, password: string): Promise<ApiResult<LoginResponse>> {
    const result = await this.post("/api/auth/login", { username, password }, LoginSchema)
    if (result.success && result.data.token) {
      this.setToken(result.data.token)
    }
    return result
  }

  async registerVisitor(payload: {
    username: string
    password: string
    can_upload: boolean
    can_delete_own_files: boolean
    has_upload_limits: boolean
    upload_limit: number
  }): Promise<ApiResult<SimpleMessageResponse>> {
    return this.post("/api/auth/register", payload, SimpleMessageSchema)
  }

  async ownerRegister(
    username: string,
    password: string
  ): Promise<ApiResult<SimpleMessageResponse>> {
    return this.post("/api/auth/owner_register", { username, password }, SimpleMessageSchema)
  }

  async ownerResetPassword(password: string): Promise<ApiResult<SimpleMessageResponse>> {
    return this.post("/api/auth/owner_reset_password", { password }, SimpleMessageSchema)
  }

  async visitorResetPassword(
    username: string,
    password: string
  ): Promise<ApiResult<SimpleMessageResponse>> {
    return this.post(
      "/api/auth/visitor_reset_password",
      { username, password },
      SimpleMessageSchema
    )
  }

  // ==================== AUDIT ENDPOINTS ====================

  async getAudit(params?: {
    start?: string
    end?: string
    user_id?: number
    file_id?: number
    event_type?: string
    success?: boolean
    limit?: number
    offset?: number
  }): Promise<ApiResult<AuditListResponse>> {
    return this.get("/api/audit", params, AuditListSchema)
  }

  // ==================== FILE ENDPOINTS ====================

  async uploadFile(
    file: File,
    options?: ApiRequestOptions
  ): Promise<ApiResult<UploadFileResponse>> {
    const form = new FormData()
    form.append("file", file)

    return this.request(
      {
        method: "POST",
        url: "/api/files/upload",
        data: form,
      },
      UploadFileSchema,
      options
    )
  }

  async listFiles(params?: {
    name?: string
    min_size?: number
    max_size?: number
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
  }): Promise<ApiResult<FilesListResponse>> {
    return this.get("/api/files", params, FilesListSchema)
  }

  async deleteFile(id: number): Promise<ApiResult<DeleteFileResponse>> {
    return this.delete(`/api/files/${id}`, DeleteFileSchema)
  }

  async downloadFile(id: number, options?: ApiRequestOptions): Promise<ApiResult<BlobResult>> {
    return this.requestBlob(
      {
        method: "GET",
        url: `/api/files/download/${id}`,
      },
      options
    )
  }

  async grantFilePerms(
    id: number,
    body: { user_id: number; access_level: string }
  ): Promise<ApiResult<GrantPermissionResponse>> {
    return this.post(`/api/files/${id}/perms`, body, GrantPermissionSchema)
  }

  async listFilePerms(id: number): Promise<ApiResult<FilePermsResponse>> {
    return this.get(`/api/files/${id}/perms`, undefined, FilePermsListSchema)
  }

  async revokeFilePerm(id: number, userId: number): Promise<ApiResult<SimpleMessageResponse>> {
    return this.delete(`/api/files/${id}/perms/${userId}`, SimpleMessageSchema)
  }

  // ==================== USER ENDPOINTS ====================

  async getUsers(params?: {
    name?: string
    perm?: string
    is_active?: boolean
    include_deleted?: boolean
    limit?: number
    offset?: number
  }): Promise<ApiResult<UsersListResponse>> {
    return this.get("/api/user", params, UsersListSchema)
  }

  async deleteUser(id: number): Promise<ApiResult<SimpleMessageResponse>> {
    return this.delete(`/api/user/${id}`, SimpleMessageSchema)
  }

  async toggleUser(id: number): Promise<ApiResult<SimpleMessageResponse>> {
    return this.post(`/api/user/${id}/toggle`, undefined, SimpleMessageSchema)
  }

  async updateUserPerms(
    id: number,
    body: {
      can_upload?: boolean
      can_delete_own_files?: boolean
      has_upload_limits?: boolean
      upload_limit?: number
    }
  ): Promise<ApiResult<SimpleMessageResponse>> {
    return this.post(`/api/user/${id}/perms`, body, SimpleMessageSchema)
  }

  async getAccessibleFiles(id: number): Promise<ApiResult<AccessibleFilesResponse>> {
    return this.get(`/api/user/${id}/accessible`, undefined, AccessibleFilesSchema)
  }

  // ==================== UTILITY METHODS ====================

  unwrap<T>(result: ApiResult<T>): T {
    if (result.success) {
      return result.data
    }
    throw new ApiError(result.error.code, result.error.message, result.error.details)
  }

  handleResult<T>(
    result: ApiResult<T>,
    onSuccess: (data: T) => void,
    onError: (error: ApiError) => void
  ): void {
    if (result.success) {
      onSuccess(result.data)
    } else {
      onError(new ApiError(result.error.code, result.error.message, result.error.details))
    }
  }
}

export default ApiClient