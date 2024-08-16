import MqttUdpPacket from "./DTOs/PacketDto.js";
import MqttPacketTypeEnum from "./enums/PacketTypeEnum.js";
import RemainingLengthOversized from "./expection/RemainingLengthOversized.js";

type PacketWaitingAck = {
  [packetId: number]: {
    packet: Buffer;
    intervalId: NodeJS.Timeout;
    retries: number;
  };
};

class PacketMapper {
  private static getQosFixedHeader(qos: number) {
    // Separing in a different function to implement retain and dup if needed later;

    if (qos > 2) {
      throw new Error("QoS level must be between 0 and 2");
    }
    return qos << 1;
  }

  private static generatePacketId(packetsWaitingAck: PacketWaitingAck) {
    const generatedId = Math.floor(Math.random() * 65535) + 1;
    if (packetsWaitingAck[generatedId]) {
      return this.generatePacketId(packetsWaitingAck);
    }
    return generatedId;
  }

  public static generatePacketBuffer(
    mqttPacket: MqttUdpPacket,
    packetsWaitingAck: PacketWaitingAck,
  ): Buffer {
    const packetIdLength = mqttPacket.getQos() ? 2 : 0;

    const topicBuffer = Buffer.from(mqttPacket.getTopic());
    const messageBuffer = Buffer.from(mqttPacket.getMessage());
    const payloadLength =
      topicBuffer.length + messageBuffer.length + 2 + packetIdLength;
    const bytesPayloadLength = this._generateVariableByteInteger(payloadLength);

    // Setting the buffer
    const packet = Buffer.alloc(1 + bytesPayloadLength.length + payloadLength);

    packet.writeUInt4(3, 0);
    packet.writeUInt4(this.getQosFixedHeader(mqttPacket.getQos()), 1);
    bytesPayloadLength.copy(packet, 1);
    packet.writeUInt16BE(topicBuffer.length, 1 + bytesPayloadLength.length);
    topicBuffer.copy(packet, bytesPayloadLength.length + 3);

    let offset = 3 + bytesPayloadLength.length + topicBuffer.length;
    if (packetIdLength) {
      mqttPacket.setPacketId(this.generatePacketId(packetsWaitingAck));
      packet.writeUInt16BE(mqttPacket.getPacketId(), offset);
      offset += 2;
    }
    messageBuffer.copy(packet, offset);

    return packet;
  }

  private static _generateVariableByteInteger(value: number): Buffer {
    const uint8Array = new Uint8Array(4);
    let remainingValue = value;
    let byte = 0;
    let i = 0;
    do {
      byte = remainingValue % 128;
      remainingValue = Math.floor(remainingValue / 128);
      if (remainingValue > 0) {
        byte = byte | 0x80;
      }
      uint8Array[i] = byte;
      i++;
    } while (remainingValue > 0);
    return Buffer.from(uint8Array.slice(0, i));
  }

  //reader
  private static readVariableBytePayloadLength(
    packet: Buffer,
  ): [number, number] {
    let bytesRead = 0;
    let multiplier = 1;
    let result = 0;
    let byte = 0;

    do {
      if (bytesRead >= 4) {
        throw new RemainingLengthOversized();
      }
      byte = packet.readUInt8(bytesRead + 1);
      result += (byte & 0x7f) * multiplier;
      multiplier *= 128;
      bytesRead++;
    } while ((byte & 0x80) !== 0);

    return [result, bytesRead];
  }

  public static parsePublishMessage(msg: Buffer): {
    packet: MqttUdpPacket;
    packetId?: number;
  } {
    const [payloadLength, bytesRead] = this.readVariableBytePayloadLength(msg);

    const qos = (msg.readUInt4(1) >> 1) & 0x03;
    if (qos > 2) {
      throw new Error("Invalid QoS level");
    }

    const topicLengthHi = msg.readUint8(1 + bytesRead);
    const topicLengthLo = msg.readUint8(2 + bytesRead);
    const topicLength = (topicLengthHi << 8) | topicLengthLo;

    let startRead = 3 + bytesRead;

    const topic = msg.toString("utf-8", startRead, startRead + topicLength);

    startRead += topicLength;

    let packetId: number = null;
    if (qos > 0) {
      packetId = msg.readUInt16BE(startRead);
      startRead += 2;
    }
    const messageLength = payloadLength - startRead + 2;
    const message = msg.toString("utf-8", startRead, startRead + messageLength);

    const packet = new MqttUdpPacket({
      packetType: MqttPacketTypeEnum.PUBLISH,
      topic,
      message,
      qos,
    });

    if (packetId && qos > 0) {
      packet.setPacketId(packetId);
    }

    return { packet, packetId };
  }
}

export default PacketMapper;
