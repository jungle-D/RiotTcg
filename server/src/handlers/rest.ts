import express from 'express'
import type { DeckSnapshot } from '../../shared/roomTypes.js'
import type { PublishPayload } from '../../shared/wsMessages.js'
import { broadcastRoomUpdate, broadcastSyncUpdate } from '../wsHub.js'
import * as roomStore from '../roomStore.js'
import * as syncStore from '../syncStore.js'

export function createRestRouter(): express.Router {
  const router = express.Router()
  router.use(express.json({ limit: '2mb' }))

  router.post('/rooms', (req, res) => {
    const { roomId, hostDeck, hostClientId } = req.body as {
      roomId?: string
      hostDeck?: DeckSnapshot
      hostClientId?: string
    }
    if (!roomId || !hostDeck || !hostClientId) {
      res.status(400).json({ error: 'missing_fields' })
      return
    }
    const room = roomStore.createRoom(roomId, hostDeck, hostClientId)
    if (!room) {
      res.status(409).json({ error: 'room_exists' })
      return
    }
    res.json({ roomId: room.roomId })
  })

  router.post('/rooms/:id/join', (req, res) => {
    const { guestDeck, guestClientId } = req.body as {
      guestDeck?: DeckSnapshot
      guestClientId?: string
    }
    if (!guestDeck || !guestClientId) {
      res.status(400).json({ error: 'missing_fields' })
      return
    }
    const result = roomStore.joinRoom(req.params.id, guestDeck, guestClientId)
    if (!result.ok) {
      const status = result.reason === 'not_found' ? 404 : 409
      res.status(status).json({ error: result.reason })
      return
    }
    broadcastRoomUpdate(result.room)
    res.json({
      role: result.role,
      hostDeck: result.room.hostDeck,
      guestDeck: result.room.guestDeck,
      hostClientId: result.room.hostClientId,
      guestClientId: result.room.guestClientId,
    })
  })

  router.get('/rooms/:id', (req, res) => {
    const room = roomStore.getRoom(req.params.id)
    if (!room) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json(room)
  })

  router.get('/rooms/:id/sync', (req, res) => {
    const sync = syncStore.getSync(req.params.id)
    res.json(sync ?? null)
  })

  router.post('/rooms/:id/publish', (req, res) => {
    const payload = req.body?.payload as PublishPayload | undefined
    if (!payload?.action) {
      res.status(400).json({ error: 'missing_payload' })
      return
    }
    const state = syncStore.publishSync(req.params.id, payload)
    if (!state) {
      res.status(409).json({ error: 'publish_failed' })
      return
    }
    broadcastSyncUpdate(state)
    res.json({ state })
  })

  router.get('/rooms/:id/role/:clientId', (req, res) => {
    const role = roomStore.resolveRole(req.params.id, req.params.clientId)
    if (!role) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ role })
  })

  router.delete('/rooms/:id', (req, res) => {
    roomStore.deleteRoom(req.params.id)
    syncStore.clearSync(req.params.id)
    res.json({ ok: true })
  })

  return router
}
