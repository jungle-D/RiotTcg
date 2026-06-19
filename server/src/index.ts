import http from 'node:http'
import express from 'express'
import { WebSocketServer } from 'ws'
import { createRestRouter } from './handlers/rest.js'
import { handleWsMessage } from './handlers/ws.js'
import { unsubscribeAll } from './wsHub.js'

const PORT = Number(process.env.PORT ?? 3001)

const app = express()
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

app.use('/api', createRestRouter())

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    handleWsMessage(ws, data.toString())
  })
  ws.on('close', () => {
    unsubscribeAll(ws)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`RiotTcg server listening on http://0.0.0.0:${PORT}`)
})
