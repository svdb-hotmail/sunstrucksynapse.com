const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function ch(x: number, y: number, z: number): number {
  return ((x & y) ^ (~x & z)) >>> 0;
}

function maj(x: number, y: number, z: number): number {
  return ((x & y) ^ (x & z) ^ (y & z)) >>> 0;
}

function sigma0(x: number): number {
  return (rotr(2, x) ^ rotr(13, x) ^ rotr(22, x)) >>> 0;
}

function sigma1(x: number): number {
  return (rotr(6, x) ^ rotr(11, x) ^ rotr(25, x)) >>> 0;
}

function gamma0(x: number): number {
  return (rotr(7, x) ^ rotr(18, x) ^ (x >>> 3)) >>> 0;
}

function gamma1(x: number): number {
  return (rotr(17, x) ^ rotr(19, x) ^ (x >>> 10)) >>> 0;
}

export class IncrementalSha256 {
  private h0 = 0x6a09e667;
  private h1 = 0xbb67ae85;
  private h2 = 0x3c6ef372;
  private h3 = 0xa54ff53a;
  private h4 = 0x510e527f;
  private h5 = 0x9b05688c;
  private h6 = 0x1f83d9ab;
  private h7 = 0x5be0cd19;

  private readonly buffer = new Uint8Array(64);
  private bufferLength = 0;
  private totalBytes = 0;
  private readonly w = new Uint32Array(64);

  private processBlock(block: Uint8Array, offset: number) {
    for (let i = 0; i < 16; i++) {
      const o = offset + i * 4;
      this.w[i] =
        ((block[o] << 24) | (block[o + 1] << 16) | (block[o + 2] << 8) | block[o + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = gamma0(this.w[i - 15]);
      const s1 = gamma1(this.w[i - 2]);
      this.w[i] = (this.w[i - 16] + s0 + this.w[i - 7] + s1) >>> 0;
    }

    let a = this.h0;
    let b = this.h1;
    let c = this.h2;
    let d = this.h3;
    let e = this.h4;
    let f = this.h5;
    let g = this.h6;
    let h = this.h7;

    for (let i = 0; i < 64; i++) {
      const t1 = (h + sigma1(e) + ch(e, f, g) + K[i] + this.w[i]) >>> 0;
      const t2 = (sigma0(a) + maj(a, b, c)) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    this.h0 = (this.h0 + a) >>> 0;
    this.h1 = (this.h1 + b) >>> 0;
    this.h2 = (this.h2 + c) >>> 0;
    this.h3 = (this.h3 + d) >>> 0;
    this.h4 = (this.h4 + e) >>> 0;
    this.h5 = (this.h5 + f) >>> 0;
    this.h6 = (this.h6 + g) >>> 0;
    this.h7 = (this.h7 + h) >>> 0;
  }

  update(chunk: Uint8Array): this {
    this.totalBytes += chunk.byteLength;
    let offset = 0;
    let remaining = chunk.byteLength;

    if (this.bufferLength > 0) {
      const toCopy = Math.min(64 - this.bufferLength, remaining);
      this.buffer.set(chunk.subarray(offset, offset + toCopy), this.bufferLength);
      this.bufferLength += toCopy;
      offset += toCopy;
      remaining -= toCopy;

      if (this.bufferLength === 64) {
        this.processBlock(this.buffer, 0);
        this.bufferLength = 0;
      }
    }

    while (remaining >= 64) {
      this.processBlock(chunk, offset);
      offset += 64;
      remaining -= 64;
    }

    if (remaining > 0) {
      this.buffer.set(chunk.subarray(offset, offset + remaining), 0);
      this.bufferLength = remaining;
    }

    return this;
  }

  digestHex(): string {
    const savedH0 = this.h0;
    const savedH1 = this.h1;
    const savedH2 = this.h2;
    const savedH3 = this.h3;
    const savedH4 = this.h4;
    const savedH5 = this.h5;
    const savedH6 = this.h6;
    const savedH7 = this.h7;
    const savedBufferLength = this.bufferLength;
    const savedTotalBytes = this.totalBytes;

    const padLen = this.bufferLength < 56 ? 64 : 128;
    const pad = new Uint8Array(padLen);
    pad.set(this.buffer.subarray(0, this.bufferLength), 0);
    pad[this.bufferLength] = 0x80;

    const bitLength = BigInt(this.totalBytes) * 8n;
    const view = new DataView(pad.buffer, pad.byteOffset, pad.byteLength);
    view.setBigUint64(padLen - 8, bitLength, false);

    this.processBlock(pad, 0);
    if (padLen === 128) {
      this.processBlock(pad, 64);
    }

    const hex = [
      this.h0,
      this.h1,
      this.h2,
      this.h3,
      this.h4,
      this.h5,
      this.h6,
      this.h7,
    ]
      .map((val) => val.toString(16).padStart(8, "0"))
      .join("");

    this.h0 = savedH0;
    this.h1 = savedH1;
    this.h2 = savedH2;
    this.h3 = savedH3;
    this.h4 = savedH4;
    this.h5 = savedH5;
    this.h6 = savedH6;
    this.h7 = savedH7;
    this.bufferLength = savedBufferLength;
    this.totalBytes = savedTotalBytes;

    return hex;
  }
}

export async function computeBlobSha256(
  blob: Blob,
  chunkSize = 1024 * 1024,
): Promise<string> {
  const hasher = new IncrementalSha256();
  if (typeof blob.stream === "function") {
    const reader = blob.stream().getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          hasher.update(value);
        }
      }
      return hasher.digestHex();
    } finally {
      reader.releaseLock();
    }
  }

  let offset = 0;
  while (offset < blob.size) {
    const slice = blob.slice(offset, Math.min(offset + chunkSize, blob.size));
    const arrayBuffer = await slice.arrayBuffer();
    hasher.update(new Uint8Array(arrayBuffer));
    offset += slice.size;
  }
  return hasher.digestHex();
}
