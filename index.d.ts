declare module "buffer" {
  interface Buffer {
    readUInt4(uInt4Offset: number): number;
  }
}
