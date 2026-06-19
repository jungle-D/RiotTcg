import type { ClientMessage, ServerMessage } from '@shared/wsMessages'

type MessageHandler = (message: ServerMessage) => void
type ReconnectHandler = () => void

function wsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

class GameWebSocket {
  private socket: WebSocket | null = null
  private handlers = new Set<MessageHandler>()
  private reconnectHandlers = new Set<ReconnectHandler>()
  private reconnectTimer: number | null = null
  private pendingConnect: Promise<void> | null = null

  connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }
    if (this.pendingConnect) {
      return this.pendingConnect
    }

    this.pendingConnect = new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl())
      this.socket = socket

      socket.onopen = () => {
        this.pendingConnect = null
        if (this.reconnectTimer !== null) {
          window.clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
        for (const handler of this.reconnectHandlers) {
          handler()
        }
        resolve()
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as ServerMessage
          for (const handler of this.handlers) {
            handler(message)
          }
        } catch {
          // ignore malformed messages
        }
      }

      socket.onerror = () => {
        if (this.pendingConnect) {
          this.pendingConnect = null
          reject(new Error('WebSocket connection failed'))
        }
      }

      socket.onclose = () => {
        this.socket = null
        this.pendingConnect = null
        if (this.reconnectTimer === null) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null
            void this.connect()
          }, 1500)
        }
      }
    })

    return this.pendingConnect
  }

  send(message: ClientMessage): void {
    void this.connect().then(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message))
      }
    })
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler)
    void this.connect()
    return () => {
      this.handlers.delete(handler)
    }
  }

  onReconnect(handler: ReconnectHandler): () => void {
    this.reconnectHandlers.add(handler)
    return () => {
      this.reconnectHandlers.delete(handler)
    }
  }
}

export const gameWebSocket = new GameWebSocket()

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}
