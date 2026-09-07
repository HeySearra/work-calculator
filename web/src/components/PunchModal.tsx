import { useState } from 'react'
import { Modal } from './Modal'
import { useStore } from '../store'

export function PunchModal({ date, onClose }: { date: string; onClose: () => void }) {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)
  const existing = S.punches[date]
  const [leave, setLeave] = useState(existing?.leave ? 1 : 0)
  const [inT, setInT] = useState(existing?.in || S.profile.workStart)
  const [outT, setOutT] = useState(existing?.out || S.profile.workEnd)
  const [note, setNote] = useState(existing?.note || '')

  async function save() {
    await commit((d) => {
      if (leave) d.punches[date] = { in: '', out: '', leave: 1, note }
      else d.punches[date] = { in: inT, out: outT, leave: 0, note }
    })
    onClose()
  }
  async function del() {
    await commit((d) => {
      delete d.punches[date]
    })
    onClose()
  }

  return (
    <Modal
      title={`打卡 · ${date}`}
      onClose={onClose}
      footer={
        <>
          {existing && (
            <button className="btn danger" onClick={del}>删除</button>
          )}
          <button className="btn primary" onClick={save}>保存</button>
        </>
      }
    >
      <div className="field">
        <label>状态</label>
        <select value={leave ? '1' : '0'} onChange={(e) => setLeave(Number(e.target.value))}>
          <option value="0">正常上下班</option>
          <option value="1">请假 / 没上班</option>
        </select>
      </div>
      {!leave && (
        <div className="row">
          <div className="field">
            <label>上班</label>
            <input type="time" value={inT} onChange={(e) => setInT(e.target.value)} />
          </div>
          <div className="field">
            <label>下班</label>
            <input type="time" value={outT} onChange={(e) => setOutT(e.target.value)} />
          </div>
        </div>
      )}
      <div className="field">
        <label>备注</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
      </div>
    </Modal>
  )
}
