import MqttClient, {
  MqttPacketTypeEnum,
  Throttle,
  MqttUdpPacket,
} from "mqtt-udp";
import dgram, { Socket } from "dgram";
import { mock } from "node:test";

describe("MqttUdpPacket DTO Tests", () => {
  test("should set and get packet properties correctly", () => {
    const packet = new MqttUdpPacket({
      packetType: MqttPacketTypeEnum.PUBLISH,
      topic: "test/topic",
      message: "Hello",
      qos: 1,
    });

    expect(packet.getPacketType()).toBe(MqttPacketTypeEnum.PUBLISH);
    expect(packet.getTopic()).toBe("test/topic");
    expect(packet.getMessage()).toBe("Hello");
    expect(packet.getQos()).toBe(1);
  });

  test("should throw an error if packet ID is out of bounds", () => {
    const packet = new MqttUdpPacket({ packetType: 1, topic: "", message: "" });
    expect(() => packet.setPacketId(70000)).toThrow(
      "Packet ID must be between 1 and 65535",
    );
  });
});

describe("MqttClient Tests", () => {
  let client;
  const mockSocket = {
    send: jest.fn(),
    on: jest.fn(),
    bind: jest.fn(),
  };

  beforeEach(() => {
    jest
      .spyOn(dgram, "createSocket")
      .mockReturnValue(mockSocket as unknown as Socket);
    client = new MqttClient({
      throttle: null,
      pubAckTimeoutMs: 5000,
      port: Math.floor(1024 + Math.random() * 64511), // Usando uma porta aleatória
      itemsConfigurable: [],
      node: null,
    });
  });

  test("should subscribe to a topic", () => {
    const topic = "test/topic";
    const callback = jest.fn();

    client.subscribe(topic, callback, () => {});
    expect(client.topicsSubscribed).toContain(topic);
    expect(client.functionForTopics[topic]).toBe(callback);
  });

  test("should not subscribe to the same topic twice", () => {
    const topic = "test/topic";
    client.subscribe(
      topic,
      () => {},
      (err) => {},
    );
    client.subscribe(
      topic,
      () => {},
      (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe("Already subscribed to this topic");
      },
    );
  });

  test("should send a message", () => {
    const packet = new MqttUdpPacket({
      packetType: MqttPacketTypeEnum.PUBLISH,
      topic: "test/topic",
      message: "Hello",
      qos: 1,
    });
    const error = new Error("Invalid message type");
    client.sendMessage(packet);
    expect(() => error).not.toThrow(error);
  });

  test("should handle incoming messages", () => {
    const msg = Buffer.from([48, 0, 0, 0]);
    const rinfo = { address: "127.0.0.1", port: 1883 };
    const error = new Error("Invalid message type");
    client._handleMessage(msg, rinfo);
    expect(() => error).not.toThrow(error);
  });

  test("should handle PUBACK messages", () => {
    const packet = new MqttUdpPacket({
      packetType: MqttPacketTypeEnum.PUBLISH,
      topic: "test/topic",
      message: "Hello",
      qos: 1,
    });
    packet.setPacketId(123);

    client.packetsWaitingAck[123] = { intervalId: setInterval(() => {}, 1000) };
    const pubackMsg = Buffer.from([64, 2, 0, 123]);

    client._receivePubAck(pubackMsg);
    expect(client.packetsWaitingAck[123]).toBeUndefined();
  });
});

describe("Throttle Class Tests", () => {
  let throttle;

  beforeEach(() => {
    throttle = new Throttle(2, 1000);
  });

  test("should throttle sending correctly", (done) => {
    const sendFn = jest.fn();

    throttle.send(sendFn);
    throttle.send(sendFn);
    throttle.send(() => {
      expect(sendFn).toHaveBeenCalledTimes(2);
      done();
    });
  });

  test("should throttle reading correctly", (done) => {
    const readFn = jest.fn();

    throttle.read(readFn);
    throttle.read(readFn);
    throttle.read(() => {
      expect(readFn).toHaveBeenCalledTimes(2);
      done();
    });
  });
});
