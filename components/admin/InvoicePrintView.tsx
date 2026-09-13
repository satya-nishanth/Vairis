import { Fragment } from 'react'
import { LOGO_SRC } from '@/lib/logo'
import { formatINRGrouped } from '@/lib/invoice-tax'
import type { InvoicePayload } from '@/lib/invoice-document'
import { totalsFromPayload } from '@/lib/invoice-document'

export function InvoicePrintView({
  number,
  payload,
}: {
  number: string
  payload: InvoicePayload
}) {
  const totals = totalsFromPayload(payload)
  const paid = /paid/i.test(payload.payment.status)

  return (
    <div className="inv-doc">
      <div className="inv-doc__head">
        <div>
          <img src={LOGO_SRC} alt="Vairis" className="inv-doc__logo" />
          <div className="inv-doc__seller">
            {payload.seller.name}
            <br />
            {payload.seller.address}
            <br />
            GSTIN {payload.seller.gstin} · {payload.seller.email} · {payload.seller.phone}
          </div>
        </div>
        <div className="inv-doc__meta">
          <div className="inv-doc__meta-top">
            {paid && <span className="inv-doc__badge">Paid</span>}
            <div className="inv-doc__title">Tax Invoice</div>
          </div>
          <div className="inv-doc__rule" />
          <div className="inv-doc__kv">
            <span>Invoice No.</span>
            <span>{number}</span>
            <span>Invoice Date</span>
            <span>{formatDate(payload.invoiceDate)}</span>
            <span>Place of Supply</span>
            <span>{payload.placeOfSupply}</span>
            <span>HSN</span>
            <span>{totals.hsnCode}</span>
          </div>
        </div>
      </div>

      <div className="inv-doc__parties">
        <div>
          <div className="inv-doc__label">Billed To</div>
          <div className="inv-doc__name">{payload.billedTo.name || '-'}</div>
          <div className="inv-doc__addr">
            {payload.billedTo.lines}
            {payload.billedTo.phone ? `\n${payload.billedTo.phone}` : ''}
          </div>
        </div>
        <div>
          <div className="inv-doc__label">Shipped To</div>
          <div className="inv-doc__name">{payload.shippedTo.name || '-'}</div>
          <div className="inv-doc__addr">{payload.shippedTo.lines}</div>
        </div>
        <div>
          <div className="inv-doc__label">Payment</div>
          <div className="inv-doc__kv inv-doc__kv--left">
            <span>Method</span>
            <span>{payload.payment.method || '-'}</span>
            <span>Reference</span>
            <span>{payload.payment.reference || '-'}</span>
            <span>Received On</span>
            <span>{payload.payment.received ? formatDate(payload.payment.received) : '-'}</span>
            <span>Status</span>
            <span className={paid ? 'inv-doc__gold' : ''}>{payload.payment.status || '-'}</span>
          </div>
        </div>
      </div>

      <table className="inv-doc__table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Weights</th>
            <th>Making + Wastage</th>
            <th>Qty</th>
            <th>Item Value</th>
            <th>Tax</th>
            <th>Taxable Amount</th>
          </tr>
        </thead>
        <tbody>
          {totals.lines.map((line, i) => (
            <tr key={i} className="inv-doc__row">
              <td>
                <div className="inv-doc__item-name">
                  {line.productName || 'Untitled'}
                  <span className={line.withExchange ? 'inv-doc__chip' : 'inv-doc__chip inv-doc__chip--mute'}>
                    {line.withExchange ? 'Exchange opted' : 'No exchange'}
                  </span>
                </div>
                <div className="inv-doc__muted">
                  {[
                    line.sku
                      ? `SKU: ${line.sku}`
                      : line.itemCode
                        ? `SKU: ${line.itemCode}`
                        : '',
                    line.metalLabel,
                    line.huid ? `HUID: ${line.huid}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {line.certs ? <div>Certificate No: {line.certs}</div> : null}
                </div>
                <div className="inv-doc__break">
                  {line.stones.map((s, si) => (
                    <Fragment key={si}>
                      <span>
                        {s.label} · {Number(s.caratWeight).toFixed(2)} ct @ ₹{formatINRGrouped(s.ratePerCarat, 0)}{' '}
                        <em className={s.exchange ? 'inv-doc__gold' : ''}>{s.exchange ? 'exch.' : 'std.'}</em>
                      </span>
                      <span className="inv-doc__amt">{formatINRGrouped(s.value, 0)}</span>
                    </Fragment>
                  ))}
                  <span>
                    Gold · {Number(line.weightGrams).toFixed(3)} g @ ₹{formatINRGrouped(line.goldRatePerGram, 0)}
                  </span>
                  <span className="inv-doc__amt">{formatINRGrouped(line.goldValue, 0)}</span>
                </div>
              </td>
              <td>
                {line.stones.reduce((s, x) => s + Number(x.caratWeight), 0).toFixed(2)} ct
                <div className="inv-doc__muted">{Number(line.weightGrams).toFixed(3)} g</div>
              </td>
              <td>
                {formatINRGrouped(line.makingPlusWastage, 0)}
                <div className="inv-doc__muted">
                  {formatINRGrouped(line.making, 0)} + {formatINRGrouped(line.wastage, 0)}
                </div>
              </td>
              <td>{line.quantity}</td>
              <td>{formatINRGrouped(line.itemValue, 0)}</td>
              <td>{totals.igstRateLabel}</td>
              <td className="inv-doc__strong">{formatINRGrouped(line.taxable)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-doc__foot">
        <div>
          <div className="inv-doc__label">Amount in Words</div>
          <div className="inv-doc__words">{totals.amountInWords}</div>
          <div className="inv-doc__notes">
            <div>
              <div className="inv-doc__label">Exchange & Rate Basis</div>
              <p>{payload.notes.exchange}</p>
            </div>
            <div>
              <div className="inv-doc__label">Certification</div>
              <p>{payload.notes.certification}</p>
            </div>
          </div>
          <div className="inv-doc__label">Returns & Exchange</div>
          <p className="inv-doc__note">{payload.notes.returns}</p>
        </div>
        <div className="inv-doc__totals">
          <div>
            <span>Taxable Value</span>
            <span>{formatINRGrouped(totals.taxable)}</span>
          </div>
          {totals.intraState ? (
            <>
              <div>
                <span>CGST @ {totals.cgstRateLabel}</span>
                <span>{formatINRGrouped(totals.cgst)}</span>
              </div>
              <div>
                <span>SGST @ {totals.cgstRateLabel}</span>
                <span>{formatINRGrouped(totals.sgst)}</span>
              </div>
              <div className="inv-doc__muted-row">
                <span>IGST @ {totals.igstRateLabel}</span>
                <span>-</span>
              </div>
            </>
          ) : (
            <>
              <div className="inv-doc__muted-row">
                <span>CGST @ {totals.cgstRateLabel}</span>
                <span>-</span>
              </div>
              <div className="inv-doc__muted-row">
                <span>SGST @ {totals.cgstRateLabel}</span>
                <span>-</span>
              </div>
              <div>
                <span>IGST @ {totals.igstRateLabel}</span>
                <span>{formatINRGrouped(totals.igst)}</span>
              </div>
            </>
          )}
          <div className="inv-doc__round">
            <span>Round Off</span>
            <span>
              {totals.roundOff < 0 ? `(${formatINRGrouped(Math.abs(totals.roundOff))})` : formatINRGrouped(totals.roundOff)}
            </span>
          </div>
          {totals.discount > 0 ? (
            <div className="inv-doc__round">
              <span>Discount</span>
              <span>({formatINRGrouped(totals.discount)})</span>
            </div>
          ) : null}
          <div className="inv-doc__payable">
            <span>Total Payable</span>
            <strong>₹{formatINRGrouped(totals.grandTotal, 0)}</strong>
          </div>
          <div className="inv-doc__sign">
            For {payload.seller.name.replace(/Private Limited/i, 'Pvt Ltd')}
            <br />
            <span>Authorised Signatory</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
