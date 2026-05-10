import React from 'react'
import type { RichComponent as RichComponentModel } from '../types'

interface RichComponentViewProps {
  component: RichComponentModel
}

/** Render tối thiểu khớp vanilla messages.js (table, product_grid; bar_chart = gợi ý). */
export const RichComponentView: React.FC<RichComponentViewProps> = ({ component }) => {
  const { type, data } = component

  if (type === 'table' && data && typeof data === 'object' && 'columns' in data && 'rows' in data) {
    const d = data as { columns: string[]; rows: (string | number)[][] }
    return (
      <div style={{ overflowX: 'auto', marginTop: '8px', fontSize: '11px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {d.columns.map((c) => (
                <th
                  key={c}
                  style={{
                    border: '1px solid #e2e8f0',
                    padding: '6px',
                    textAlign: 'left',
                    background: '#f8fafc',
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={{ border: '1px solid #e2e8f0', padding: '6px' }}>
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (type === 'product_grid' && Array.isArray(data)) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: '8px',
          marginTop: '8px',
          fontSize: '11px',
        }}
      >
        {(data as { name?: string; image_url?: string; price?: string }[]).map((p, i) => (
          <div
            key={i}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '6px',
              background: '#fff',
            }}
          >
            {p.image_url ? (
              <img src={p.image_url} alt="" style={{ width: '100%', borderRadius: '6px', marginBottom: '4px' }} />
            ) : null}
            <div style={{ fontWeight: 500 }}>{p.name}</div>
            {p.price ? <div style={{ color: '#64748b' }}>{p.price}</div> : null}
          </div>
        ))}
      </div>
    )
  }

  if (type === 'bar_chart' && data && typeof data === 'object') {
    const d = data as { label?: string; labels?: string[]; values?: number[] }
    const labels = d.labels || []
    const values = d.values || []
    const max = Math.max(...values, 1)
    return (
      <div style={{ marginTop: '8px', fontSize: '10px', color: '#64748b' }}>
        {d.label ? <div style={{ marginBottom: '4px' }}>{d.label}</div> : null}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '72px' }}>
          {labels.map((lbl, i) => {
            const h = Math.round(((values[i] || 0) / max) * 56)
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  style={{
                    height: `${h}px`,
                    background: '#94a3b8',
                    borderRadius: '4px 4px 0 0',
                    minHeight: '4px',
                  }}
                />
                <div style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {String(lbl).slice(0, 6)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return null
}
