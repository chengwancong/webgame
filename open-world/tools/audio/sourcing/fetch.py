"""远程 zip 目录读取/单文件抽取（HTTP Range），只为挑选 Sonniss GDC 素材用；不下载整个分卷。
工作目录 .qa/audio-sourcing（原始素材只留本地，不提交）：
  python -I ../../tools/audio/sourcing/fetch.py list <分卷url> listings/<年-pN>.json
  python -I ../../tools/audio/sourcing/select.py            生成 picks/*.txt（本目录 picks/ 为本次实际选用清单）
  python -I ../../tools/audio/sourcing/fetch.py get listings/<年-pN>.json picks/<年-pN>.txt raw-sonniss/<年-pN>
分卷地址与授权见 sources.md。
"""
import json, struct, sys, os, zlib, urllib.request, time

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'


def fetch(url, start, end, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Range': f'bytes={start}-{end}', 'Referer': 'https://sonniss.com/gameaudiogdc/'})
            with urllib.request.urlopen(req, timeout=60) as r:
                if r.status != 206:
                    raise RuntimeError(f'expected 206, got {r.status}')
                return r.read()
        except Exception as e:
            if k == tries - 1:
                raise
            time.sleep(2 + 3 * k)


def size_of(url):
    req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': UA, 'Referer': 'https://sonniss.com/gameaudiogdc/'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return int(r.headers['Content-Length'])


def listing(url):
    total = size_of(url)
    tail = fetch(url, max(0, total - 65558), total - 1)
    i = tail.rfind(b'PK\x05\x06')
    if i < 0:
        raise RuntimeError('no EOCD')
    _, disk, cdisk, n_disk, n, cd_size, cd_off, _ = struct.unpack('<IHHHHIIH', tail[i:i + 22])
    j = tail.rfind(b'PK\x06\x07', 0, i)
    if j >= 0:  # zip64 locator
        z64_off = struct.unpack('<Q', tail[j + 8:j + 16])[0]
        rec = fetch(url, z64_off, z64_off + 55)
        n, cd_size, cd_off = struct.unpack('<QQQ', rec[32:56])
    cd = fetch(url, cd_off, cd_off + cd_size - 1)
    out, p = [], 0
    while p < len(cd) and cd[p:p + 4] == b'PK\x01\x02':
        (method, crc, csize, usize, nlen, xlen, clen, off) = (
            struct.unpack('<H', cd[p + 10:p + 12])[0], *struct.unpack('<III', cd[p + 16:p + 28]),
            *struct.unpack('<HHH', cd[p + 28:p + 34]), struct.unpack('<I', cd[p + 42:p + 46])[0])
        name = cd[p + 46:p + 46 + nlen].decode('utf8', 'replace')
        extra = cd[p + 46 + nlen:p + 46 + nlen + xlen]
        q = 0
        while q + 4 <= len(extra):
            hid, hl = struct.unpack('<HH', extra[q:q + 4])
            if hid == 1:
                vals, r = [], q + 4
                for flag in (usize, csize, off):
                    if flag == 0xFFFFFFFF:
                        vals.append(struct.unpack('<Q', extra[r:r + 8])[0]); r += 8
                    else:
                        vals.append(flag)
                usize, csize, off = vals
            q += 4 + hl
        out.append({'name': name, 'method': method, 'crc': crc, 'csize': csize, 'usize': usize, 'offset': off})
        p += 46 + nlen + xlen + clen
    return {'url': url, 'total': total, 'entries': out}


def get(url, entry, outdir):
    head = fetch(url, entry['offset'], entry['offset'] + 29)
    nlen, xlen = struct.unpack('<HH', head[26:30])
    start = entry['offset'] + 30 + nlen + xlen
    data = fetch(url, start, start + entry['csize'] - 1) if entry['csize'] else b''
    if entry['method'] == 8:
        data = zlib.decompress(data, -15)
    elif entry['method'] != 0:
        raise RuntimeError(f"method {entry['method']}")
    if zlib.crc32(data) & 0xFFFFFFFF != entry['crc']:
        raise RuntimeError('crc mismatch ' + entry['name'])
    dest = os.path.join(outdir, *entry['name'].replace(chr(92), '/').split('/'))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'wb') as f:
        f.write(data)
    return dest


if __name__ == '__main__':
    if sys.argv[1] == 'list':
        json.dump(listing(sys.argv[2]), open(sys.argv[3], 'w', encoding='utf8'), ensure_ascii=False)
    elif sys.argv[1] == 'get':
        lst = json.load(open(sys.argv[2], encoding='utf8'))
        names = set(l.strip() for l in open(sys.argv[3], encoding='utf8') if l.strip())
        out = sys.argv[4]
        for e in lst['entries']:
            if e['name'] in names:
                d = os.path.join(out, *e['name'].replace(chr(92), '/').split('/'))
                if os.path.exists(d) and os.path.getsize(d) == e['usize']:
                    continue
                print(get(lst['url'], e, out), flush=True)
