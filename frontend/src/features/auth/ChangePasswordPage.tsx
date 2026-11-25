import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage, setAccessToken } from '@/api/client'
import { changePasswordApi } from '@/auth/authApi'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/contexts/ToastContext'

export function ChangePasswordPage() {
  const { t } = useTranslation()
  const { refreshSessionUser } = useAuth()
  const { showToast } = useToast()
  const [serverError, setServerError] = useState<string | null>(null)

  const schema = useMemo(
    () =>
      z
        .object({
          current_password: z.string().min(1, t('auth.validationCurrentPassword')),
          new_password: z.string().min(8, t('auth.validationMinPassword')),
          confirm_password: z.string().min(1, t('auth.validationConfirmPassword')),
        })
        .refine((vals) => vals.new_password === vals.confirm_password, {
          path: ['confirm_password'],
          message: t('auth.validationPasswordMismatch'),
        }),
    [t]
  )

  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      const res = await changePasswordApi(values)
      setAccessToken(res.access)
      await refreshSessionUser()
      reset()
      showToast(t('auth.passwordChangedSuccess'), 'success')
    } catch (err) {
      setServerError(extractApiErrorMessage(err, t('auth.passwordChangeFailed')))
    }
  }

  return (
    <div>
      <PageHeader
        title={t('toolbar.changePassword')}
        subtitle={t('auth.changePasswordSubtitle')}
        breadcrumbs={[
          { label: t('foundation.breadcrumbHome'), to: '/' },
          { label: t('toolbar.changePassword') },
        ]}
      />

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-body">
          {serverError && (
            <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-3">
              <label htmlFor="cp-current" className="form-label">
                {t('auth.currentPassword')}
              </label>
              <input
                id="cp-current"
                type="password"
                className={`form-control ${errors.current_password ? 'is-invalid' : ''}`}
                {...register('current_password')}
              />
              {errors.current_password && (
                <div className="invalid-feedback">{errors.current_password.message}</div>
              )}
            </div>

            <div className="mb-3">
              <label htmlFor="cp-new" className="form-label">
                {t('auth.newPassword')}
              </label>
              <input
                id="cp-new"
                type="password"
                className={`form-control ${errors.new_password ? 'is-invalid' : ''}`}
                {...register('new_password')}
              />
              {errors.new_password && (
                <div className="invalid-feedback">{errors.new_password.message}</div>
              )}
            </div>

            <div className="mb-4">
              <label htmlFor="cp-confirm" className="form-label">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="cp-confirm"
                type="password"
                className={`form-control ${errors.confirm_password ? 'is-invalid' : ''}`}
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <div className="invalid-feedback">{errors.confirm_password.message}</div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              disabled={isSubmitting}
            >
              <KeyRound size={16} />
              <span>{t('common.save')}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
