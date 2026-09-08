// User detail tab ids and Estonian labels, shared by the detail page
// (first five, URL-driven) and the list drawer (all seven).
export const USER_TAB_IDS = [
  'identiteet',
  'profiilid',
  'oigused',
  'lepingud',
  'pakkumised',
  'teavitused',
  'gdpr',
] as const

export type UserTabId = (typeof USER_TAB_IDS)[number]

// GDPR has no data payload until task 8.5 wires the real tools.
export type DataTabId = Exclude<UserTabId, 'gdpr'>

export const userTabLabels: Record<UserTabId, string> = {
  identiteet: 'Identiteet',
  profiilid: 'Profiilid',
  oigused: 'Õigused',
  lepingud: 'Lepingud',
  pakkumised: 'Pakkumised',
  teavitused: 'Teavitused',
  gdpr: 'GDPR',
}

export const USER_TABS: readonly { id: UserTabId; label: string }[] = USER_TAB_IDS.map((id) => ({
  id,
  label: userTabLabels[id],
}))

export const DEFAULT_USER_TAB: { id: UserTabId; label: string } = {
  id: 'identiteet',
  label: userTabLabels.identiteet,
}
