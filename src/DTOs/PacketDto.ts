import MqttPacketTypeEnum from "../enums/PacketTypeEnum.js";
import dgram from "dgram";

class MqttUdpPacket {
  private packetType: MqttPacketTypeEnum;
  private topic: string;
  private message: string;
  private qos: number;
  private rinfo: dgram.RemoteInfo;
  private packetId: number;

  constructor({
    packetType,
    topic,
    message,
    qos,
  }: {
    packetType?: MqttPacketTypeEnum;
    topic?: string;
    message?: string;
    qos?: number;
  }) {
    this.packetType = packetType;
    this.topic = topic;
    this.message = message;
    this.qos = qos || 0;
  }
  // Getters
  getPacketType(): MqttPacketTypeEnum {
    return this.packetType;
  }
  getTopic(): string {
    return this.topic;
  }
  getMessage(): string {
    return this.message;
  }
  getQos(): number {
    return this.qos;
  }
  getRinfo(): dgram.RemoteInfo {
    return this.rinfo;
  }
  getPacketId(): number {
    return this.packetId;
  }

  // Setters
  setPacketType(packetType: MqttPacketTypeEnum): void {
    this.packetType = packetType;
  }
  setTopic(topic: string): void {
    this.topic = topic;
  }
  setMessage(message: string): void {
    this.message = message;
  }
  setQos(qos: number): void {
    this.qos = qos;
  }
  setRinfo(rinfo: dgram.RemoteInfo): void {
    this.rinfo = rinfo;
  }
  setPacketId(packetId: number): void {
    if (this.packetId > 65535 || this.packetId < 1) {
      throw new Error("Packet ID must be between 1 and 65535");
    }
    this.packetId = packetId;
  }
}
export default MqttUdpPacket;
