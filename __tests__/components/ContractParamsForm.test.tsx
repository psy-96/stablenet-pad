import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContractParamsForm from '@/components/ContractParamsForm'
import type { TemplateParam } from '@/lib/template-registry'

// address-select fetch mock
beforeEach(() => {
  vi.restoreAllMocks()
})

const textParam: TemplateParam = { key: 'name', label: '이름', type: 'text' }
const uint256Param: TemplateParam = { key: 'supply', label: '발행량', type: 'uint256' }
const addressParam: TemplateParam = { key: 'owner', label: '오너', type: 'address' }

describe('ContractParamsForm — empty params', () => {
  it('renders nothing when params is empty', () => {
    const onChange = vi.fn()
    const { container } = render(<ContractParamsForm params={[]} onChange={onChange} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('ContractParamsForm — text field', () => {
  it('renders label and input', () => {
    const onChange = vi.fn()
    render(<ContractParamsForm params={[textParam]} onChange={onChange} />)
    expect(screen.getByText('이름 *')).toBeDefined()
    expect(screen.getByPlaceholderText('이름')).toBeDefined()
  })

  it('calls onChange(null, false) when empty', async () => {
    const onChange = vi.fn()
    render(<ContractParamsForm params={[textParam]} onChange={onChange} />)
    await waitFor(() => {
      const calls = onChange.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[1]).toBe(false)
    })
  })

  it('calls onChange(params, true) when filled', async () => {
    const onChange = vi.fn()
    render(<ContractParamsForm params={[textParam]} onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('이름'), { target: { value: 'MyToken' } })
    await waitFor(() => {
      const calls = onChange.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[1]).toBe(true)
      expect(lastCall[0]).toEqual({ name: 'MyToken' })
    })
  })
})

describe('ContractParamsForm — uint256 field', () => {
  it('strips non-digit characters', async () => {
    const onChange = vi.fn()
    render(<ContractParamsForm params={[uint256Param]} onChange={onChange} />)
    const input = screen.getByPlaceholderText('숫자 입력')
    fireEvent.change(input, { target: { value: 'abc123def' } })
    expect((input as HTMLInputElement).value).toBe('123')
  })

  it('reports invalid when value is 0', async () => {
    const onChange = vi.fn()
    render(<ContractParamsForm params={[uint256Param]} onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('숫자 입력'), { target: { value: '0' } })
    await waitFor(() => {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
      expect(lastCall[1]).toBe(false)
    })
  })

  it('reports valid when positive integer', async () => {
    const onChange = vi.fn()
    render(<ContractParamsForm params={[uint256Param]} onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('숫자 입력'), { target: { value: '1000' } })
    await waitFor(() => {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
      expect(lastCall[1]).toBe(true)
    })
  })
})

describe('ContractParamsForm — address field', () => {
  it('shows error for invalid address', async () => {
    const onChange = vi.fn()
    render(<ContractParamsForm params={[addressParam]} onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('0x...'), { target: { value: '0x1234' } })
    await waitFor(() => {
      expect(screen.getByText('올바른 주소 형식이 아닙니다 (0x + 40자)')).toBeDefined()
    })
  })

  it('accepts valid 42-char address', async () => {
    const onChange = vi.fn()
    render(<ContractParamsForm params={[addressParam]} onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('0x...'), {
      target: { value: '0x1234567890123456789012345678901234567890' },
    })
    await waitFor(() => {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
      expect(lastCall[1]).toBe(true)
    })
  })
})

describe('ContractParamsForm — address-select field', () => {
  const selectParam: TemplateParam = {
    key: 'token',
    label: '토큰',
    type: 'address-select',
    fetchUrl: '/api/deployments?type=ERC20',
  }

  it('shows warning when fetch returns fewer than 2 options', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          deployments: [
            { contractName: 'TokenA', proxyAddress: '0xaaaa', status: 'success' },
          ],
        }),
      })
    )
    const onChange = vi.fn()
    render(<ContractParamsForm params={[selectParam]} onChange={onChange} />)
    await waitFor(() => {
      expect(screen.getByText(/ERC20 토큰이 최소 2개/)).toBeDefined()
    })
  })

  it('shows error UI when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const onChange = vi.fn()
    render(<ContractParamsForm params={[selectParam]} onChange={onChange} />)
    await waitFor(() => {
      expect(screen.getByText(/불러오지 못했습니다/)).toBeDefined()
    })
  })

  it('renders select with options when 2+ tokens available', async () => {
    const mockDeployments = {
      deployments: [
        { contractName: 'TokenA', proxyAddress: '0x1111111111111111111111111111111111111111', status: 'success' },
        { contractName: 'TokenB', proxyAddress: '0x2222222222222222222222222222222222222222', status: 'success' },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockDeployments })
    )
    const onChange = vi.fn()
    render(<ContractParamsForm params={[selectParam]} onChange={onChange} />)
    await waitFor(() => {
      expect(screen.getByText(/TokenA/)).toBeDefined()
      expect(screen.getByText(/TokenB/)).toBeDefined()
    })
  })
})
