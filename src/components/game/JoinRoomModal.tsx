import type { FormEvent } from 'react'

interface JoinRoomModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (roomId: string) => void
}

function JoinRoomModal({ open, onClose, onConfirm }: JoinRoomModalProps) {
  if (!open) {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const roomId = String(form.get('roomId') ?? '').trim()
    if (roomId) {
      onConfirm(roomId)
    }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <section className="modal join-modal" onClick={(e) => e.stopPropagation()}>
        <h2>加入房间</h2>
        <p className="helper">请输入房间号加入对战（本地模拟）。</p>
        <form onSubmit={handleSubmit}>
          <input
            name="roomId"
            type="text"
            placeholder="输入房间号"
            className="room-input"
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn primary">
              加入
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default JoinRoomModal
