import { useSyncExternalStore } from 'react'
import { notifyState, subscribeNotify } from '../lib/notifications'

export function useNotifyState() {
  return useSyncExternalStore(subscribeNotify, notifyState)
}
