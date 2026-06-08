export interface BluetoothDeviceSummary {
  id: string;
  name: string;
}

export interface ConnectedDevice {
  id: string;
  name: string;
  writeCharacteristicUuid: string;
  notifyCharacteristicUuid: string | null;
}

export interface BluetoothClientEvents {
  onDisconnected: () => void;
  onNotification: (bytes: number[]) => void;
}

interface BluetoothNavigatorLike {
  requestDevice(options: RequestDeviceOptionsLike): Promise<BluetoothDeviceLike>;
  getDevices?: () => Promise<BluetoothDeviceLike[]>;
  getAvailability?: () => Promise<boolean>;
}

interface RequestDeviceOptionsLike {
  acceptAllDevices?: boolean;
  optionalServices?: BluetoothServiceUUIDLike[];
}

type BluetoothServiceUUIDLike = number | string;

interface BluetoothDeviceLike extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServerLike;
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServerLike>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUIDLike): Promise<BluetoothRemoteGATTServiceLike>;
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristic(characteristic: BluetoothServiceUUIDLike): Promise<BluetoothRemoteGATTCharacteristicLike>;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristicLike[]>;
}

interface BluetoothCharacteristicPropertiesLike {
  write?: boolean;
  writeWithoutResponse?: boolean;
  notify?: boolean;
  indicate?: boolean;
}

interface BluetoothRemoteGATTCharacteristicLike extends EventTarget {
  uuid: string;
  properties: BluetoothCharacteristicPropertiesLike;
  startNotifications?: () => Promise<BluetoothRemoteGATTCharacteristicLike>;
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  writeValue?: (value: BufferSource) => Promise<void>;
}

interface BluetoothValueChangeEvent extends Event {
  target: BluetoothRemoteGATTCharacteristicLike & { value?: DataView };
}

const SERVICE_UUID = 0xffe0;
const TX_CHARACTERISTIC_UUID = 0xffe2;
const RX_CHARACTERISTIC_UUID = 0xffe1;

export class WasherBluetoothClient {
  private device: BluetoothDeviceLike | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;

  constructor(private readonly events: BluetoothClientEvents) {}

  get isSupported(): boolean {
    return Boolean(this.bluetooth);
  }

  get supportsRememberedDevices(): boolean {
    return typeof this.bluetooth?.getDevices === "function";
  }

  get isConnected(): boolean {
    return Boolean(this.device?.gatt?.connected && this.txCharacteristic);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.bluetooth) {
      return false;
    }

    if (typeof this.bluetooth.getAvailability !== "function") {
      return true;
    }

    return this.bluetooth.getAvailability();
  }

  async getGrantedDevices(): Promise<BluetoothDeviceSummary[]> {
    if (!this.bluetooth?.getDevices) {
      return [];
    }

    const devices = await this.bluetooth.getDevices();
    return devices.map((device) => ({
      id: device.id,
      name: getDeviceName(device)
    }));
  }

  async requestAndConnect(): Promise<ConnectedDevice> {
    if (!this.bluetooth) {
      throw new Error("当前浏览器不支持 Web Bluetooth");
    }

    const device = await this.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID]
    });

    return this.connectDevice(device);
  }

  async connectGranted(deviceId?: string): Promise<ConnectedDevice> {
    if (!this.bluetooth?.getDevices) {
      throw new Error("当前浏览器不支持 navigator.bluetooth.getDevices()");
    }

    const devices = await this.bluetooth.getDevices();
    const device = deviceId ? devices.find((item) => item.id === deviceId) : devices[0];

    if (!device) {
      throw new Error("没有找到已授权设备，请先扫描并选择一次设备");
    }

    return this.connectDevice(device);
  }

  disconnect(): void {
    this.device?.gatt?.disconnect();
    this.clearConnection();
  }

  async send(bytes: readonly number[]): Promise<void> {
    if (!this.isConnected || !this.txCharacteristic) {
      throw new Error("请先连接洗衣机蓝牙设备");
    }

    const payload = new Uint8Array(bytes);
    const characteristic = this.txCharacteristic;

    if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(payload);
      return;
    }

    if (characteristic.properties.write && characteristic.writeValueWithResponse) {
      await characteristic.writeValueWithResponse(payload);
      return;
    }

    if (characteristic.writeValue) {
      await characteristic.writeValue(payload);
      return;
    }

    throw new Error("写入特征不支持 Web Bluetooth 写入方法");
  }

  private async connectDevice(device: BluetoothDeviceLike): Promise<ConnectedDevice> {
    if (!device.gatt) {
      throw new Error("设备没有可用的 GATT 服务");
    }

    this.clearConnection();
    this.device = device;
    device.addEventListener("gattserverdisconnected", this.handleDisconnected);

    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);

      this.txCharacteristic = await this.findWriteCharacteristic(service);
      this.rxCharacteristic = await this.configureNotifications(service);
    } catch (error) {
      this.clearConnection();
      throw error;
    }

    return {
      id: device.id,
      name: getDeviceName(device),
      writeCharacteristicUuid: this.txCharacteristic.uuid,
      notifyCharacteristicUuid: this.rxCharacteristic?.uuid ?? null
    };
  }

  private async findWriteCharacteristic(
    service: BluetoothRemoteGATTServiceLike
  ): Promise<BluetoothRemoteGATTCharacteristicLike> {
    try {
      const preferred = await service.getCharacteristic(TX_CHARACTERISTIC_UUID);
      if (isWritable(preferred)) {
        return preferred;
      }
    } catch {
      // Fall through to characteristic discovery.
    }

    const characteristics = await service.getCharacteristics();
    const writable = characteristics.find(isWritable);
    if (!writable) {
      throw new Error("未找到可写入的蓝牙特征");
    }
    return writable;
  }

  private async configureNotifications(
    service: BluetoothRemoteGATTServiceLike
  ): Promise<BluetoothRemoteGATTCharacteristicLike | null> {
    try {
      const rx = await service.getCharacteristic(RX_CHARACTERISTIC_UUID);
      if ((rx.properties.notify || rx.properties.indicate) && rx.startNotifications) {
        const notified = await rx.startNotifications();
        notified.addEventListener("characteristicvaluechanged", this.handleNotification);
        return notified;
      }
    } catch {
      return null;
    }

    return null;
  }

  private readonly handleNotification = (event: Event): void => {
    const value = (event as BluetoothValueChangeEvent).target.value;
    if (!value) {
      return;
    }

    const bytes = Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    this.events.onNotification(bytes);
  };

  private readonly handleDisconnected = (): void => {
    this.clearConnection();
    this.events.onDisconnected();
  };

  private clearConnection(): void {
    if (this.rxCharacteristic) {
      this.rxCharacteristic.removeEventListener("characteristicvaluechanged", this.handleNotification);
    }
    if (this.device) {
      this.device.removeEventListener("gattserverdisconnected", this.handleDisconnected);
    }

    this.txCharacteristic = null;
    this.rxCharacteristic = null;
    this.device = null;
  }

  private get bluetooth(): BluetoothNavigatorLike | undefined {
    return (navigator as Navigator & { bluetooth?: BluetoothNavigatorLike }).bluetooth;
  }
}

function isWritable(characteristic: BluetoothRemoteGATTCharacteristicLike): boolean {
  return Boolean(characteristic.properties.write || characteristic.properties.writeWithoutResponse);
}

function getDeviceName(device: BluetoothDeviceLike): string {
  return device.name?.trim() || "未命名设备";
}
