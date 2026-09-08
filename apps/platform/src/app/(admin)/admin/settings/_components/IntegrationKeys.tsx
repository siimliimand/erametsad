import { IntegrationKeyCard } from './IntegrationKeyCard'
import { integrationKeyDefinitions } from './integration-keys'

/**
 * Integrations section (demo 13-settings): env-backed key cards with a
 * masked default display, an audited reveal action and status dots. This
 * server component reads only key PRESENCE from the environment; raw
 * values never reach the client except through the audited
 * settings.key_reveal action.
 */
export function IntegrationKeys() {
  return (
    <div className="px-md py-sm">
      {integrationKeyDefinitions.map((key) => (
        <IntegrationKeyCard
          key={key.id}
          id={key.id}
          label={key.label}
          envVar={key.envVar}
          description={key.description}
          configured={(process.env[key.envVar] ?? '').trim().length > 0}
        />
      ))}
      <p className="pt-sm text-label text-inkMuted">
        Iga võtme paljastamine logitakse auditilogisse (settings.key_reveal). Väärtused pärinevad
        keskkonnamuutujatest ega ole siin salvestatavad.
      </p>
    </div>
  )
}
