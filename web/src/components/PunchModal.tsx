import { useState } from 'react'
import { Modal } from './Modal'
import { useStore } from '../store'
import { todayKey } from '../format'

// 把 HH:MM 拆成 小时/分钟（分钟按 5 分钟向下取整，保证只落在 5 的倍数）
function splitTime(v: string): { h: number; m: number } {
  const [hs, ms] = (v || '00:00').split(':')
  const h = Math.max(0, Math.min(23, Number(hs) || 0))
  let m = Math.max(0, Math.min(59, Number(ms) || 0))
  m = Math.floor(m / 5) * 5
  return { h, m }
}

// 自定义时间选择器：小时 + 分钟（5 分钟一档）。原生 time input 的下拉不理会 step 的分钟粒度，故自行实现。
function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { h, m } = splitTime(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <select style={{ flex: 1, minWidth: 0 }} value={String(h)} onChange={(e) => onChange(`${pad(Number(e.target.value))}:${pad(m)}`)}>
        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad(i)}</option>)}
      </select>
      <span style={{ flex: '0 0 auto' }}>:</span>
      <select style={{ flex: 1, minWidth: 0 }} value={String(m)} onChange={(e) => onChange(`${pad(h)}:${pad(Number(e.target.value))}`)}>
        {Array.from({ length: 12 }, (_, i) => i * 5).map((mm) => <option key={mm} value={mm}>{pad(mm)}</option>)}
      </select>
    </div>
  )
}

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
            <TimeSelect value={inT} onChange={setInT} />
          </div>
          <div className="field">
            <label>下班</label>
            <TimeSelect value={outT} onChange={setOutT} />
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
