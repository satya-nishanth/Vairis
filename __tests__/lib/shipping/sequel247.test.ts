import { sequel247Provider } from '@/lib/shipping/sequel247'
import type { ShipmentRequest } from '@/lib/shipping/types'

const originalFetch = global.fetch
const request: ShipmentRequest = {
  orderId: 'order-abc123',
  contactName: 'Surya Teja',
  contactPhone: '9876543210',
  addressLine1: 'Flat 101, Some Building',
  addressLine2: null,
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: '502300',
  declaredValue: 45000,
}

describe('sequel247Provider', () => {
  beforeEach(() => {
    process.env.SEQUEL247_TOKEN = 'test-token'
    process.env.SEQUEL247_BASE_URL = 'https://test.sequel247.com'
    process.env.SEQUEL247_STORE_CODE = 'HYDVFJ'
    delete process.env.SHIPPING_MOCK
  })
  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('has the expected provider name and capability', () => {
    expect(sequel247Provider.name).toBe('sequel247')
    expect(sequel247Provider.supportsBooking).toBe(true)
  })

  it('bookShipment posts to /api/shipment/create and maps the response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'true',
        data: { docketNumber: '0581094993', estimated_delivery: '14-06-2026 20:00' },
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const booking = await sequel247Provider.bookShipment(request)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://test.sequel247.com/api/shipment/create',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.fromStoreCode).toBe('HYDVFJ')
    expect(body.toAddress).toMatchObject({
      consignee_name: 'Surya Teja',
      pinCode: '502300',
      auth_receiver_phone: '9876543210',
    })
    expect(body.net_value).toBe('45000')
    expect(booking).toEqual({
      providerShipmentId: '0581094993',
      courierName: 'Sequel247',
      awbCode: '0581094993',
      trackingUrl: null,
    })
  })

  it('trackShipment posts to /api/track and maps events', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'true',
        data: {
          tracking_events: [
            { description: 'Shipment picked up', location: 'HYDERABAD', date_time: '2026-08-01 12:00:00' },
          ],
        },
      }),
    }) as unknown as typeof fetch

    const events = await sequel247Provider.trackShipment('0581094993')
    expect(events).toHaveLength(1)
    expect(events[0].description).toBe('Shipment picked up')
    expect(events[0].timestamp).toBeInstanceOf(Date)
  })

  it('returns deterministic fixtures when SHIPPING_MOCK=true, no network call', async () => {
    process.env.SHIPPING_MOCK = 'true'
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    const booking = await sequel247Provider.bookShipment(request)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(booking.courierName).toBe('Sequel247 (mock)')
    expect(booking.awbCode).toBeTruthy()
  })
})
