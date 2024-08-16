import BufferOptions, { Buffer } from "buffer";
import Client from "./src/Client.js";
import Throttle from "./src/Throttle.js";
import MqttUdpPacket from "./src/DTOs/PacketDto.js";
import MqttPacketTypeEnum from "./src/enums/PacketTypeEnum.js";

declare module "buffer" {
  interface Buffer {
    readUInt4(uInt4Offset: number): number;
    writeUInt4(value: number, uInt4Offset: number): number;
  }
}

Buffer.prototype.writeUInt4 = function (
  this: Buffer,
  value: number,
  uInt4Offset: number = 0,
) {
  const offset = Math.floor(uInt4Offset / 2);
  if (offset > this.length) throw new Error("Offset is out of bounds.");
  if (uInt4Offset % 2 === 0) {
    this[offset] = (this[offset] & 0b00001111) | ((value & 0b00001111) << 4);
  } else {
    this[offset] = (this[offset] & 0b11110000) | (value & 0b00001111);
  }
  return this;
};

Buffer.prototype.readUInt4 = function (this: Buffer, uInt4Offset: number = 0) {
  const offset = Math.floor(uInt4Offset / 2);
  if (offset > this.length) throw new Error("Offset is out of bounds.");
  if (uInt4Offset % 2 === 0) {
    return (this[offset] & 0b11110000) >> 4;
  }
  return this[offset] & 0b00001111;
};

const MqttUdpClient = Client;

export default MqttUdpClient;
export { Throttle, MqttUdpPacket, MqttPacketTypeEnum };
