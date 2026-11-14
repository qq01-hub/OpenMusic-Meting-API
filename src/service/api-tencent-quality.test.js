import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import api from './api.js'
import store from '../admin/store.js'

const accounts = Array.from({ length: 5 }, (_, index) => ({
    id: `svip-${index}`, platform: 'tencent', cookie: `uin=${index};qqmusic_key=test`,
    isActive: true, isValid: true, userInfo: { canPlaySvip: true },
}))

let requests
let failure
beforeEach(() => {
    requests = []
    vi.spyOn(store, 'getCookies').mockReturnValue(accounts.slice(0, 2))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    failure = vi.spyOn(store, 'recordCookieUrlFailure').mockResolvedValue()
    vi.spyOn(store, 'recordCookieUrlSuccess').mockResolvedValue()
    vi.spyOn(store, 'recordCookieRequestSuccess').mockResolvedValue()
    vi.spyOn(store, 'addApiLog').mockResolvedValue()
    vi.spyOn(store, 'getLoudnessServiceUrl').mockReturnValue('')
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

const context = (extra = {}, explicit = '') => ({
    req: {
        query: () => ({ server: 'tencent', type: 'url', id: 'song', quality: 'master', ...extra }),
        header: () => explicit,
    },
    set: vi.fn(), status: vi.fn(), json: value => value, redirect: url => ({ url }),
})

const upstream = (resolve) => {
    vi.stubGlobal('fetch', vi.fn(async input => {
        const url = new URL(input)
        if (url.hostname === 'audio.example') return { status: 206 }
        const data = JSON.parse(url.searchParams.get('data'))
        if (data.songinfo) return { json: async () => ({ songinfo: { data: { track_info: {
            file: { media_mid: 'media', size_new: [100, 100], size_flac: 100 },
        } } } }) }
        const prefix = data.req_0.param.filename[0].slice(0, 4)
        const uin = data.comm.uin
        requests.push(`${uin}:${prefix}`)
        const result = resolve(uin, prefix)
        return { json: async () => ({ req_0: { data: {
            sip: ['https://audio.example/'],
            midurlinfo: [result === true ? { result: 0, purl: `${prefix}-${uin}.flac` }
                : { result: result || 104003, purl: '' }],
        } } }) }
    }))
}

it('tries another SVIP for master before requesting any lower quality', async () => {
    upstream((uin, prefix) => (uin === '1' && prefix === 'AI00') || prefix === 'F000')
    expect(await api(context())).toMatchObject({ quality: '臻品母带', url: 'https://audio.example/AI00-1.flac' })
    expect(requests).toEqual(['0:AI00', '1:AI00'])
    expect(store.recordCookieUrlSuccess).toHaveBeenCalledWith('svip-1')
    expect(failure).not.toHaveBeenCalled()
})

it('falls back only after all candidate SVIPs fail the requested quality', async () => {
    upstream((_uin, prefix) => prefix === 'F000')
    expect(await api(context())).toMatchObject({ quality: 'SQ无损品质' })
    expect(requests).toEqual(['0:AI00', '1:AI00', '0:AI00', '0:Q000', '0:F000'])
    expect(store.recordCookieUrlSuccess).toHaveBeenCalledWith('svip-0')
})

it('does not revisit an account requiring verification during fallback', async () => {
    upstream((uin, prefix) => uin === '0' ? 104009 : prefix === 'F000')
    expect(await api(context())).toMatchObject({ quality: 'SQ无损品质' })
    expect(requests).toEqual(['0:AI00', '1:AI00', '1:AI00', '1:Q000', '1:F000'])
    expect(failure).toHaveBeenCalledWith('svip-0', 'song', true)
})

it('bounds master account failover to three retries before degrading', async () => {
    vi.spyOn(store, 'getCookies').mockReturnValue(accounts)
    upstream((_uin, prefix) => prefix === 'F000')
    expect(await api(context())).toMatchObject({ quality: 'SQ无损品质' })
    expect(requests.slice(0, 4)).toEqual(['0:AI00', '1:AI00', '2:AI00', '3:AI00'])
    expect(requests).not.toContain('4:AI00')
})

it('preserves explicit Cookie fallback without switching accounts', async () => {
    upstream((_uin, prefix) => prefix === 'F000')
    expect(await api(context({}, 'uin=explicit;qqmusic_key=test'))).toMatchObject({ quality: 'SQ无损品质' })
    expect(requests).toEqual(['explicit:AI00', 'explicit:Q000', 'explicit:F000'])
})

it('returns verification failure without downgrading when all SVIPs require verification', async () => {
    upstream(() => 104009)
    const ctx = context()
    expect(await api(ctx)).toMatchObject({ code: 'MUSIC_VERIFICATION_REQUIRED' })
    expect(ctx.status).toHaveBeenCalledWith(422)
    expect(requests).toEqual(['0:AI00', '1:AI00'])
})

it('continues with the next downgrade candidate when the first has no playable quality', async () => {
    upstream((uin, prefix) => uin === '1' && prefix === 'F000')
    expect(await api(context())).toMatchObject({ quality: 'SQ无损品质', url: 'https://audio.example/F000-1.flac' })
    expect(requests.slice(0, 2)).toEqual(['0:AI00', '1:AI00'])
    expect(failure).toHaveBeenCalledWith('svip-0', 'song', false)
    expect(store.recordCookieUrlSuccess).toHaveBeenCalledWith('svip-1')
})

it('redirects to the master URL obtained from the next SVIP', async () => {
    upstream((uin, prefix) => (uin === '1' && prefix === 'AI00') || prefix === 'F000')
    expect(await api(context({ redirect: '1' }))).toEqual({ url: 'https://audio.example/AI00-1.flac' })
    expect(requests).toEqual(['0:AI00', '1:AI00'])
})
