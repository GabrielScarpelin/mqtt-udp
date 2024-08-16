// index.ts
import { Buffer as Buffer2 } from "buffer";

// src/Client.ts
import * as dgram from "dgram";

// src/DTOs/PacketDto.ts
var MqttUdpPacket = class {
  packetType;
  topic;
  message;
  qos;
  rinfo;
  packetId;
  constructor({
    packetType,
    topic,
    message,
    qos
  }) {
    this.packetType = packetType;
    this.topic = topic;
    this.message = message;
    this.qos = qos || 0;
  }
  // Getters
  getPacketType() {
    return this.packetType;
  }
  getTopic() {
    return this.topic;
  }
  getMessage() {
    return this.message;
  }
  getQos() {
    return this.qos;
  }
  getRinfo() {
    return this.rinfo;
  }
  getPacketId() {
    return this.packetId;
  }
  // Setters
  setPacketType(packetType) {
    this.packetType = packetType;
  }
  setTopic(topic) {
    this.topic = topic;
  }
  setMessage(message) {
    this.message = message;
  }
  setQos(qos) {
    this.qos = qos;
  }
  setRinfo(rinfo) {
    this.rinfo = rinfo;
  }
  setPacketId(packetId) {
    if (packetId > 65535 || packetId < 1) {
      throw new Error("Packet ID must be between 1 and 65535");
    }
    this.packetId = packetId;
  }
};
var PacketDto_default = MqttUdpPacket;

// src/enums/PacketTypeEnum.ts
var MqttPacketTypeEnum = /* @__PURE__ */ ((MqttPacketTypeEnum2) => {
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["CONNECT"] = 1] = "CONNECT";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["CONNACK"] = 2] = "CONNACK";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["PUBLISH"] = 3] = "PUBLISH";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["PUBACK"] = 4] = "PUBACK";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["PUBREC"] = 5] = "PUBREC";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["PUBREL"] = 6] = "PUBREL";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["PUBCOMP"] = 7] = "PUBCOMP";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["SUBSCRIBE"] = 8] = "SUBSCRIBE";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["SUBACK"] = 9] = "SUBACK";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["UNSUBSCRIBE"] = 10] = "UNSUBSCRIBE";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["UNSUBACK"] = 11] = "UNSUBACK";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["PINGREQ"] = 12] = "PINGREQ";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["PINGRESP"] = 13] = "PINGRESP";
  MqttPacketTypeEnum2[MqttPacketTypeEnum2["DISCONNECT"] = 14] = "DISCONNECT";
  return MqttPacketTypeEnum2;
})(MqttPacketTypeEnum || {});
var PacketTypeEnum_default = MqttPacketTypeEnum;

// src/expection/RemainingLengthOversized.ts
var RemainingLengthOversized = class extends Error {
  constructor() {
    super("Remaining length is oversized");
  }
};
var RemainingLengthOversized_default = RemainingLengthOversized;

// src/PacketMapper.ts
var PacketMapper = class {
  static getQosFixedHeader(qos) {
    if (qos > 2) {
      throw new Error("QoS level must be between 0 and 2");
    }
    return qos << 1;
  }
  static generatePacketId(packetsWaitingAck) {
    const generatedId = Math.floor(Math.random() * 65535) + 1;
    if (packetsWaitingAck[generatedId]) {
      return this.generatePacketId(packetsWaitingAck);
    }
    return generatedId;
  }
  static generatePacketBuffer(mqttPacket, packetsWaitingAck) {
    const packetIdLength = mqttPacket.getQos() ? 2 : 0;
    const topicBuffer = Buffer.from(mqttPacket.getTopic());
    const messageBuffer = Buffer.from(mqttPacket.getMessage());
    const payloadLength = topicBuffer.length + messageBuffer.length + 2 + packetIdLength;
    const bytesPayloadLength = this._generateVariableByteInteger(payloadLength);
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
  static _generateVariableByteInteger(value) {
    const uint8Array = new Uint8Array(4);
    let remainingValue = value;
    let byte = 0;
    let i = 0;
    do {
      byte = remainingValue % 128;
      remainingValue = Math.floor(remainingValue / 128);
      if (remainingValue > 0) {
        byte = byte | 128;
      }
      uint8Array[i] = byte;
      i++;
    } while (remainingValue > 0);
    return Buffer.from(uint8Array.slice(0, i));
  }
  //reader
  static readVariableBytePayloadLength(packet) {
    let bytesRead = 0;
    let multiplier = 1;
    let result = 0;
    let byte = 0;
    do {
      if (bytesRead >= 4) {
        throw new RemainingLengthOversized_default();
      }
      byte = packet.readUInt8(bytesRead + 1);
      result += (byte & 127) * multiplier;
      multiplier *= 128;
      bytesRead++;
    } while ((byte & 128) !== 0);
    return [result, bytesRead];
  }
  static parsePublishMessage(msg) {
    if (msg.length < 4) {
      throw new Error("Invalid packet");
    }
    const [payloadLength, bytesRead] = this.readVariableBytePayloadLength(msg);
    const qos = msg.readUInt4(1) >> 1 & 3;
    if (qos > 2) {
      throw new Error("Invalid QoS level");
    }
    const topicLengthHi = msg.readUint8(1 + bytesRead);
    const topicLengthLo = msg.readUint8(2 + bytesRead);
    const topicLength = topicLengthHi << 8 | topicLengthLo;
    let startRead = 3 + bytesRead;
    const topic = msg.toString("utf-8", startRead, startRead + topicLength);
    startRead += topicLength;
    let packetId = null;
    if (qos > 0) {
      packetId = msg.readUInt16BE(startRead);
      startRead += 2;
    }
    const messageLength = payloadLength - startRead + 2;
    const message = msg.toString("utf-8", startRead, startRead + messageLength);
    const packet = new PacketDto_default({
      packetType: PacketTypeEnum_default.PUBLISH,
      topic,
      message,
      qos
    });
    if (packetId && qos > 0) {
      packet.setPacketId(packetId);
    }
    return { packet, packetId };
  }
};
var PacketMapper_default = PacketMapper;

// src/Client.ts
import { randomBytes } from "crypto";

// src/NetAddr.ts
import { networkInterfaces } from "os";
var NetAddr = class {
  static ignoreInterfaces = [
    "docker0",
    "vEthernet",
    "vmnet"
  ];
  static getLocalIp() {
    const localInterfaces = this.findLocalsNetworkInterfaces();
    return localInterfaces[0].address;
  }
  static getNetMask() {
    const localInterfaces = this.findLocalsNetworkInterfaces();
    return localInterfaces[0].netmask;
  }
  static getMacAddress() {
    const localInterfaces = this.findLocalsNetworkInterfaces();
    return localInterfaces[0].mac;
  }
  static getBroadcastAddress() {
    const localInterfaces = this.findLocalsNetworkInterfaces();
    const ip = localInterfaces[0].address;
    const subnetMask = localInterfaces[0].netmask;
    function ipToBinary(ipPart) {
      return ("00000000" + parseInt(ipPart, 10).toString(2)).slice(-8);
    }
    function binaryToIp(binaryPart) {
      return parseInt(binaryPart, 2).toString(10);
    }
    const ipBinary = ip.split(".").map(ipToBinary).join("");
    const maskBinary = subnetMask.split(".").map(ipToBinary).join("");
    const broadcastBinary = ipBinary.split("").map((bit, index) => maskBinary[index] === "1" ? bit : "1").join("");
    const broadcastIp = broadcastBinary.match(/.{1,8}/g).map(binaryToIp).join(".");
    return broadcastIp;
  }
  static findLocalsNetworkInterfaces() {
    const addresses = Object.entries(networkInterfaces()).filter(([name]) => !this.ignoreInterfaces.includes(name)).map(([_, addressList]) => addressList).flat();
    const localIpAddresses = addresses.filter(
      (addressInfo) => addressInfo.family === "IPv4" && !addressInfo.internal
    ).map((addressInfo) => {
      return {
        address: addressInfo.address,
        mac: addressInfo.mac,
        netmask: addressInfo.netmask
      };
    });
    return localIpAddresses;
  }
};
var NetAddr_default = NetAddr;

// src/Client.ts
var Client = class {
  client;
  topicsSubscribed = [];
  throttle;
  listenPort = 1883;
  broadcastAddress;
  nodeId = randomBytes(8).toString("hex");
  initiatedTime = null;
  node;
  packetsWaitingAck = {};
  pubAckTimeoutMs;
  functionForTopics = {};
  constructor({
    throttle,
    pubAckTimeoutMs = 5e3,
    port = 1883,
    itemsConfigurable,
    node
  }, callback) {
    this.pubAckTimeoutMs = pubAckTimeoutMs;
    this.listenPort = port;
    this.broadcastAddress = NetAddr_default.getBroadcastAddress();
    this.initiatedTime = /* @__PURE__ */ new Date();
    this.node = node || {
      name: "Node " + this.nodeId,
      location: "Unknown"
    };
    if (itemsConfigurable && itemsConfigurable.length > 0) {
      for (const itemConfigurable of itemsConfigurable) {
        this.topicsSubscribed.push(
          `$SYS/conf/${this.nodeId}/${itemConfigurable.item}`
        );
        this.functionForTopics[`$SYS/conf/${this.nodeId}/${itemConfigurable.item}`] = itemConfigurable.functionItem;
      }
    }
    if (throttle) {
      this.throttle = throttle;
    }
    this.client = dgram.createSocket("udp4");
    this.client.bind(this.listenPort, callback);
    this.client.on("message", (msg, rinfo) => {
      console.log(`Received message from ${rinfo.address}:${rinfo.port}`);
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
  subscribe(topic, onReceive, callback) {
    if (this.topicsSubscribed.includes(topic)) {
      return callback(new Error("Already subscribed to this topic"));
    }
    this.topicsSubscribed.push(topic);
    this.functionForTopics[topic] = onReceive;
  }
  sendMessage(mqttPacket) {
    if (this.throttle) {
      this.throttle.send(() => {
        this._sendMessage(mqttPacket);
      });
    } else {
      this._sendMessage(mqttPacket);
    }
  }
  sendPing(address, port) {
    if (this.throttle) {
      this.throttle.send(() => {
        this._sendPing(address, port);
      });
    } else {
      this._sendPing(address, port);
    }
  }
  _sendMessage(mqttPacket, port = 1883, address = this.broadcastAddress) {
    const packet = PacketMapper_default.generatePacketBuffer(
      mqttPacket,
      this.packetsWaitingAck
    );
    if (mqttPacket.getPacketId()) {
      this.packetsWaitingAck[mqttPacket.getPacketId()] = {
        packet,
        intervalId: null,
        retries: 0
      };
    }
    this.client.send(packet, port, address, (err) => {
      if (err) {
        console.error(err);
      }
    });
    mqttPacket.getQos() > 0 && this._startPubackTimeout(
      packet,
      mqttPacket.getPacketId(),
      port,
      this.broadcastAddress
    );
  }
  _handleMessage(msg, rinfo) {
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
  _receivePublishMessage(msg, rinfo) {
    try {
      console.log("Received publish message");
      const { packet, packetId } = PacketMapper_default.parsePublishMessage(msg);
      const hasSubscribed = this._checkTopicAndReturnSubscribed(
        packet.getTopic()
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
  _receivePubAck(msg) {
    const packetId = msg.readUInt16BE(2);
    if (this.packetsWaitingAck[packetId]) {
      clearInterval(this.packetsWaitingAck[packetId].intervalId);
      delete this.packetsWaitingAck[packetId];
    } else {
      console.error("Received PUBACK for unknown packet ID");
    }
  }
  _receivePingResponse() {
    console.log("Ping response received");
  }
  _sendPingResponse(rinfo) {
    const sendPacket = () => {
      const packet = Buffer.from([208, 0]);
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
  _sendPing(address, port) {
    const packet = Buffer.from([192, 0]);
    this.client.send(packet, port, address, (err) => {
      if (err) {
        console.error(err);
      }
    });
  }
  _sendPubAck(packetId, rinfo) {
    const packet = Buffer.alloc(4);
    packet.writeUInt8(64, 0);
    packet.writeUInt8(2, 1);
    packet.writeUInt16BE(packetId, 2);
    this.client.send(packet, rinfo.port, rinfo.address, (err) => {
      if (err) {
        console.error(err);
        return;
      }
    });
  }
  _startPubackTimeout(packet, packetId, port, ip) {
    const timeout = setTimeout(() => {
      if (this.packetsWaitingAck[packetId]) {
        const secondNibble = packet.readUInt4(1);
        const setDup = secondNibble | 8;
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
  _checkTopicAndReturnSubscribed(topic) {
    for (const subscribedTopic of this.topicsSubscribed) {
      if (this._matchTopic(subscribedTopic, topic)) {
        return subscribedTopic;
      }
    }
    return null;
  }
  _matchTopic(subscribedTopic, topic) {
    if (subscribedTopic === topic) return true;
    const subscribedLevels = subscribedTopic.split("/");
    const topicLevels = topic.split("/");
    for (let i = 0; i < subscribedLevels.length; i++) {
      const subLevel = subscribedLevels[i];
      if (i >= topicLevels.length) {
        if (subLevel === "#") {
          return true;
        }
        return null;
      }
      const topicLevel = topicLevels[i];
      if (subLevel === "#") {
        return true;
      } else if (subLevel !== "+" && subLevel !== topicLevel) {
        return false;
      }
    }
    if (topicLevels.length > subscribedLevels.length) {
      if (subscribedLevels[subscribedLevels.length - 1] !== "#") {
        return false;
      }
    }
    return true;
  }
  _sendConfigurableItemsOrPredefined(msg, address, port) {
    const { packet: receivedPacket } = PacketMapper_default.parsePublishMessage(msg);
    const topic = receivedPacket.getTopic();
    const isPredefinedTopicString = this._verifyPredefinedTopicAndSendResponseText(topic);
    if (isPredefinedTopicString !== "UNKNOWN") {
      const packet = PacketMapper_default.generatePacketBuffer(
        new PacketDto_default({
          topic,
          message: isPredefinedTopicString,
          qos: 0,
          packetType: PacketTypeEnum_default.PUBLISH
        }),
        {}
      );
      this.client.send(packet, port, address, (err) => {
        if (err) console.error(err);
      });
      return;
    }
    for (let topicSubscribed of this.topicsSubscribed) {
      const topic2 = topicSubscribed.split("/");
      if (topic2[0] === "$SYS" && topic2[1] === "conf" && topic2[2] === this.nodeId) {
        const packet = PacketMapper_default.generatePacketBuffer(
          new PacketDto_default({
            topic: topicSubscribed,
            message: "NEED_CONFIG",
            qos: 0,
            packetType: PacketTypeEnum_default.PUBLISH
          }),
          {}
        );
        this.client.send(packet, 1883, this.broadcastAddress, (err) => {
          if (err) console.error(err);
        });
      }
    }
  }
  _verifyPredefinedTopicAndSendResponseText(topic) {
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
        return NetAddr_default.getMacAddress();
      case "$SYS/conf/${this.nodeId}/net/ip":
        return NetAddr_default.getLocalIp();
      case "$SYS/conf/${this.nodeId}/info/uptime":
        const requestedDate = /* @__PURE__ */ new Date();
        const uptime = requestedDate.getTime() - this.initiatedTime.getTime();
        const uptimeTextFormat = new Date(uptime).toISOString();
        return uptimeTextFormat;
      default:
        return "UNKNOWN";
    }
  }
};
var Client_default = Client;

// src/Throttle.ts
var Throttle = class {
  packetsPerTime;
  ms;
  packetsCount = 0;
  packetsCountRead = 0;
  timeout = null;
  queuedPacketsToSend = [];
  queuedPacketsToRead = [];
  constructor(packetsPerTime, ms) {
    this.packetsPerTime = packetsPerTime || 10;
    this.ms = ms || 1e3;
  }
  send(executeFunction) {
    if (!this.timeout) {
      this._startTimeout();
    }
    if (this.packetsCount < this.packetsPerTime) {
      this.packetsCount++;
      executeFunction();
    } else {
      this.queuedPacketsToSend.push(executeFunction);
    }
  }
  _startTimeout() {
    this.timeout = setTimeout(() => {
      this.packetsCount = 0;
      this.packetsCountRead = 0;
      this.timeout = null;
      if (this.queuedPacketsToSend.length > 0) {
        this._startTimeout();
        this.send(this.queuedPacketsToSend.shift());
      }
      if (this.queuedPacketsToRead.length > 0) {
        this._startTimeout();
        this.read(this.queuedPacketsToRead.shift());
      }
    }, this.ms);
  }
  read(executeFunction) {
    if (!this.timeout) {
      this._startTimeout();
    }
    if (this.packetsCountRead < this.packetsPerTime) {
      this.packetsCountRead++;
      executeFunction();
    } else {
      this.queuedPacketsToRead.push(executeFunction);
    }
  }
};
var Throttle_default = Throttle;

// index.ts
Buffer2.prototype.writeUInt4 = function(value, uInt4Offset = 0) {
  const offset = Math.floor(uInt4Offset / 2);
  if (offset > this.length) throw new Error("Offset is out of bounds.");
  if (uInt4Offset % 2 === 0) {
    this[offset] = this[offset] & 15 | (value & 15) << 4;
  } else {
    this[offset] = this[offset] & 240 | value & 15;
  }
  return this;
};
Buffer2.prototype.readUInt4 = function(uInt4Offset = 0) {
  const offset = Math.floor(uInt4Offset / 2);
  if (offset > this.length) throw new Error("Offset is out of bounds.");
  if (uInt4Offset % 2 === 0) {
    return (this[offset] & 240) >> 4;
  }
  return this[offset] & 15;
};
var MqttUdpClient = Client_default;
var mqtt_udp_library_default = MqttUdpClient;
export {
  PacketTypeEnum_default as MqttPacketTypeEnum,
  PacketDto_default as MqttUdpPacket,
  Throttle_default as Throttle,
  mqtt_udp_library_default as default
};
//# sourceMappingURL=index.js.map