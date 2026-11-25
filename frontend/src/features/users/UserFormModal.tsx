import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import type { AuthUser, RoleSummary } from '@/auth/authApi'
import { FormModal } from '@/components/ui/FormModal'
import { createUser, updateUser } from '@/features/users/usersApi'

interface UserFormModalProps {
  open: boolean
  user: AuthUser | null
  roles: RoleSummary[]
  onClose: () => void
  onSaved: () => void
}

export function UserFormModal({ open, user, roles, onClose, onSaved }: UserFormModalProps) {
  const { t } = useTranslation()
  const isEdit = Boolean(user)
  const [serverError, setServerError] = useState<string | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<number[]>([])

  const schema = useMemo(
    () =>
      z.object({
        username: z.string().min(3, t('users.validationUsername')),
        email: z.string().email(t('users.validationEmail')),
        password: isEdit
          ? z.string().optional()
          : z.string().min(8, t('auth.validationMinPassword')),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        full_name_km: z.string().optional(),
        phone: z.string().optional(),
        is_active: z.boolean(),
      }),
    [isEdit, t]
  )

  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      full_name_km: '',
      phone: '',
      is_active: true,
    },
  })

  useEffect(() => {
    if (!open) return
    setServerError(null)
    if (user) {
      reset({
        username: user.username,
        email: user.email,
        password: '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        full_name_km: user.full_name_km || '',
        phone: user.phone || '',
        is_active: user.is_active,
      })
      setSelectedRoles(user.roles.map((r) => r.id))
    } else {
      reset({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        full_name_km: '',
        phone: '',
        is_active: true,
      })
      setSelectedRoles([])
    }
  }, [open, reset, user])

  const toggleRole = (roleId: number) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    )
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      if (user) {
        await updateUser(user.id, {
          username: values.username,
          email: values.email,
          first_name: values.first_name,
          last_name: values.last_name,
          full_name_km: values.full_name_km,
          phone: values.phone,
          is_active: values.is_active,
          role_ids: selectedRoles,
        })
      } else {
        await createUser({
          username: values.username,
          email: values.email,
          password: values.password || '',
          first_name: values.first_name,
          last_name: values.last_name,
          full_name_km: values.full_name_km,
          phone: values.phone,
          is_active: values.is_active,
          role_ids: selectedRoles,
        })
      }
      onSaved()
    } catch (err) {
      setServerError(extractApiErrorMessage(err))
    }
  }

  return (
    <FormModal
      open={open}
      size="lg"
      title={isEdit ? t('users.editUser') : t('users.createUser')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-label-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="user-form"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('common.loading') : t('common.save')}
          </button>
        </>
      }
    >
      {serverError && (
        <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
          {serverError}
        </div>
      )}

      <form id="user-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">{t('users.username')} *</label>
            <input
              type="text"
              className={`form-control ${errors.username ? 'is-invalid' : ''}`}
              {...register('username')}
            />
            {errors.username && <div className="invalid-feedback">{errors.username.message}</div>}
          </div>

          <div className="col-md-6">
            <label className="form-label">{t('users.email')} *</label>
            <input
              type="email"
              className={`form-control ${errors.email ? 'is-invalid' : ''}`}
              {...register('email')}
            />
            {errors.email && <div className="invalid-feedback">{errors.email.message}</div>}
          </div>

          {!isEdit && (
            <div className="col-12">
              <label className="form-label">{t('auth.password')} *</label>
              <input
                type="password"
                className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                {...register('password')}
              />
              {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
            </div>
          )}

          <div className="col-md-6">
            <label className="form-label">{t('users.firstName')}</label>
            <input type="text" className="form-control" {...register('first_name')} />
          </div>

          <div className="col-md-6">
            <label className="form-label">{t('users.lastName')}</label>
            <input type="text" className="form-control" {...register('last_name')} />
          </div>

          <div className="col-md-6">
            <label className="form-label">{t('users.fullNameKm')}</label>
            <input type="text" className="form-control" {...register('full_name_km')} />
          </div>

          <div className="col-md-6">
            <label className="form-label">{t('users.phone')}</label>
            <input type="text" className="form-control" {...register('phone')} />
          </div>

          <div className="col-12">
            <div className="form-check form-switch">
              <input
                id="user-active-switch"
                className="form-check-input"
                type="checkbox"
                {...register('is_active')}
              />
              <label className="form-check-label" htmlFor="user-active-switch">
                {t('users.accountActive')}
              </label>
            </div>
          </div>

          <div className="col-12">
            <label className="form-label">{t('users.assignRoles')}</label>
            <div className="row g-2 p-3 rounded border" style={{ borderColor: 'var(--vx-border)' }}>
              {roles.map((role) => (
                <div key={role.id} className="col-sm-6">
                  <div className="form-check">
                    <input
                      id={`user-role-${role.id}`}
                      type="checkbox"
                      className="form-check-input"
                      checked={selectedRoles.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    <label className="form-check-label small" htmlFor={`user-role-${role.id}`}>
                      {role.name}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>
    </FormModal>
  )
}
