import MqttPacketTypeEnum from "../enums/PacketTypeEnum.js";
import dgram from "dgram";

class MqttUdpPacket {
  private packetType: MqttPacketTypeEnum;
  private topic: string;
  private message: string;
  private qos: number;
  private rinfo: dgram.RemoteInfo;

  constructor({
    packetType,
    topic,
    message,
    qos,
    rinfo,
  }: {
    packetType?: MqttPacketTypeEnum;
    topic?: string;
    message?: string;
    qos?: number;
    rinfo?: dgram.RemoteInfo;
  }) {
    this.packetType = packetType;
    this.topic = topic;
    this.message = message;
    this.qos = qos;
    this.rinfo = rinfo;
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
}
export default MqttUdpPacket;
