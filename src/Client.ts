import * as dgram from "dgram";

import MqttUdpPacket from "./DTOs/PacketDto.js";
import RemainingLengthOversized from "./expection/RemainingLengthOversized.js";
import MqttPacketTypeEnum from "./enums/PacketTypeEnum.js";
import Throttle from "./Throttle.js";
import { networkInterfaces } from "os";

type ClientOptions = {
  packetThrottle?: number;
  throttleTimeoutMs?: number;
  isThrottlingDisabled: boolean;
};

class Client {
  private client: dgram.Socket;
  private topicsSubscribed: string[] = [];
  private throttle: Throttle;

  private functionForTopics: {
    [topic: string]: (packet: MqttUdpPacket) => void;
  } = {};
  constructor(
    {
      packetThrottle,
      throttleTimeoutMs,
      isThrottlingDisabled = false,
    }: ClientOptions,
    callback?: () => void,
  ) {
    if (!isThrottlingDisabled) {
      this.throttle = new Throttle(packetThrottle, throttleTimeoutMs);
    }
    this.client = dgram.createSocket("udp4");
    this.client.bind(1883, callback);

    this.client.on("message", (msg, rinfo) => {
      if (this.throttle) {
        this.throttle.read(() => {
          this._handleMessage(msg, rinfo);
        });
      } else {
        this._handleMessage(msg, rinfo);
      }
    });
  }

  private _checkTopicAndReturnSubscribed(topic: string): string | null {
    // Wildcard check
    for (const subscribedTopic of this.topicsSubscribed) {
      if (this._matchTopic(subscribedTopic, topic)) {
        return subscribedTopic;
      }
    }
    return null;
  }

  private _matchTopic(subscribedTopic: string, topic: string): boolean {
    if (subscribedTopic === topic) return true;

    const subscribedLevels = subscribedTopic.split("/");
    const topicLevels = topic.split("/");

    for (let i = 0; i < subscribedLevels.length; i++) {
      const subLevel = subscribedLevels[i];

      // Se acabaram os níveis do tópico, mas não do tópico inscrito
      if (i >= topicLevels.length) {
        if (subLevel === "#") {
          return true;
        }
        return null;
      }

      const topicLevel = topicLevels[i];

      if (subLevel === "#") {
        return true; // "#" corresponde a todos os níveis restantes
      } else if (subLevel !== "+" && subLevel !== topicLevel) {
        return false; // Nível não corresponde e não é um curinga
      }
    }

    // Se `topic` tem mais níveis do que `subscribedTopic`
    if (topicLevels.length > subscribedLevels.length) {
      if (subscribedLevels[subscribedLevels.length - 1] !== "#") {
        return false;
      }
    }

    return true;
  }

  public subscribe(
    topic: string,
    onReceive: (packet: MqttUdpPacket) => void,
    callback: (err: Error) => void,
  ) {
    if (this.topicsSubscribed.includes(topic)) {
      return callback(new Error("Already subscribed to this topic"));
    }

    this.topicsSubscribed.push(topic);
    this.functionForTopics[topic] = onReceive;
    const topicBuffer = Buffer.from(topic);
    const packet = Buffer.alloc(2 + topicBuffer.length);
    packet.writeUInt4(3, 0);
    packet.writeUInt4(0, 1);
    packet.writeUInt8(topicBuffer.length, 1);
    topicBuffer.copy(packet, 2);
    this.client.send(packet, 1883, "localhost", callback);
  }

  public sendMessage(mqttPacket: MqttUdpPacket) {
    if (this.throttle) {
      this.throttle.send(() => {
        this._sendMessage(mqttPacket);
      });
    } else {
      this._sendMessage(mqttPacket);
    }
  }

  private _sendMessage(mqttPacket: MqttUdpPacket) {
    const topicBuffer = Buffer.from(mqttPacket.getTopic());
    const messageBuffer = Buffer.from(mqttPacket.getMessage());
    const payloadLength = topicBuffer.length + messageBuffer.length + 2;
    const bytesPayloadLength = this._generateVariableByteInteger(payloadLength);
    const packet = Buffer.alloc(1 + bytesPayloadLength.length + payloadLength);
    packet.writeUInt4(3, 0);
    packet.writeUInt4(0, 1);
    bytesPayloadLength.copy(packet, 1);
    packet.writeUInt16BE(topicBuffer.length, 1 + bytesPayloadLength.length);
    topicBuffer.copy(packet, bytesPayloadLength.length + 3);
    messageBuffer.copy(
      packet,
      3 + bytesPayloadLength.length + topicBuffer.length,
    );

    this.client.send(packet, 1883, "10.254.23.255", (err) => {
      if (err) {
        console.error(err);
      }
      console.log("Message sent successfully to IP: 60391");
    });
  }

  private _readVariableBytePayloadLength(
    packet: Buffer,
  ): [result: number, bytesRead: number] {
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
  private _receivePublishMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    const [payloadLength, bytesRead] = this._readVariableBytePayloadLength(msg);

    const topicLengthHi = msg.readUint8(1 + bytesRead);
    const topicLengthLo = msg.readUint8(2 + bytesRead);
    const topicLength = (topicLengthHi << 8) | topicLengthLo;

    const topic = msg.toString(
      "utf-8",
      3 + bytesRead,
      3 + bytesRead + topicLength,
    );

    console.log(`Received message from topic ${topic}`);
    const hasSubscribed = this._checkTopicAndReturnSubscribed(topic);
    if (hasSubscribed) {
      const messageLength = payloadLength - topicLength - 2 - bytesRead - 1;
      const message = msg.toString(
        "utf-8",
        3 + bytesRead + topicLength,
        3 + bytesRead + topicLength + messageLength,
      );
      const packet = new MqttUdpPacket({
        packetType: MqttPacketTypeEnum.PUBLISH,
        topic,
        message,
        rinfo,
        qos: 0,
      });
      this.functionForTopics[hasSubscribed](packet);
    }
  }

  private _generateVariableByteInteger(value: number): Buffer {
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

  private _handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    const packetType = msg.readUInt4(0);
    switch (packetType) {
      case 3:
        this._receivePublishMessage(msg, rinfo);
        break;
      case 12:
        this._sendPingResponse(rinfo);
        break;
      default:
        console.log(`Received unknown packet type ${packetType}`);
    }
  }

  private _sendPingResponse(rinfo: dgram.RemoteInfo) {
    const sendPacket = () => {
      const packet = Buffer.from([0xd0, 0x00]);
      this.client.send(packet, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.error(err);
        }
        console.log("Ping response sent successfully");
      });
    };

    if (this.throttle) {
      this.throttle.send(sendPacket);
    } else {
      sendPacket();
    }
  }
  public sendPing(address: string, port: number) {
    if (this.throttle) {
      this.throttle.send(() => {
        this._sendPing(address, port);
      });
    } else {
      this._sendPing(address, port);
    }
  }
  private _sendPing(address: string, port: number) {
    const packet = Buffer.from([0xc0, 0x00]);
    this.client.send(packet, port, address, (err) => {
      if (err) {
        console.error(err);
      }
      console.log("Ping sent successfully");
    });
  }
}

export default Client;
