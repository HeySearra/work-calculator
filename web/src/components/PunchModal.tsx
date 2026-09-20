import { useState } from 'react'
import { Modal } from './Modal'
import { useStore } from '../store'
import { todayKey } from '../format'

export function PunchModal({ date, onClose }: { date: string; onClose: () => void }) {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)
  const existing = S.punches[date]
  const isToday = date === todayKey()
  // 当天的「下班」默认填当前时间（而非规定下班时间）；历史日期仍用规定下班时间
  // 时间统一按 5 分钟取整（与 picker 的 step=300 一致）
  const nowHM = (() => {
    const n = new Date()
    const t = Math.round((n.getHours() * 60 + n.getMinutes()) / 5) * 5
    return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  })()
  const [leave, setLeave] = useState(existing?.leave ? 1 : 0)
  const [inT, setInT] = useState(existing?.in || S.profile.workStart)
  const [outT, setOutT] = useState(existing?.out || (isToday ? nowHM : S.profile.workEnd))
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
            <input type="time" step={300} value={inT} onChange={(e) => setInT(e.target.value)} />
          </div>
          <div className="field">
            <label>下班</label>
            <input type="time" step={300} value={outT} onChange={(e) => setOutT(e.target.value)} />
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
