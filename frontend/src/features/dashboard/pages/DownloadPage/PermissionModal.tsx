/**
 * PermissionModal — manage permissions and visibility for one or many files.
 *
 * Accepts either a single file (fileId/fileName) or a batch (fileIds).
 * Features:
 * - Grant viewer/collaborator access to another user (applied to every file).
 * - Revoke a user's access on all target files at once.
 * - Toggle public/private visibility in bulk; `initialVisibility` preselects
 *   the matching button (`"mixed"` when the selection contains both states).
 */
import { useState, useCallback, useMemo } from "react"
import { FaUserPlus, FaUserMinus, FaLock, FaGlobe } from "react-icons/fa6"

import { useI18n } from "@i18n/context/I18nContext"
import { useToast } from "@toast/context/ToastContext"
import { useModal } from "@modal/context/ModalContext"
import type { FilePermission, User } from "@shared/utils/ApiClient/types"
import ApiClient from "@shared/utils/ApiClient"
import Select from "@shared/components/Select"

interface PermissionModalProps {
  fileId?: number
  fileName?: string
  fileIds?: number[]
  /** true = all public, false = all private, "mixed" = a combination of both */
  initialVisibility?: boolean | "mixed"
  /** Whether the caller can manage (grant/revoke/toggle) these files. */
  canManage?: boolean
  /** Users prefetched by the page, so the grant selector opens instantly. */
  initialUsers?: User[]
  apiClient: ApiClient
  onRefresh: () => void
}

export default function PermissionModal({
  fileId,
  fileName,
  fileIds,
  initialVisibility,
  canManage = true,
  initialUsers,
  apiClient,
  onRefresh,
}: PermissionModalProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const { close } = useModal()

  const [permissions, setPermissions] = useState<FilePermission[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [grantUserId, setGrantUserId] = useState("")
  const [grantLevel, setGrantLevel] = useState<"viewer" | "collaborator">("viewer")
  const [initialized, setInitialized] = useState(false)

  // true = public, false = private, "mixed" = mixed selection, null = not known yet.
  const [visibility, setVisibility] = useState<boolean | "mixed" | null>(initialVisibility ?? null)

  // Normalise the props: work with a list of ids whether it's one file or many.
  const idsToManage = useMemo(() => fileIds ?? (fileId ? [fileId] : []), [fileIds, fileId])
  const displayName = useMemo(
    () => fileName ?? `${idsToManage.length} file(s)`,
    [fileName, idsToManage.length]
  )

  /**
   * Loads the permission lists of every target file and merges them by user,
   * so a user granted access on several files appears only once.
   */
  const loadPerms = useCallback(async () => {
    setLoadingPerms(true)
    const results = await Promise.all(idsToManage.map((id) => apiClient.listFilePerms(id)))
    const merged = new Map<number, FilePermission>()
    for (const result of results) {
      if (!result.success) continue
      for (const perm of result.data?.data ?? []) {
        if (!merged.has(perm.user_id)) merged.set(perm.user_id, perm)
      }
    }
    setPermissions(Array.from(merged.values()))
    setLoadingPerms(false)
  }, [idsToManage, apiClient])

  // Lazy init: fetch the user list for the grant selector, then the permissions.
  const initialize = useCallback(async () => {
    if (initialized) return
    setInitialized(true)
    if (!canManage) return

    if (initialUsers && initialUsers.length > 0) {
      setUsers(initialUsers)
    } else {
      const usersResult = await apiClient.getUsers({ limit: 200 })
      if (usersResult.success) {
        setUsers(usersResult.data.data?.items ?? [])
      }
    }

    await loadPerms()
  }, [initialized, canManage, initialUsers, apiClient, loadPerms])

  if (!initialized) {
    initialize()
  }

  // Grant the selected access level to the chosen user on every target file.
  const handleGrant = useCallback(async () => {
    if (!grantUserId || idsToManage.length === 0) return
    const userId = Number(grantUserId)
    if (Number.isNaN(userId)) return

    let successCount = 0
    let failCount = 0

    for (const id of idsToManage) {
      const result = await apiClient.grantFilePerms(id, {
        user_id: userId,
        access_level: grantLevel,
      })
      if (result.success) {
        successCount++
      } else {
        failCount++
      }
    }

    if (successCount > 0) {
      toast({
        type: "success",
        title: t("download.toast.permGranted"),
        description: t("download.toast.permGrantedDesc", { level: grantLevel }),
        duration: 3000,
      })
    }
    if (failCount > 0) {
      toast({
        type: "error",
        title: t("download.toast.permListError"),
        description: t("download.toast.operationFailed", { count: failCount }),
        duration: 4000,
      })
    }

    setGrantUserId("")
    await loadPerms()
    onRefresh()
  }, [idsToManage, grantUserId, grantLevel, apiClient, toast, t, onRefresh, loadPerms])

  // Revoke the given user's access on every target file.
  const handleRevoke = useCallback(
    async (userId: number) => {
      let successCount = 0
      let failCount = 0

      for (const id of idsToManage) {
        const result = await apiClient.revokeFilePerm(id, userId)
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      }

      if (successCount > 0) {
        setPermissions((prev) => prev.filter((p) => p.user_id !== userId))
        toast({
          type: "success",
          title: t("download.toast.permRevoked"),
          description: t("download.toast.permRevokedDesc"),
          duration: 3000,
        })
      }
      if (failCount > 0) {
        toast({
          type: "error",
          title: t("download.toast.permListError"),
          description: t("download.toast.operationFailed", { count: failCount }),
          duration: 4000,
        })
      }
      onRefresh()
    },
    [idsToManage, apiClient, toast, t, onRefresh]
  )

  // Set the same visibility on every target file and update the local state.
  const handleBulkVisibility = useCallback(
    async (target: boolean) => {
      let successCount = 0
      let failCount = 0

      for (const id of idsToManage) {
        const result = await apiClient.toggleFilePublic(id, target)
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      }

      if (successCount > 0) {
        setVisibility(target)
        toast({
          type: "success",
          title: target ? t("download.toast.madePublic") : t("download.toast.madePrivate"),
          description: t("download.visibility.appliedTo", { count: successCount }),
          duration: 3000,
        })
      }
      if (failCount > 0) {
        toast({
          type: "error",
          title: t("download.toast.fetchError"),
          description: t("download.toast.operationFailed", { count: failCount }),
          duration: 4000,
        })
      }
      onRefresh()
    },
    [idsToManage, apiClient, toast, t, onRefresh]
  )

  // Shared styles for the visibility toggle buttons.
  const btnBase =
    "flex h-10 w-full flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 font-body text-sm font-semibold transition-all sm:w-auto"
  const btnActive = "border-ui-primary bg-ui-primary text-white dark:text-ui-base"
  const btnInactive =
    "border-ui-border bg-ui-front text-ui-text hover:border-ui-primary hover:text-ui-primary"

  return (
    // Cap the modal height and let the inner scroll area collapse properly (flex min-h-0).
    // The modal opens with `paddingless`, so the shell only pads vertically and
    // this modal owns the horizontal padding (per section) — the scrollbar
    // sits flush against the modal edge.
    <div className="flex max-h-[65vh] min-h-0 w-full flex-col overflow-hidden">
      {/* Fixed header: shrink-0 keeps it from collapsing while the body scrolls.
          Padded wrapper keeps the divider line aligned with the content. */}
      <div className="shrink-0 px-8">
        <div className="flex items-center gap-4 border-b border-ui-border pb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-ui-border bg-ui-base shadow-sm">
            <FaLock className="text-xl text-ui-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-xl font-bold text-ui-text">
              {t("download.permissions.title")}
            </h3>
            <p
              className="truncate font-body text-sm font-medium text-ui-text-muted"
              title={displayName}
            >
              {displayName}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable body: flex-1 + min-h-0 make this the only scrolling region.
          Own x-padding keeps content inset while the scrollbar touches the edge. */}
      <div className="min-h-0 flex-1 overflow-y-auto py-4 pl-8 pr-8 scrollbar scrollbar-rounded scrollbar-thin sm:pr-5">
        {!canManage ? (
          // Viewer-only caller: grant/revoke/visibility all require collaborator
          // level on the target files, so show a notice instead of dead controls.
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="rounded-full border border-ui-border bg-ui-base p-4 shadow-sm">
              <FaLock className="text-2xl text-ui-text-muted" />
            </div>
            <p className="max-w-xs font-body text-sm font-medium text-ui-text-muted">
              {t("download.permissions.noPermission")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Grant access section */}
            <div className="flex w-full flex-col gap-3">
              <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-ui-text-muted">
                {t("download.permissions.grantTitle")}
              </h4>
              <div className="flex flex-col gap-3">
                <div className="w-full">
                  <Select
                    value={grantUserId}
                    placeholder={t("download.permissions.selectUser")}
                    options={users.map((u) => ({ value: String(u.id), label: u.username }))}
                    onChange={(v) => setGrantUserId(v)}
                    className="w-full"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <Select
                      value={grantLevel}
                      options={[
                        { value: "viewer", label: t("download.permissions.viewer") },
                        { value: "collaborator", label: t("download.permissions.collaborator") },
                      ]}
                      onChange={(v) => setGrantLevel(v as "viewer" | "collaborator")}
                      className="w-full"
                    />
                  </div>
                  <button
                    onClick={handleGrant}
                    disabled={!grantUserId}
                    className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-ui-primary px-5 font-body text-sm font-semibold text-white transition-all hover:bg-ui-primary-hover disabled:pointer-events-none disabled:opacity-50 sm:w-auto dark:text-ui-base"
                  >
                    <FaUserPlus />
                    {t("download.permissions.grantButton")}
                  </button>
                </div>
              </div>
            </div>

            <hr className="border-t border-ui-border" />

            {/* Bulk visibility section */}
            <div className="flex w-full flex-col gap-3">
              <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-ui-text-muted">
                {t("download.visibility.title")}
              </h4>
              <div className="flex flex-row gap-3">
                <button
                  onClick={() => handleBulkVisibility(true)}
                  title={t("download.visibility.appliedTo", { count: idsToManage.length })}
                  className={`${btnBase} ${visibility === true ? btnActive : btnInactive}`}
                >
                  <FaGlobe />
                  {t("download.actions.makePublic")}
                </button>
                <button
                  onClick={() => handleBulkVisibility(false)}
                  title={t("download.visibility.appliedTo", { count: idsToManage.length })}
                  className={`${btnBase} ${visibility === false ? btnActive : btnInactive}`}
                >
                  <FaLock />
                  {t("download.actions.makePrivate")}
                </button>
              </div>
            </div>

            <hr className="border-t border-ui-border" />

            {/* Current permissions list */}
            <div className="flex w-full flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-ui-text-muted">
                  {t("download.permissions.currentPerms")}
                </h4>
                {/* Hint shown only when a batch revoke affects several files */}
                {idsToManage.length > 1 && (
                  <p className="font-body text-xs font-medium text-ui-text-muted">
                    {t("download.permissions.multiRevokeHint")}
                  </p>
                )}
              </div>

              <div className="min-h-[140px] rounded-2xl border border-ui-border bg-ui-front p-2">
                {loadingPerms ? (
                  <div className="flex h-[120px] items-center justify-center">
                    <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ui-border border-t-ui-primary shadow-sm" />
                  </div>
                ) : permissions.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 py-8">
                    <div className="rounded-full border border-ui-border bg-ui-base p-3 shadow-sm">
                      <FaLock className="text-xl text-ui-primary" />
                    </div>
                    <p className="font-body text-sm font-medium text-ui-text-muted">
                      {t("download.permissions.noPerms")}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 px-1">
                    {permissions.map((p) => (
                      <div
                        key={p.user_id}
                        className="group flex items-center justify-between rounded-xl border border-transparent p-2 transition-all hover:border-ui-border hover:bg-ui-base hover:shadow-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-base font-heading text-sm font-bold text-ui-primary shadow-sm">
                            {(p.username ?? `User #${p.user_id}`).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-heading text-sm font-bold text-ui-text">
                              {p.username ?? `User #${p.user_id}`}
                            </p>
                            <p className="font-body text-xs font-medium text-ui-text-muted">
                              {p.access_level === "collaborator"
                                ? t("download.permissions.collaborator")
                                : t("download.permissions.viewer")}
                            </p>
                          </div>
                        </div>
                        {/* Revoke access for this user (desktop: revealed on hover) */}
                        <button
                          onClick={() => handleRevoke(p.user_id)}
                          className="rounded-full p-2 text-ui-text-muted transition-all hover:bg-ui-front hover:text-red-500 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          title={t("download.permissions.revokeButton")}
                        >
                          <FaUserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed footer */}
      <div className="shrink-0 px-8">
        <div className="mt-2 border-t border-ui-border pt-4">
          <button
            onClick={close}
            className="flex h-10 w-full items-center justify-center rounded-full border-2 border-ui-border bg-ui-front px-4 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary"
          >
            {t("users.cancel")}
          </button>
        </div>
      </div>
    </div>
  )
}
