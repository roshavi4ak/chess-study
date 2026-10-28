import { ChessnutPositionReader, chessnutLedCommand } from "./chessnut";

const POSITION_SERVICE = "1b7e8261-2877-41c3-b46e-cf057c562023";
const POSITION_CHARACTERISTIC = "1b7e8262-2877-41c3-b46e-cf057c562023";
const COMMAND_SERVICE = "1b7e8271-2877-41c3-b46e-cf057c562023";
const COMMAND_CHARACTERISTIC = "1b7e8272-2877-41c3-b46e-cf057c562023";

// Web Bluetooth is not yet included in TypeScript's DOM declarations.
interface Characteristic extends EventTarget {
    value?: DataView;
    properties: { write?: boolean; writeWithoutResponse?: boolean };
    startNotifications(): Promise<Characteristic>;
    writeValueWithResponse?(value: Uint8Array<ArrayBuffer>): Promise<void>;
    writeValueWithoutResponse?(value: Uint8Array<ArrayBuffer>): Promise<void>;
    writeValue?(value: Uint8Array<ArrayBuffer>): Promise<void>;
}
interface Server {
    connected: boolean;
    connect(): Promise<Server>;
    disconnect(): void;
    getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<Characteristic> }>;
}
interface Device extends EventTarget { name?: string; gatt?: Server }
export interface ChessnutBluetooth {
    requestDevice(options: { filters: { namePrefix: string }[]; optionalServices: string[] }): Promise<Device>;
}

export function browserBluetooth(): ChessnutBluetooth | undefined {
    if (typeof navigator === "undefined" || !globalThis.isSecureContext) return undefined;
    return (navigator as Navigator & { bluetooth?: ChessnutBluetooth }).bluetooth;
}

function timeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Bluetooth operation timed out")), 12000);
        promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
}

export class ChessnutConnection {
    private device?: Device;
    private positions?: Characteristic;
    private commands?: Characteristic;
    private reader = new ChessnutPositionReader();
    private closed = false;
    private closing = false;
    private writes: Promise<void> = Promise.resolve();
    private lastLights = "";

    constructor(private callbacks: { position: (fen: string) => void; disconnected: () => void; error: (error: unknown) => void }) {}

    private assertOpen(allowClosing = false) {
        if (this.closed || (this.closing && !allowClosing)) throw new DOMException("Connection cancelled", "AbortError");
    }

    private notification = () => {
        const value = this.positions?.value;
        if (this.closed || this.closing || !value) return;
        const chunk = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        for (const position of this.reader.push(chunk)) this.callbacks.position(position);
    };

    private disconnected = () => {
        if (this.closed || this.closing) return;
        this.dispose();
        this.callbacks.disconnected();
    };

    async connect(bluetooth: ChessnutBluetooth): Promise<string> {
        try {
            // Keep requestDevice directly in the user's click call stack.
            const device = await bluetooth.requestDevice({
                filters: [{ namePrefix: "Chessnut Air" }],
                optionalServices: [POSITION_SERVICE, COMMAND_SERVICE],
            });
            this.assertOpen();
            this.device = device;
            if (!device.gatt) throw new Error("Bluetooth GATT is unavailable");
            device.addEventListener("gattserverdisconnected", this.disconnected);
            const server = await timeout(device.gatt.connect().then(server => {
                if (this.closed) server.disconnect();
                return server;
            }));
            this.assertOpen();
            const positionService = await timeout(server.getPrimaryService(POSITION_SERVICE));
            this.assertOpen();
            this.positions = await timeout(positionService.getCharacteristic(POSITION_CHARACTERISTIC));
            this.assertOpen();
            const commandService = await timeout(server.getPrimaryService(COMMAND_SERVICE));
            this.assertOpen();
            this.commands = await timeout(commandService.getCharacteristic(COMMAND_CHARACTERISTIC));
            this.assertOpen();
            this.positions.addEventListener("characteristicvaluechanged", this.notification);
            await timeout(this.positions.startNotifications());
            this.assertOpen();
            await this.refresh();
            await this.setLights([]);
            this.assertOpen();
            return device.name ?? "Chessnut Air";
        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    private write(command: Uint8Array<ArrayBuffer>, allowClosing = false): Promise<void> {
        const operation = this.writes.then(async () => {
            this.assertOpen(allowClosing);
            const characteristic = this.commands;
            if (!characteristic || !this.device?.gatt?.connected) throw new Error("Board disconnected");
            if (characteristic.properties.write && characteristic.writeValueWithResponse) {
                await timeout(characteristic.writeValueWithResponse(command));
            } else if (characteristic.writeValueWithoutResponse) {
                await timeout(characteristic.writeValueWithoutResponse(command));
            } else if (characteristic.writeValue) {
                await timeout(characteristic.writeValue(command));
            } else throw new Error("Bluetooth writes are unavailable");
        });
        // Keep the queue usable after failure; callers still receive the rejected operation.
        this.writes = operation.catch(() => {});
        return operation;
    }

    refresh() { return this.write(new Uint8Array([0x21, 0x01, 0x00])); }

    async setLights(squares: readonly string[]): Promise<void> {
        const command = chessnutLedCommand(squares);
        const key = command.join(",");
        if (key === this.lastLights) return;
        this.lastLights = key;
        try { await this.write(command); }
        catch (error) { this.lastLights = ""; throw error; }
    }

    reportError(error: unknown) {
        if (!this.closed) this.callbacks.error(error);
    }

    async disconnect(): Promise<void> {
        this.closing = true;
        // Clearing LEDs is best effort; cleanup always releases the GATT connection.
        try { if (this.commands && this.device?.gatt?.connected) await this.write(chessnutLedCommand([]), true); }
        finally { this.dispose(); }
    }

    dispose() {
        if (this.closed) return;
        this.closed = true;
        this.positions?.removeEventListener("characteristicvaluechanged", this.notification);
        this.device?.removeEventListener("gattserverdisconnected", this.disconnected);
        this.device?.gatt?.disconnect();
    }
}
