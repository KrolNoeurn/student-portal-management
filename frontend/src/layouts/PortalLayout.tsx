import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchBootstrapConfig } from '@/api/systemApi'
import { useThemeLayout } from '@/contexts/ThemeLayoutContext'
import { HorizontalLayout } from '@/layouts/HorizontalLayout'
import { VerticalLayout } from '@/layouts/VerticalLayout'

export function PortalLayout() {
  const { t, i18n } = useTranslation()
  const { layout } = useThemeLayout()

  const { data: bootstrap } = useQuery({
    queryKey: ['system-bootstrap'],
    queryFn: fetchBootstrapConfig,
  })

  const brandShort = bootstrap?.institution.short_name || t('app.shortName')
  const brandFull =
    i18n.language === 'km'
      ? bootstrap?.institution.name_km || t('app.fullName')
      : bootstrap?.institution.name_en || t('app.fullName')

  const content = <Outlet />

  if (layout === 'horizontal') {
    return (
      <HorizontalLayout brandShort={brandShort} brandFull={brandFull}>
        {content}
      </HorizontalLayout>
    )
  }

  return (
    <VerticalLayout brandShort={brandShort} brandFull={brandFull}>
      {content}
    </VerticalLayout>
  )
}
