export type NhsRole = 'patient' | 'gp' | 'nhc_provider'
export type NhsNetwork = 'testnet' | 'mainnet'
export type NhsPaymentMode = 'direct' | 'mpp'

const ROLE_KEY = 'nhs_role'
const WALLET_KEY = 'nhs_wallet'
const PATIENT_ID_KEY = 'nhs_patient_id'
const NETWORK_KEY = 'nhs_network'
const PAYMENT_MODE_KEY = 'nhs_payment_mode'

export function getStoredRole(): NhsRole {
  const raw = localStorage.getItem(ROLE_KEY)
  return raw === 'gp' || raw === 'nhc_provider' ? raw : 'patient'
}

export function setStoredRole(role: NhsRole) {
  localStorage.setItem(ROLE_KEY, role)
}

export function getStoredWallet(): string {
  return localStorage.getItem(WALLET_KEY) || ''
}

export function setStoredWallet(wallet: string) {
  localStorage.setItem(WALLET_KEY, wallet)
}

export function getStoredPatientId(): string {
  return localStorage.getItem(PATIENT_ID_KEY) || ''
}

export function setStoredPatientId(patientId: string) {
  localStorage.setItem(PATIENT_ID_KEY, patientId)
}

export function getStoredNetwork(): NhsNetwork {
  const raw = localStorage.getItem(NETWORK_KEY)
  return raw === 'mainnet' ? 'mainnet' : 'testnet'
}

export function setStoredNetwork(network: NhsNetwork) {
  localStorage.setItem(NETWORK_KEY, network)
}

export function getStoredPaymentMode(): NhsPaymentMode {
  const raw = localStorage.getItem(PAYMENT_MODE_KEY)
  if (raw === 'direct') return 'direct'
  return 'mpp'
}

export function setStoredPaymentMode(mode: NhsPaymentMode) {
  localStorage.setItem(PAYMENT_MODE_KEY, mode)
}

export function getAuthHeaders(role: NhsRole, wallet: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-user-role': role,
    'x-wallet-address': wallet,
  }
}

