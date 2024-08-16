

# Documentação da Biblioteca MQTT/UDP para JavaScript - English/Português
## Introduction
&emsp;This library provides a simple and efficient implementation of the MQTT protocol over UDP for IoT applications, automation, and robotics. Both the library and the original MQTT-UDP project are designed to operate without a broker, as traffic is managed using UDP Broadcast.

&emsp;Essa biblioteca fornece uma implementação simples e eficiente do protocolo MQTT sobre UDP para aplicações IoT, automação e robótica. Tanto a biblioteca quanto o projeto original MQTT-UDP são projetados para operar sem um broker, pois o tráfego é gerenciado usando Broadcast UDP.

## Resources
- No broker needed
- Simple and easy implementation
- Support basic QoS (0 and 1 --- 2 works equals the 1)
- Support remote configuration - see https://mqtt-udp.readthedocs.io/en/latest/)
- Throttling optional use to limited hardwares

## Recursos
- Sem necessidade de broker
- Implementação simples e fácil
- Suporte básico de QoS (0 e 1 --- 2 funciona igual ao 1)
- Suporte a configuração remota - veja https://mqtt-udp.readthedocs.io/en/latest/)
- Uso opcional de throttling para hardwares limitados

## Installation
To install the library, you can use the NPM:
Para instalar a biblioteca, você pode usar o NPM:

````bash
~ npm install mqtt-udp
````
## Basics uses
### Client initialization
````typescript
import Client, { Throttle } from 'mqtt-udp';

const clientOptions = {
  throttle: new Throttle(15, 500), // Max 15 packets each 500ms
  port: 1883,
  pubAckTimeoutMs: 5000,
  itemsConfigurable: [
    {
      item: 'temperature',
      function: (packet) => {
        console.log('Received temperature:', packet.getMessage());
      },
    },
  ],
  node: {
    name: 'MyNode',
    location: 'Living Room',
  },
};

const client = new Client(clientOptions, () => {
  console.log('Client started and listening on port', clientOptions.port);
});
````
### Topics Subscribe
````typescript
client.subscribe('sensors/temperature', (packet) => {
  console.log('Temperature:', packet.getMessage());
}, (err) => {
  if (err) console.error(err);
});
````
### Sending messages
````typescript
import Client, { Throttle, MqttUdpPacket, MqttPacketTypeEnum } from 'mqtt-udp';

const packet = new MqttUdpPacket({
  packetType: MqttPacketTypeEnum.PUBLISH, // PUBLISH
  topic: 'sensors/temperature',
  message: '25.4',
  qos: 0,
});

client.sendMessage(packet);
````
# API Details

## Class Client
### Constructor
````typescript
new Client(options: ClientOptions, callback?: () => void)
````

### ClientOptions - Object for configuration

````typescript
throttle: class Throttle
pubAckTimeoutMs: number // Wait time to receive the Puback message
port: number // Port to listen the UDP packets.
itemsConfigurable: {
	item: string; // Items that will be send when receive a SUBSCRIBE $SYS/conf/# message. See MQTT-UDP docs to more information
	functionItem: (packet: MqttUdpPacket) => void; // Callback function when receive the response
}[];
node: {
	name: string;
	location: string;
} // Send when receive a special SUBSCRIBE topic. See MQTT-UDP docs to more information
````

### Methods
````typescript
subscribe(topic: string, onReceive: (packet: MqttUdpPacket) => void, callback: (err: Error) => void): // Subscribe in a topic and call a callback when receive new message
sendMessage(mqttPacket: MqttUdpPacket): // Send a message
sendPing(address: string, port: number): // Send ping to an address
````
## Class Throttle

### Constructor

````typescript
new Throttle(packetsPerTime: number, ms: number)
````

### Methods

````typescript
send(executeFunction: () => void): // Send a message with throttling
read(executeFunction: () => void): // Read a message with throttling
````
## Class MqttUdpPacket (DTO Class)
### Constructor
````typescript
new MqttUdpPacket(options: { packetType?: MqttPacketTypeEnum, topic?: string, message?: string, qos?: number })
````
### Methods

````typescript
getPacketType(): // Return the packet type
getTopic(): // Return the topic
getMessage(): // Return the message
getQos(): // Return the QoS Level
setPacketType(packetType: MqttPacketTypeEnum): // Set the type of the packet
setTopic(topic: string): // Set the topic
setMessage(message: string): // Set the message
setQos(qos: number): // Set the QoS Level
````

## Examples

### Sending data
````typescript
const packet = new MqttUdpPacket({
  packetType: MqttPacketTypeEnum.PUBLISH,
  topic: 'sensors/humidity',
  message: '40%',
});

client.sendMessage(packet);
````
### Reading data
````typescript
client.subscribe('sensors/humidity', (packet) => {
  console.log('Humidity:', packet.getMessage());
});
````
## License
MIT License.

## Contributions
Contributions are welcome! Feel free to submit issues or pull requests.

Contribuições são bem-vindas! Sinta-se à vontade para enviar problemas ou solicitações de pull.
