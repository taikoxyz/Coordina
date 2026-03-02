import keytar from 'keytar'

const SERVICE = 'coordina'

export const setSecret = (account: string, key: string, value: string): Promise<void> =>
  keytar.setPassword(`${SERVICE}:${key}`, account, value)

export const getSecret = (account: string, key: string): Promise<string | null> =>
  keytar.getPassword(`${SERVICE}:${key}`, account)

export const deleteSecret = (account: string, key: string): Promise<boolean> =>
  keytar.deletePassword(`${SERVICE}:${key}`, account)
