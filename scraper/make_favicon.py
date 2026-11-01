#!/usr/bin/env python3
"""Genera el favicon (corazón rojo) en mirror/, sin dependencias externas.

Salida: favicon.svg, favicon.ico (16/32/48), favicon-16x16.png, favicon-32x32.png,
        apple-touch-icon.png (180, fondo blanco), icon-192.png, icon-512.png
El corazón se define una sola vez como curvas Bézier (HEART) y se usa tanto para el SVG
como para rasterizar los PNG, así todos los tamaños son idénticos.
Uso: python3 -I scraper/make_favicon.py
"""
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "mirror")
RED = (225, 29, 72)  # #e11d48, el rojo del corazón del logo del sitio
HEX = "#e11d48"

# Corazón en un lienzo de 24x24: punto de inicio y segmentos cúbicos (c1, c2, destino)
START = (12.0, 21.5)
HEART = [
    ((5.0, 15.8), (2.0, 12.4), (2.0, 8.6)),
    ((2.0, 5.5), (4.4, 3.2), (7.3, 3.2)),
    ((9.3, 3.2), (11.0, 4.2), (12.0, 5.9)),
    ((13.0, 4.2), (14.7, 3.2), (16.7, 3.2)),
    ((19.6, 3.2), (22.0, 5.5), (22.0, 8.6)),
    ((22.0, 12.4), (19.0, 15.8), (12.0, 21.5)),
]


def svg_path():
    f = lambda p: f"{p[0]:g} {p[1]:g}"
    d = f"M{f(START)}" + "".join(f"C{f(a)} {f(b)} {f(c)}" for a, b, c in HEART) + "Z"
    return d


def polygon(steps=120):
    pts, p0 = [START], START
    for c1, c2, p3 in HEART:
        for i in range(1, steps + 1):
            t = i / steps
            u = 1 - t
            pts.append((
                u**3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t**3 * p3[1],
            ))
        p0 = p3
    return pts


POLY = polygon()
EDGES = [(POLY[i], POLY[(i + 1) % len(POLY)]) for i in range(len(POLY))]


def coverage(size, ss=4):
    """Cobertura 0..1 de cada píxel (scanline con ss subfilas; horizontal exacta)."""
    cov = [[0.0] * size for _ in range(size)]
    k = size * ss / 24.0  # unidades del lienzo -> subpíxeles
    for j in range(size * ss):
        y = (j + 0.5) / k
        xs = sorted(
            x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            for (x1, y1), (x2, y2) in EDGES
            if (y1 <= y < y2) or (y2 <= y < y1)
        )
        row = cov[j // ss]
        for a, b in zip(xs[0::2], xs[1::2]):
            ua, ub = a * k, b * k
            for px in range(max(0, int(ua // ss)), min(size - 1, int(ub // ss)) + 1):
                lo, hi = max(ua, px * ss), min(ub, (px + 1) * ss)
                if hi > lo:
                    row[px] += (hi - lo) / (ss * ss)
    return cov


def png(size, background=None):
    cov = coverage(size)
    raw = bytearray()
    for row in cov:
        raw.append(0)  # filtro "none"
        for c in row:
            c = min(1.0, c)
            if background is None:
                raw += bytes((*RED, round(c * 255)))
            else:
                raw += bytes(round(background[i] * (1 - c) + RED[i] * c) for i in range(3)) + b"\xff"

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def ico(sizes):
    blobs = [png(s) for s in sizes]
    head = struct.pack("<HHH", 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    entries = b""
    for s, blob in zip(sizes, blobs):
        entries += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    return head + entries + b"".join(blobs)


def write(name, data):
    mode = "w" if isinstance(data, str) else "wb"
    with open(os.path.join(OUT, name), mode) as f:
        f.write(data)
    print(f"{name}: {os.path.getsize(os.path.join(OUT, name))} bytes")


def main():
    write("favicon.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="{HEX}" d="{svg_path()}"/></svg>\n')
    write("favicon.ico", ico([16, 32, 48]))
    write("favicon-16x16.png", png(16))
    write("favicon-32x32.png", png(32))
    write("apple-touch-icon.png", png(180, background=(255, 255, 255)))
    write("icon-192.png", png(192))
    write("icon-512.png", png(512))


if __name__ == "__main__":
    main()
