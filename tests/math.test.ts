import { describe, it, expect } from 'vitest'
import { clamp, average } from '../src/utils/math'

describe('utils/math', () => {
  it('clamp basic', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it('clamp invalid range throws', () => {
    expect(() => clamp(1, 5, 2)).toThrow()
  })

  it('average empty is 0', () => {
    expect(average([])).toBe(0)
  })

  it('average numbers', () => {
    expect(average([1, 2, 3])).toBe(2)
  })
})



