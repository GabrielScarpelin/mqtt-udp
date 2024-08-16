import * as dgram from "dgram";

import MqttUdpPacket from "./DTOs/PacketDto.js";
import Throttle from "./Throttle.js";
import PacketMapper from "./PacketMapper.js";
import { randomBytes } from "crypto";
import MqttPacketTypeEnum from "./enums/PacketTypeEnum.js";
import NetAddr from "./NetAddr.js";

type ClientOptions = {
  throttle: Throttle;
  pubAckTimeoutMs?: number;
  port?: number;
  itemsConfigurable?: {
    item: string;
    functionItem: (packet: MqttUdpPacket) => void;
  }[];
  node?: {
    name: string;
    location: string;
  };
};

class Client {
  private client: dgram.Socket;
  private topicsSubscribed: string[] = [];
  private throttle: Throttle;
  private listenPort: number = 1883;
  private broadcastAddress: string;
  private readonly nodeId: string = randomBytes(8).toString("hex");
  private initiatedTime: Date = null;
  private node: {
    name: string;
    location: string;
  };
  private packetsWaitingAck: {
    [packetId: number]: {
      packet: Buffer;
      intervalId: NodeJS.Timeout;
      retries: number;
    };
  } = {};
  private pubAckTimeoutMs: number;

  private functionForTopics: {
    [topic: string]: (packet: MqttUdpPacket) => void;
  } = {};
  constructor(
    {
      throttle,
      pubAckTimeoutMs = 5000,
      port = 1883,
      itemsConfigurable,
      node,
    }: ClientOptions,
    callback?: () => void,
  ) {
    this.pubAckTimeoutMs = pubAckTimeoutMs;
    this.listenPort = port;
    this.broadcastAddress = NetAddr.getBroadcastAddress();
    this.initiatedTime = new Date();
    this.node = node || {
      name: "Node " + this.nodeId,
      location: "Unknown",
    };
    if (itemsConfigurable && itemsConfigurable.length > 0) {
      for (const itemConfigurable of itemsConfigurable) {
        this.topicsSubscribed.push(
          `$SYS/conf/${this.nodeId}/${itemConfigurable.item}`,
        );
        this.functionForTopics[
          `$SYS/conf/${this.nodeId}/${itemConfigurable.item}`
        ] = itemConfigurable.functionItem;
      }
    }

    if (throttle) {
      this.throttle = throttle;
    }

    this.client = dgram.createSocket("udp4");
    this.client.bind(this.listenPort, callback);
    this.client.on("message", (msg, rinfo) => {
      if (msg.length > 268435455) {
        console.error("Packet too large");
        return;
      }
      if (this.throttle) {
        this.throttle.read(() => {
          this._handleMessage(msg, rinfo);
        });
      } else {
        this._handleMessage(msg, rinfo);
      }
    });
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

  public sendPing(address: string, port: number) {
    if (this.throttle) {
      this.throttle.send(() => {
        this._sendPing(address, port);
      });
    } else {
      this._sendPing(address, port);
    }
  }

  private _sendMessage(
    mqttPacket: MqttUdpPacket,
    port = 1883,
    address = this.broadcastAddress,
  ) {
    const packet = PacketMapper.generatePacketBuffer(
      mqttPacket,
      this.packetsWaitingAck,
    );
    if (mqttPacket.getPacketId()) {
      this.packetsWaitingAck[mqttPacket.getPacketId()] = {
        packet,
        intervalId: null,
        retries: 0,
      };
    }
    this.client.send(packet, port, address, (err) => {
      if (err) {
        console.error(err);
      }
    });
    mqttPacket.getQos() > 0 &&
      this._startPubackTimeout(
        packet,
        mqttPacket.getPacketId(),
        port,
        this.broadcastAddress,
      );
  }

  private _handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    const packetType = msg.readUInt4(0);
    switch (packetType) {
      case 3:
        this._receivePublishMessage(msg, rinfo);
        break;
      case 4:
        this._receivePubAck(msg);
        break;
      case 8:
        this._sendConfigurableItemsOrPredefined(msg, rinfo.address, rinfo.port);
        break;
      case 12:
        this._sendPingResponse(rinfo);
        break;
      case 13:
        this._receivePingResponse();
        break;
      default:
        console.error(`Received unknown packet type ${packetType}`);
    }
  }

  private _receivePublishMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    try {
      const { packet, packetId } = PacketMapper.parsePublishMessage(msg);
      const hasSubscribed = this._checkTopicAndReturnSubscribed(
        packet.getTopic(),
      );

      if (hasSubscribed) {
        if (packetId && packet.getQos() > 0) {
          this._sendPubAck(packetId, rinfo);
        }
        this.functionForTopics[hasSubscribed](packet);
      }
    } catch (error) {
      console.error("Error processing publish message:", error);
    }
  }

  private _receivePubAck(msg: Buffer) {
    const packetId = msg.readUInt16BE(2);
    if (this.packetsWaitingAck[packetId]) {
      clearInterval(this.packetsWaitingAck[packetId].intervalId);
      delete this.packetsWaitingAck[packetId];
    } else {
      console.error("Received PUBACK for unknown packet ID");
    }
  }

  private _receivePingResponse() {
    console.log("Ping response received");
  }

  private _sendPingResponse(rinfo: dgram.RemoteInfo) {
    const sendPacket = () => {
      const packet = Buffer.from([0xd0, 0x00]);
      this.client.send(packet, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.error(err);
        }
      });
    };

    if (this.throttle) {
      this.throttle.send(sendPacket);
    } else {
      sendPacket();
    }
  }

  private _sendPing(address: string, port: number) {
    const packet = Buffer.from([0xc0, 0x00]);
    this.client.send(packet, port, address, (err) => {
      if (err) {
        console.error(err);
      }
    });
  }

  private _sendPubAck(packetId: number, rinfo: dgram.RemoteInfo) {
    const packet = Buffer.alloc(4);
    packet.writeUInt8(0x40, 0);
    packet.writeUInt8(0x02, 1);
    packet.writeUInt16BE(packetId, 2);
    this.client.send(packet, rinfo.port, rinfo.address, (err) => {
      if (err) {
        console.error(err);
        return;
      }
    });
  }

  private _startPubackTimeout(
    packet: Buffer,
    packetId: number,
    port: number,
    ip: string,
  ) {
    const timeout = setTimeout(() => {
      if (this.packetsWaitingAck[packetId]) {
        const secondNibble = packet.readUInt4(1);
        const setDup = secondNibble | 0x08;
        packet.writeUInt4(setDup, 1);
        this.client.send(packet, port, ip, (err) => {
          if (err) {
            console.error(err);
            return;
          }
        });
        if (this.packetsWaitingAck[packetId].retries < 5) {
          this._startPubackTimeout(packet, packetId, port, ip);
          this.packetsWaitingAck[packetId].retries++;
        }
        this.packetsWaitingAck[packetId].intervalId = null;
      }
    }, this.pubAckTimeoutMs);
    this.packetsWaitingAck[packetId].intervalId = timeout;
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
  private _sendConfigurableItemsOrPredefined(
    msg: Buffer,
    address: string,
    port: number,
  ) {
    const { packet: receivedPacket } = PacketMapper.parsePublishMessage(msg);
    const topic = receivedPacket.getTopic();
    const isPredefinedTopicString =
      this._verifyPredefinedTopicAndSendResponseText(topic);
    if (isPredefinedTopicString !== "UNKNOWN") {
      const packet = PacketMapper.generatePacketBuffer(
        new MqttUdpPacket({
          topic,
          message: isPredefinedTopicString,
          qos: 0,
          packetType: MqttPacketTypeEnum.PUBLISH,
        }),
        {},
      );
      this.client.send(packet, port, address, (err) => {
        if (err) console.error(err);
      });
      return;
    }
    for (let topicSubscribed of this.topicsSubscribed) {
      const topic = topicSubscribed.split("/");
      if (
        topic[0] === "$SYS" &&
        topic[1] === "conf" &&
        topic[2] === this.nodeId
      ) {
        const packet = PacketMapper.generatePacketBuffer(
          new MqttUdpPacket({
            topic: topicSubscribed,
            message: "NEED_CONFIG",
            qos: 0,
            packetType: MqttPacketTypeEnum.PUBLISH,
          }),
          {},
        );
        this.client.send(packet, 1883, this.broadcastAddress, (err) => {
          if (err) console.error(err);
        });
      }
    }
  }
  private _verifyPredefinedTopicAndSendResponseText(topic: string) {
    switch (topic) {
      case "$SYS/conf/${this.nodeId}/info/ver":
        return "1.0.0";
      case "$SYS/conf/${this.nodeId}/info/soft":
        return "NODEJS-MQTT-UDP";
      case "$SYS/conf/${this.nodeId}/node/name":
        return this.node.name;
      case "$SYS/conf/${this.nodeId}/node/location":
        return this.node.location;
      case "$SYS/conf/${this.nodeId}/net/mac":
        return NetAddr.getMacAddress();
      case "$SYS/conf/${this.nodeId}/net/ip":
        return NetAddr.getLocalIp();
      case "$SYS/conf/${this.nodeId}/info/uptime":
        const requestedDate = new Date();
        const uptime = requestedDate.getTime() - this.initiatedTime.getTime();
        const uptimeTextFormat = new Date(uptime).toISOString();
        return uptimeTextFormat;
      default:
        return "UNKNOWN";
    }
  }
}

export default Client;
