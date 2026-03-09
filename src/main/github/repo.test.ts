import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../keychain', () => ({
  getSecret: vi.fn().mockResolvedValue('ghp_test123'),
}))

const mocks = vi.hoisted(() => ({
  repos: {
    createForAuthenticatedUser: vi.fn(),
    getContent: vi.fn(),
  },
  git: {
    getRef: vi.fn(),
    getCommit: vi.fn(),
    createBlob: vi.fn(),
    createTree: vi.fn(),
    createCommit: vi.fn(),
    updateRef: vi.fn(),
  },
  users: {
    getAuthenticated: vi.fn(),
  },
}))

vi.mock('@octokit/rest', () => ({
  Octokit: function MockOctokit() {
    return mocks
  },
}))

import { createRepo, commitSpecFiles, isSpecDirty } from './repo'

describe('createRepo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates repo and returns full name', async () => {
    mocks.repos.createForAuthenticatedUser.mockResolvedValue({
      data: { full_name: 'testuser/my-team' },
    })
    const name = await createRepo('test-team', 'testuser', 'my-team')
    expect(name).toBe('testuser/my-team')
    expect(mocks.repos.createForAuthenticatedUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'my-team', private: true, auto_init: true })
    )
  })
})

describe('commitSpecFiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('commits all spec files to main in a single commit', async () => {
    mocks.git.getRef.mockResolvedValue({ data: { object: { sha: 'abc123' } } })
    mocks.git.getCommit.mockResolvedValue({ data: { tree: { sha: 'tree123' } } })
    mocks.git.createBlob.mockResolvedValue({ data: { sha: 'blob-sha' } })
    mocks.git.createTree.mockResolvedValue({ data: { sha: 'newtree-sha' } })
    mocks.git.createCommit.mockResolvedValue({ data: { sha: 'newcommit-sha' } })
    mocks.git.updateRef.mockResolvedValue({})

    await commitSpecFiles('test-team', 'owner/repo', [
      { path: 'agents/alice/IDENTITY.md', content: '# Alice' },
      { path: 'agents/alice/SOUL.md', content: '# Soul' },
    ], 'chore: update agent spec')

    expect(mocks.git.createBlob).toHaveBeenCalledTimes(2)
    expect(mocks.git.createCommit).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'chore: update agent spec' })
    )
    expect(mocks.git.updateRef).toHaveBeenCalled()
  })
})

describe('isSpecDirty', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when remote matches local', async () => {
    const content = '# Alice\n'
    mocks.repos.getContent.mockResolvedValue({
      data: { type: 'file', content: Buffer.from(content).toString('base64') },
    })
    const dirty = await isSpecDirty('test-team', 'owner/repo', [{ path: 'IDENTITY.md', content }])
    expect(dirty).toBe(false)
  })

  it('returns true when remote differs from local', async () => {
    mocks.repos.getContent.mockResolvedValue({
      data: { type: 'file', content: Buffer.from('# Different').toString('base64') },
    })
    const dirty = await isSpecDirty('test-team', 'owner/repo', [{ path: 'IDENTITY.md', content: '# Alice\n' }])
    expect(dirty).toBe(true)
  })

  it('returns true when file does not exist remotely', async () => {
    mocks.repos.getContent.mockRejectedValue(new Error('Not Found'))
    const dirty = await isSpecDirty('test-team', 'owner/repo', [{ path: 'NEW.md', content: '# New' }])
    expect(dirty).toBe(true)
  })
})
