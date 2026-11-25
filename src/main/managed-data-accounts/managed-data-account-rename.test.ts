import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeSecureFile } from '../../shared/secure-storage/secure-file'
import { ManagedDataAccountService } from './service'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-account-rename-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function savedProfile(): { id: string; metadataPath: string } {
  const id = randomUUID()
  mkdirSync(join(root, 'devin', id), { recursive: true })
  const metadataPath = join(root, 'devin', 'accounts.json')
  const state = {
    accounts: [{ id, label: 'Old', integrations: ['github'], createdAt: 1 }],
    activeAccountId: id
  }
  expect(writeSecureFile(metadataPath, JSON.stringify(state), { durable: true })).toBe(true)
  return { id, metadataPath }
}

describe('managed data account rename', () => {
  it('persists the trimmed label and keeps everything else', async () => {
    const { id, metadataPath } = savedProfile()
    const service = new ManagedDataAccountService(root)

    await service.rename('devin', id.toUpperCase(), '  Work  ')

    expect(JSON.parse(readFileSync(metadataPath, 'utf8'))).toEqual({
      accounts: [{ id, label: 'Work', integrations: ['github'], createdAt: 1 }],
      activeAccountId: id
    })
  })

  it('refuses a blank or too-long label and an unknown account', async () => {
    const { id } = savedProfile()
    const service = new ManagedDataAccountService(root)

    await expect(service.rename('devin', id, '   ')).rejects.toThrow()
    await expect(service.rename('devin', id, 'x'.repeat(121))).rejects.toThrow()
    await expect(service.rename('devin', randomUUID(), 'Work')).rejects.toThrow()
    expect(service.list('devin').accounts[0].label).toBe('Old')
  })
})
