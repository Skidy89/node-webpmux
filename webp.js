/*
    node-webpmux - NodeJS module for interacting with WebP images
    Copyright (C) 2023  ApeironTsuka

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.
*/

const { WebPReader, WebPWriter } = require('./parser.js');
const IO = require('./io.js');
const constants = {
  TYPE_EXTENDED: 2
};
const readStream = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

class Image {
  constructor() { this.data = null; this.loaded = false; this.path = ''; }

  get exif() { return this.data.extended ? this.data.extended.hasEXIF ? this.data.exif.raw : undefined : undefined; }
  set exif(raw) {
    if (!this.data.extended) { this._convertToExtended(); }
    if (raw === undefined) { this.data.extended.hasEXIF = false; delete this.data.exif; }
    else { this.data.exif = { raw }; this.data.extended.hasEXIF = true; }
  }

  async load(d) {
    let reader = new WebPReader();
    if (typeof d === 'string') {
      if (!IO.avail) { await IO.err(); }
      reader.readFile(d);
      this.path = d;
    } else if (Buffer.isBuffer(d)) {
      reader.readBuffer(d);
    } else if (d instanceof require('stream').Readable) {
      const b = readStream(d);
      reader.readBuffer(b);
    } else {
      throw new Error('Unsupported input type');
    }
    this.data = await reader.read();
    this.loaded = true;
  }

  async save(path = this.path, { exif = !!this.exif } = {}) {
    let writer = new WebPWriter();
    if (path !== null) {
      if (!IO.avail) { await IO.err(); }
      writer.writeFile(path);
    } else {
      writer.writeBuffer();
    }
    return this._save(writer, { exif });
  }

  async _save(writer, { exif = false } = {}) {
    writer.writeFileHeader();
    if (this.data.type === constants.TYPE_EXTENDED) {
      let hasEXIF = exif === true ? !!this.exif : exif;
      writer.writeChunk_VP8X({ hasEXIF });
      if (hasEXIF) { writer.writeChunk_EXIF(exif !== true ? exif : this.data.exif); }
    }
    return writer.commit();
  }

  _convertToExtended() {
    if (!this.loaded) { throw new Error('No image loaded'); }
    this.data.type = constants.TYPE_EXTENDED;
    this.data.extended = {
      hasEXIF: false,
      width: this.data.vp8 ? this.data.vp8.width : this.data.vp8l ? this.data.vp8l.width : 1,
      height: this.data.vp8 ? this.data.vp8.height : this.data.vp8l ? this.data.vp8l.height : 1
    };
  }
}

module.exports = {
  TYPE_EXTENDED: constants.TYPE_EXTENDED,
  Image
};