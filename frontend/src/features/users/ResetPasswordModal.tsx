import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import type { AuthUser } from '@/auth/authApi'
import { FormModal } from '@/components/ui/FormModal'
import { adminResetPassword } from '@/features/users/usersApi'

interface ResetPasswordModalProps {
  user: AuthUser | null
  onClose: () => void
  onSaved: () => void
}

export function ResetPasswordModal({ user, onClose, onSaved }: ResetPasswordModalProps) {
  const { t } = useTranslation()
  const [serverError, setServerError] = useState<string | null>(null)

  const schema = useMemo(
    () =>
      z.object({
        new_password: z.string().min(8, t('auth.validationMinPassword')),
        must_change_password: z.boolean(),
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
    defaultValues: { new_password: '', must_change_password: true },
  })

  useEffect(() => {
    if (user) {
      setServerError(null)
      reset({ new_password: '', must_change_password: true })
    }
  }, [reset, user])

  const onSubmit = async (values: FormValues) => {
    if (!user) return
    setServerError(null)
    try {
      await adminResetPassword(user.id, values)
      onSaved()
    } catch (err) {
      setServerError(extractApiErrorMessage(err))
    }
  }

  return (
    <FormModal
      open={Boolean(user)}
      title={t('users.resetPasswordTitle', { username: user?.username || '' })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-label-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="reset-password-form"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('common.loading') : t('common.confirm')}
          </button>
        </>
      }
    >
      {serverError && (
        <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
          {serverError}
        </div>
      )}

      <form id="reset-password-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-3">
          <label className="form-label">{t('auth.newPassword')} *</label>
          <input
            type="password"
            className={`form-control ${errors.new_password ? 'is-invalid' : ''}`}
            {...register('new_password')}
          />
          {errors.new_password && (
            <div className="invalid-feedback">{errors.new_password.message}</div>
          )}
        </div>
        <div className="form-check">
          <input
            id="must-change-pw"
            type="checkbox"
            className="form-check-input"
            {...register('must_change_password')}
          />
          <label className="form-check-label small" htmlFor="must-change-pw">
            {t('users.requirePasswordChange')}
          </label>
        </div>
      </form>
    </FormModal>
  )
}
